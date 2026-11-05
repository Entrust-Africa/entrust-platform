import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import {
  AdminProduct,
  AllocationBody,
  ApproveBody,
  BookingDetail,
  BookingList,
  BookingParam,
  BookingQuery,
  Catalogue,
  EnquiryDetail,
  EnquiryList,
  EnquiryParam,
  EnquiryPatch,
  EnquiryQuery,
  EnquiryStatusBody,
  EvidenceUrl,
  ExhibitorApplicationBody,
  ExhibitorApplicationReceipt,
  Payment,
  PaymentParam,
  PaymentPatch,
  ReasonBody,
  SponsorEnquiryBody,
  SponsorEnquiryReceipt,
  EditionBody,
  EditionDetail,
  EditionList,
  EditionParam,
  EditionPatch,
  ProductBody,
  ProductParam,
  ProductPatch,
} from "../schemas/summit-commerce";
import { allocateBooth, applyForBooth, approveBooking, cancelBooking, confirmBooking, getBooking, listBookings, rejectBooking } from "../services/summit-commerce-bookings";
import { changeEnquiryStatus, getEnquiry, listEnquiries, submitEnquiry, updateEnquiry } from "../services/summit-commerce-enquiries";
import { evidenceUrl, updatePayment } from "../services/summit-commerce-payments";
import { createEdition, createProduct, getEdition, listEditions, publicCatalogue, updateEdition, updateProduct } from "../services/summit-commerce";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "./clear/shared";

// The commercial side of ADTIS: the catalogue the website shows (public), and the administrators' editing of editions
// and products. Exhibitor bookings, sponsorship enquiries, delegates, payments and reports are added beside these.

const tags = ["Summit commerce"];

// ---- Public ----

const publicRouter = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

const catalogueRoute = createRoute({
  method: "get",
  path: "/catalogue",
  tags,
  summary: "The current edition's catalogue",
  description:
    "For the public ADTIS pages: the exhibition packages, sponsorship levels, delegate categories and additional opportunities of the current edition, with prices in USD and how many are left. It needs no sign-in. Drafts and archived products are not listed, and it holds no payment instructions and nothing about who has booked.",
  responses: { 200: { description: "The catalogue; its edition is null before one is set up", content: json(Catalogue) } },
});

const exhibitorApplicationRoute = createRoute({
  method: "post",
  path: "/exhibitor-applications",
  tags,
  summary: "Apply for exhibition space",
  description:
    "For the public exhibitor form: a business asks for one of the current edition's exhibition packages. It needs no sign-in. It records the application and emails a receipt; no booth is held and nothing is due until an administrator approves it. A second application from the same address for the same package replaces the first while it is waiting. A sold-out package takes no applications.",
  request: { body: { required: true, content: json(ExhibitorApplicationBody) } },
  responses: {
    201: { description: "The application was recorded", content: json(ExhibitorApplicationReceipt) },
    400: problem("The form isn't complete or valid"),
    404: problem("Applications aren't open, or there is no such package"),
    422: problem("The package is sold out"),
  },
});

const sponsorEnquiryRoute = createRoute({
  method: "post",
  path: "/sponsor-enquiries",
  tags,
  summary: "Ask about sponsoring",
  description:
    "For the public sponsorship form: an organisation says which sponsorship level or additional opportunity it is interested in. It needs no sign-in. It records the enquiry and emails a receipt; nothing is reserved or due. A second enquiry from the same address for the same option replaces the first while it is new. An option whose places are all confirmed takes no enquiries.",
  request: { body: { required: true, content: json(SponsorEnquiryBody) } },
  responses: {
    201: { description: "The enquiry was recorded", content: json(SponsorEnquiryReceipt) },
    400: problem("The form isn't complete or valid"),
    404: problem("Enquiries aren't open, or there is no such option"),
    422: problem("The option is no longer available"),
  },
});

export const summitCommercePublic = publicRouter
  .openapi(catalogueRoute, async (c) => c.json(await publicCatalogue({ db: getDb() }), 200))
  .openapi(sponsorEnquiryRoute, async (c) => c.json(await submitEnquiry({ db: getDb(), now: new Date() }, c.req.valid("json")), 201))
  .openapi(exhibitorApplicationRoute, async (c) => c.json(await applyForBooth({ db: getDb(), now: new Date() }, c.req.valid("json")), 201));

// ---- Administrators ----

const router = clearRouter();

const admin = {
  ...listErrors,
  403: problem("Not an Entrust administrator (or, for reading, an administrator or facilitator)"),
  404: problem("No such edition or product"),
};

const listEditionsRoute = createRoute({
  method: "get",
  path: "/editions",
  tags,
  summary: "List the editions",
  description: "The current edition first. Entrust administrators and facilitators.",
  responses: { 200: { description: "The editions", content: json(EditionList) }, ...listErrors, 403: admin[403] },
});

const createEditionRoute = createRoute({
  method: "post",
  path: "/editions",
  tags,
  summary: "Create an edition",
  description:
    "Starts an edition from the standard ADTIS catalogue, or copies an earlier edition's settings and products. The first edition becomes the current one; later ones don't until an administrator makes them. Entrust administrators only.",
  request: { body: { required: true, content: json(EditionBody) } },
  responses: { 201: { description: "The edition, with its products", content: json(EditionDetail) }, ...admin, 422: writeErrors[422] },
});

const getEditionRoute = createRoute({
  method: "get",
  path: "/editions/{id}",
  tags,
  summary: "An edition and all its products",
  description: "Every product, drafts and archived ones included, with how many of each are taken. Entrust administrators and facilitators.",
  request: { params: EditionParam },
  responses: { 200: { description: "The edition", content: json(EditionDetail) }, ...admin },
});

const updateEditionRoute = createRoute({
  method: "patch",
  path: "/editions/{id}",
  tags,
  summary: "Change an edition's settings",
  description:
    "Dates note, venue, tax note, payment methods, the assessment period whose selected SMEs register free, and which edition is current. Entrust administrators only.",
  request: { params: EditionParam, body: { required: true, content: json(EditionPatch) } },
  responses: { 200: { description: "The edition", content: json(EditionDetail) }, ...admin, 422: writeErrors[422] },
});

const createProductRoute = createRoute({
  method: "post",
  path: "/editions/{id}/products",
  tags,
  summary: "Add a product to an edition",
  description: "An exhibition package, sponsorship level, delegate category or other opportunity. It starts as a draft unless the body says otherwise. Entrust administrators only.",
  request: { params: EditionParam, body: { required: true, content: json(ProductBody) } },
  responses: { 201: { description: "The product", content: json(AdminProduct) }, ...admin, 422: writeErrors[422] },
});

const updateProductRoute = createRoute({
  method: "patch",
  path: "/products/{id}",
  tags,
  summary: "Change a product",
  description:
    "Price, benefits, capacity, sold-out mark, status and order. A change applies from now on: bookings already made keep the price they were made at. A product is archived, not deleted, so the records that name it stay readable. Entrust administrators only.",
  request: { params: ProductParam, body: { required: true, content: json(ProductPatch) } },
  responses: { 200: { description: "The product", content: json(AdminProduct) }, ...admin, 422: writeErrors[422] },
});

const listBookingsRoute = createRoute({
  method: "get",
  path: "/exhibitor-bookings",
  tags,
  summary: "List the exhibitor applications and bookings",
  description: "Newest first, for the current edition unless another is named, with how many are in each status. Entrust administrators and facilitators.",
  request: { query: BookingQuery },
  responses: { 200: { description: "The bookings", content: json(BookingList) }, ...listErrors, 403: admin[403] },
});

const getBookingRoute = createRoute({
  method: "get",
  path: "/exhibitor-bookings/{id}",
  tags,
  summary: "One exhibitor booking",
  description: "Everything the applicant gave, the booth, the payment, and what still stops it being confirmed. Entrust administrators and facilitators.",
  request: { params: BookingParam },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...admin },
});

const bookingActions = { ...admin, 409: writeErrors[409], 422: writeErrors[422] };

const approveRoute = createRoute({
  method: "post",
  path: "/exhibitor-bookings/{id}/approve",
  tags,
  summary: "Approve an application",
  description:
    "Holds a booth of the package, opens a payment for the price the applicant applied at, and emails the payment instructions. Refused when the package has no booth left or is marked sold out. It does not confirm the booth: that waits for a verified payment.",
  request: { params: BookingParam, body: { required: true, content: json(ApproveBody) } },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...bookingActions },
});

const rejectRoute = createRoute({
  method: "post",
  path: "/exhibitor-bookings/{id}/reject",
  tags,
  summary: "Reject an application",
  description: "Releases any booth held, cancels an unpaid payment, and emails the applicant the reason.",
  request: { params: BookingParam, body: { required: true, content: json(ReasonBody) } },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...bookingActions },
});

const cancelRoute = createRoute({
  method: "post",
  path: "/exhibitor-bookings/{id}/cancel",
  tags,
  summary: "Cancel a booking",
  description:
    "Releases the booth and cancels a payment that was never verified. A payment that was already confirmed is left as it is, for an administrator to refund. An applicant who held a booth is emailed.",
  request: { params: BookingParam, body: { required: true, content: json(ReasonBody) } },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...bookingActions },
});

const allocationRoute = createRoute({
  method: "put",
  path: "/exhibitor-bookings/{id}/allocation",
  tags,
  summary: "Assign a booth number and zone",
  description: "For an approved or confirmed booking. A booth number belongs to one held booking of the edition; a zone must be one of the edition's zones when it lists any. Send nulls to clear (not on a confirmed booking).",
  request: { params: BookingParam, body: { required: true, content: json(AllocationBody) } },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...bookingActions },
});

const confirmRoute = createRoute({
  method: "post",
  path: "/exhibitor-bookings/{id}/confirm",
  tags,
  summary: "Confirm the booth",
  description:
    "Only for an approved booking whose payment has been verified and which has a booth number. Emails the exhibitor the booking confirmation. Nothing confirms a booking on its own.",
  request: { params: BookingParam },
  responses: { 200: { description: "The booking", content: json(BookingDetail) }, ...bookingActions },
});

const paymentRoute = createRoute({
  method: "patch",
  path: "/payments/{id}",
  tags,
  summary: "Record a payment",
  description:
    "The reference, method, amount received and proof of payment, and the status. Recording a reference or proof on a pending payment moves it to awaiting verification. Confirming needs a reference or proof and an amount that covers what is owed. Only an administrator changes the amount owed.",
  request: { params: PaymentParam, body: { required: true, content: json(PaymentPatch) } },
  responses: { 200: { description: "The payment", content: json(Payment) }, ...bookingActions },
});

const evidenceRoute = createRoute({
  method: "get",
  path: "/payments/{id}/evidence-url",
  tags,
  summary: "A link to the proof of payment",
  description: "A short-lived download link. Entrust administrators and facilitators.",
  request: { params: PaymentParam },
  responses: { 200: { description: "The link", content: json(EvidenceUrl) }, ...admin },
});

const listEnquiriesRoute = createRoute({
  method: "get",
  path: "/sponsor-enquiries",
  tags,
  summary: "List the sponsorship enquiries",
  description: "Newest first, for the current edition unless another is named, with how many are in each status and the value of the pipeline. Entrust administrators and facilitators.",
  request: { query: EnquiryQuery },
  responses: { 200: { description: "The enquiries", content: json(EnquiryList) }, ...listErrors, 403: admin[403] },
});

const getEnquiryRoute = createRoute({
  method: "get",
  path: "/sponsor-enquiries/{id}",
  tags,
  summary: "One sponsorship enquiry",
  description: "What the organisation wrote, its status history, the organisers' notes and the payment. Entrust administrators and facilitators.",
  request: { params: EnquiryParam },
  responses: { 200: { description: "The enquiry", content: json(EnquiryDetail) }, ...admin },
});

const updateEnquiryRoute = createRoute({
  method: "patch",
  path: "/sponsor-enquiries/{id}",
  tags,
  summary: "Record the value and notes of an enquiry",
  description: "The value starts as the listed price and can be changed while the deal is negotiated. Entrust administrators and facilitators.",
  request: { params: EnquiryParam, body: { required: true, content: json(EnquiryPatch) } },
  responses: { 200: { description: "The enquiry", content: json(EnquiryDetail) }, ...admin, 409: writeErrors[409], 422: writeErrors[422] },
});

const enquiryStatusRoute = createRoute({
  method: "post",
  path: "/sponsor-enquiries/{id}/status",
  tags,
  summary: "Move an enquiry along the pipeline",
  description:
    "New enquiry, contacted, negotiation, proposal sent, confirmed or declined. Confirming opens a payment for the enquiry's value, emails the sponsor the payment instructions, and counts against the option's capacity (refused when its places are taken). Declining cancels a payment that was never paid.",
  request: { params: EnquiryParam, body: { required: true, content: json(EnquiryStatusBody) } },
  responses: { 200: { description: "The enquiry", content: json(EnquiryDetail) }, ...admin, 409: writeErrors[409], 422: writeErrors[422] },
});

export const summitCommerce = router
  .openapi(listEditionsRoute, async (c) => c.json(await listEditions(await contextFor(c.get("user"))), 200))
  .openapi(createEditionRoute, async (c) => c.json(await createEdition(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(getEditionRoute, async (c) => c.json(await getEdition(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(updateEditionRoute, async (c) =>
    c.json(await updateEdition(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(createProductRoute, async (c) =>
    c.json(await createProduct(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201),
  )
  .openapi(updateProductRoute, async (c) =>
    c.json(await updateProduct(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(listBookingsRoute, async (c) => c.json(await listBookings(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(getBookingRoute, async (c) => c.json(await getBooking(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(approveRoute, async (c) =>
    c.json(await approveBooking(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(rejectRoute, async (c) =>
    c.json(await rejectBooking(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(cancelRoute, async (c) =>
    c.json(await cancelBooking(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(allocationRoute, async (c) =>
    c.json(await allocateBooth(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(confirmRoute, async (c) => c.json(await confirmBooking(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(paymentRoute, async (c) =>
    c.json(await updatePayment(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(evidenceRoute, async (c) => c.json(await evidenceUrl(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(listEnquiriesRoute, async (c) => c.json(await listEnquiries(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(getEnquiryRoute, async (c) => c.json(await getEnquiry(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(updateEnquiryRoute, async (c) =>
    c.json(await updateEnquiry(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  )
  .openapi(enquiryStatusRoute, async (c) =>
    c.json(await changeEnquiryStatus(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200),
  );
