import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../app";
import {
  AdminProduct,
  Catalogue,
  EditionBody,
  EditionDetail,
  EditionList,
  EditionParam,
  EditionPatch,
  ProductBody,
  ProductParam,
  ProductPatch,
} from "../schemas/summit-commerce";
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

export const summitCommercePublic = publicRouter.openapi(catalogueRoute, async (c) => c.json(await publicCatalogue({ db: getDb() }), 200));

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
  );
