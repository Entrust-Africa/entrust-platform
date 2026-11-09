import { createRoute, z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import {
  addExportHistory,
  addProduct,
  businessProfileHistory,
  getBusinessProfile,
  listExportHistory,
  listPathwayReviews,
  listProducts,
  PROFILE_FIELDS,
  resolvePathwayReview,
  updateBusinessProfile,
  updateExportHistory,
  updateProduct,
  type ProfileField,
} from "../../services/trade-sme-record";
import { getReadinessProfiles, READINESS_AREAS } from "../../services/trade-readiness";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE SME record"];
const router = clearRouter("trade");

const org = z.object({ organizationId: z.string().optional() });
const text = z.string().trim().max(2000);
const optionalText = text.nullable().optional();
const id = z.object({ id: z.uuid() });

const Shipment = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    transactionId: z.string().nullable(),
    product: z.string(),
    destination: z.string().nullable(),
    buyerName: z.string().nullable(),
    shipmentDate: z.string().nullable(),
    evidenceStatus: z.enum(schema.EXPORT_EVIDENCE_STATUSES),
    evidenceNote: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("TradeShipment");
const ShipmentList = z.object({ organizationId: z.string(), items: z.array(Shipment) }).openapi("TradeShipmentList");
const ShipmentBody = z
  .object({
    organizationId: z.string().optional(),
    product: text.min(1, "Say what was shipped"),
    destination: optionalText,
    buyerName: optionalText,
    shipmentDate: z.iso.date().nullable().optional(),
    evidenceStatus: z.enum(schema.EXPORT_EVIDENCE_STATUSES).optional(),
    evidenceNote: optionalText,
  })
  .openapi("TradeShipmentBody");
const ShipmentPatch = z
  .object({
    product: text.min(1).optional(),
    destination: optionalText,
    buyerName: optionalText,
    shipmentDate: z.iso.date().nullable().optional(),
    evidenceStatus: z.enum(schema.EXPORT_EVIDENCE_STATUSES).optional(),
    evidenceNote: optionalText,
  })
  .openapi("TradeShipmentPatch");

const Review = z
  .object({
    id: z.string(),
    enrollmentId: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    cohortId: z.string(),
    status: z.enum(schema.PATHWAY_REVIEW_STATUSES),
    shipment: z.object({ product: z.string(), evidenceStatus: z.string() }).nullable(),
    resolution: z.string().nullable(),
    createdAt: z.string(),
    resolvedAt: z.string().nullable(),
  })
  .openapi("TradePathwayReview");

const Product = z
  .object({ id: z.string(), organizationId: z.string(), name: z.string(), description: z.string().nullable(), category: z.string().nullable(), hsCode: z.string().nullable(), archived: z.boolean(), createdAt: z.string() })
  .openapi("TradeProduct");
const ProductBody = z.object({ organizationId: z.string().optional(), name: text.min(1, "Name the product"), description: optionalText, category: optionalText, hsCode: z.string().trim().max(20).nullable().optional() }).openapi("TradeProductBody");
const ProductPatch = z.object({ name: text.min(1).optional(), description: optionalText, category: optionalText, hsCode: z.string().trim().max(20).nullable().optional(), archived: z.boolean().optional() }).openapi("TradeProductPatch");

const profileScalar = z.union([z.string(), z.number(), z.boolean()]).nullable();
const Profile = z.object({ organizationId: z.string(), smeId: z.string(), country: z.string() }).catchall(profileScalar).openapi("TradeBusinessProfile");
const ProfilePatch = z
  .object({
    organizationId: z.string().optional(),
    changes: z
      .object({
        legalName: text.min(1).optional(),
        tradingName: optionalText,
        registrationNumber: optionalText,
        tin: optionalText,
        sector: optionalText,
        yearEstablished: z.number().int().min(1800).max(2100).nullable().optional(),
        ownershipType: optionalText,
        businessEmail: z.email().nullable().optional(),
        businessPhone: optionalText,
        address: optionalText,
        website: optionalText,
        socialPages: optionalText,
        mainActivity: optionalText,
        permanentEmployees: z.number().int().min(0).nullable().optional(),
        temporaryEmployees: z.number().int().min(0).nullable().optional(),
        womanOwned: z.boolean().nullable().optional(),
        premises: optionalText,
      })
      .strict(),
  })
  .openapi("TradeBusinessProfilePatch");
const History = z
  .object({
    organizationId: z.string(),
    items: z.array(z.object({ id: z.string(), field: z.string(), label: z.string(), oldValue: z.string().nullable(), newValue: z.string().nullable(), material: z.boolean(), changedBy: z.string().nullable(), changedAt: z.string() })),
  })
  .openapi("TradeBusinessProfileHistory");

const ok = (description: string, schema: z.ZodType) => ({ description, content: json(schema) });

const historyList = createRoute({ method: "get", path: "/export-history", tags, summary: "A business's completed shipments", request: { query: org }, responses: { 200: ok("Shipments", ShipmentList), ...listErrors } });
const historyAdd = createRoute({
  method: "post",
  path: "/export-history",
  tags,
  summary: "Record an earlier completed shipment",
  description: "A business reports it as self-reported. Only staff can record one as supported by documents or independently verified. Closing out a real transaction records its shipment on its own.",
  request: { body: { content: json(ShipmentBody), required: true } },
  responses: { 201: ok("The shipment", Shipment), ...writeErrors },
});
const historyUpdate = createRoute({
  method: "patch",
  path: "/export-history/{id}",
  tags,
  summary: "Correct a shipment, or set how far it has been checked",
  request: { params: id, body: { content: json(ShipmentPatch), required: true } },
  responses: { 200: ok("The shipment", Shipment), ...writeErrors },
});
const reviewList = createRoute({
  method: "get",
  path: "/pathway-reviews",
  tags,
  summary: "Pathway reviews raised by a first completed shipment",
  description: "Staff only. A review asks staff to look at an enrolment's pathway. It never changes the pathway.",
  request: { query: z.object({ cohortId: z.uuid().optional(), status: z.enum(schema.PATHWAY_REVIEW_STATUSES).optional() }) },
  responses: { 200: ok("Reviews", z.object({ items: z.array(Review) })), ...listErrors },
});
const reviewResolve = createRoute({
  method: "post",
  path: "/pathway-reviews/{id}/resolve",
  tags,
  summary: "Record that staff have looked at the pathway",
  request: { params: id, body: { content: json(z.object({ resolution: text.min(1, "Say what you decided") })), required: true } },
  responses: { 200: ok("The review", Review), ...writeErrors },
});
const productList = createRoute({ method: "get", path: "/products", tags, summary: "A business's products", request: { query: org.extend({ includeArchived: z.coerce.boolean().optional() }) }, responses: { 200: ok("Products", z.object({ organizationId: z.string(), items: z.array(Product) })), ...listErrors } });
const productAdd = createRoute({ method: "post", path: "/products", tags, summary: "Add a product", request: { body: { content: json(ProductBody), required: true } }, responses: { 201: ok("The product", Product), ...writeErrors } });
const productUpdate = createRoute({ method: "patch", path: "/products/{id}", tags, summary: "Change or archive a product", request: { params: id, body: { content: json(ProductPatch), required: true } }, responses: { 200: ok("The product", Product), ...writeErrors } });
const profileGet = createRoute({ method: "get", path: "/business-profile", tags, summary: "A business's profile", request: { query: org }, responses: { 200: ok("The profile", Profile), ...listErrors } });
const profilePatch = createRoute({
  method: "patch",
  path: "/business-profile",
  tags,
  summary: "Correct the business's details",
  description: "Every change is kept in the history. A change to the legal name, registration number, tax number or sector is marked material.",
  request: { body: { content: json(ProfilePatch), required: true } },
  responses: { 200: ok("The profile", Profile), ...writeErrors },
});
const profileHistory = createRoute({ method: "get", path: "/business-profile/history", tags, summary: "Changes to the business's details", request: { query: org }, responses: { 200: ok("The history", History), ...listErrors } });

const Area = z.object({
  area: z.enum(READINESS_AREAS),
  label: z.string(),
  score: z.number().nullable(),
  classification: z.string().nullable(),
  evidenceCoverage: z.number().nullable(),
  reviewStatus: z.enum(["not_assessed", "complete", "awaiting_staff_review", "awaiting_ethiolife_review"]),
  assessmentId: z.string().nullable(),
  assessedAt: z.string().nullable(),
  sections: z.array(z.object({ section: z.string(), score: z.number().nullable(), band: z.string().nullable(), evidenceStatus: z.string() })),
});
const Readiness = z.object({ organizationId: z.string(), current: z.array(Area), earlier: z.array(Area).nullable(), note: z.string() }).openapi("TradeReadinessProfiles");
const readiness = createRoute({
  method: "get",
  path: "/readiness-profiles",
  tags,
  summary: "A business's six readiness profiles",
  description: "Financial, insurance and risk, production and operations, market and buyers, export execution, management and digital. Each has its own result. They are never combined into a single score. When an exit assessment exists, the placement result is returned as `earlier` to compare with.",
  request: { query: org },
  responses: { 200: ok("The profiles", Readiness), ...listErrors },
});

export const PROFILE_FIELD_NAMES = Object.keys(PROFILE_FIELDS) as ProfileField[];

export const tradeSmeRecord = router
  .openapi(historyList, async (c) => c.json(await listExportHistory(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(historyAdd, async (c) => c.json(await addExportHistory(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(historyUpdate, async (c) => c.json(await updateExportHistory(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(reviewList, async (c) => c.json(await listPathwayReviews(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(reviewResolve, async (c) => c.json(await resolvePathwayReview(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(productList, async (c) => c.json(await listProducts(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(productAdd, async (c) => c.json(await addProduct(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(productUpdate, async (c) => c.json(await updateProduct(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(profileGet, async (c) => c.json(await getBusinessProfile(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(profilePatch, async (c) => {
    const { organizationId, changes } = c.req.valid("json");
    return c.json(await updateBusinessProfile(await contextFor(c.get("user")), { organizationId, changes }), 200);
  })
  .openapi(profileHistory, async (c) => c.json(await businessProfileHistory(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(readiness, async (c) => c.json(await getReadinessProfiles(await contextFor(c.get("user")), c.req.valid("query")), 200));
