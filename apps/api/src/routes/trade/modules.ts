import { createRoute } from "@hono/zod-openapi";
import { learnerModuleSchema } from "@entrust/trade-content";
import {
  AdminModuleList,
  AdminModuleVersionDetail,
  ApproveVersionBody,
  CreateDraftVersionBody,
  ModuleDetail,
  ModuleList,
  ModuleParam,
  ModuleQuery,
  ModuleVersionParam,
  UpdateDraftVersionBody,
} from "../../schemas/trade";
import {
  approveModuleVersion,
  createDraftVersion,
  getAdminModulePreview,
  getAdminModuleVersion,
  listAdminModules,
  submitDraftForReview,
  updateDraftVersion,
} from "../../services/trade-content-editor";
import { getTradeModule, listTradeModules } from "../../services/trade-modules";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

const tags = ["TRADE modules"];

const modules = clearRouter("trade");

const forbidden = problem("The caller's organisation doesn't have TRADE access");

const listRoute = createRoute({
  method: "get",
  path: "/modules",
  tags,
  summary: "List the twelve modules",
  description:
    "Every module with its content status. Modules whose content isn't approved yet are \"in production\" for an SME and show only the title and deliverable. Entrust staff also see drafts.",
  responses: { 200: { description: "The modules", content: json(ModuleList) }, ...listErrors, 403: forbidden },
});

const getRoute = createRoute({
  method: "get",
  path: "/modules/{id}",
  tags,
  summary: "View a module",
  description:
    "The newest version the caller can open, or the one named in `version`. A learner keeps the version they started, so callers pass it to stay on it. An SME never receives answer keys or staff-only material.",
  request: { params: ModuleParam, query: ModuleQuery },
  responses: {
    200: { description: "The module and its content", content: json(ModuleDetail) },
    ...listErrors,
    403: forbidden,
    404: problem("No such module or version"),
  },
});

// ---- Staff Course Content Studio Endpoints (#212) ----

const adminListRoute = createRoute({
  method: "get",
  path: "/admin/modules",
  tags,
  summary: "List modules and dynamic versions for content studio",
  description: "Lists all 12 modules and their versions (drafts, in review, approved, archived) for authorized staff.",
  responses: { 200: { description: "Admin module catalogue", content: json(AdminModuleList) }, ...listErrors, 403: forbidden },
});

const adminGetVersionRoute = createRoute({
  method: "get",
  path: "/admin/modules/{id}/versions/{version}",
  tags,
  summary: "Get specific module version details",
  description: "Retrieves complete editable content and validation state for staff.",
  request: { params: ModuleVersionParam },
  responses: {
    200: { description: "Module version details", content: json(AdminModuleVersionDetail) },
    ...listErrors,
    403: forbidden,
    404: problem("Module or version not found"),
  },
});

const adminCreateDraftRoute = createRoute({
  method: "post",
  path: "/admin/modules/{id}/versions",
  tags,
  summary: "Create a new draft version",
  description: "Initializes a new draft version branched from an existing approved version.",
  request: { params: ModuleParam, body: { content: json(CreateDraftVersionBody) } },
  responses: {
    201: { description: "Draft version created", content: json(AdminModuleVersionDetail) },
    ...listErrors,
    403: forbidden,
    404: problem("Source module or version not found"),
    409: problem("Version already exists"),
  },
});

const adminUpdateDraftRoute = createRoute({
  method: "patch",
  path: "/admin/modules/{id}/versions/{version}",
  tags,
  summary: "Update draft version content",
  description: "Updates content for a draft version. Modifications to approved versions are strictly rejected.",
  request: { params: ModuleVersionParam, body: { content: json(UpdateDraftVersionBody) } },
  responses: {
    200: { description: "Draft version updated", content: json(AdminModuleVersionDetail) },
    ...listErrors,
    400: problem("Validation failed"),
    403: forbidden,
    404: problem("Module or version not found"),
    409: problem("Approved versions are immutable"),
  },
});

const adminSubmitReviewRoute = createRoute({
  method: "post",
  path: "/admin/modules/{id}/versions/{version}/submit-review",
  tags,
  summary: "Submit draft for review",
  description: "Validates content and transitions draft to in_review status.",
  request: { params: ModuleVersionParam },
  responses: {
    200: { description: "Submitted for review", content: json(AdminModuleVersionDetail) },
    ...listErrors,
    400: problem("Validation errors prevent submission"),
    403: forbidden,
    404: problem("Module or version not found"),
  },
});

const adminApproveRoute = createRoute({
  method: "post",
  path: "/admin/modules/{id}/versions/{version}/approve",
  tags,
  summary: "Approve module version for production",
  description: "Strictly gated to Super Admin. Locks version into approved state and publishes it.",
  request: { params: ModuleVersionParam, body: { content: json(ApproveVersionBody) } },
  responses: {
    200: { description: "Version approved and locked", content: json(AdminModuleVersionDetail) },
    ...listErrors,
    400: problem("Validation errors prevent approval"),
    403: problem("Only Entrust admin can approve versions"),
    404: problem("Module or version not found"),
    409: problem("Already approved"),
  },
});

const adminPreviewRoute = createRoute({
  method: "get",
  path: "/admin/modules/{id}/versions/{version}/preview",
  tags,
  summary: "Preview learner view of a version",
  description: "Returns sanitized learner view of any version so staff can test learner UX.",
  request: { params: ModuleVersionParam },
  responses: {
    200: { description: "Sanitized learner module view", content: json(learnerModuleSchema) },
    ...listErrors,
    403: forbidden,
    404: problem("Module or version not found"),
  },
});

export const tradeModules = modules
  .openapi(listRoute, async (c) => c.json({ items: await listTradeModules(await contextFor(c.get("user"))) }, 200))
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { version } = c.req.valid("query");
    return c.json(await getTradeModule(await contextFor(c.get("user")), id, version), 200);
  })
  .openapi(adminListRoute, async (c) => {
    const items = await listAdminModules(await contextFor(c.get("user")));
    return c.json({ items }, 200);
  })
  .openapi(adminGetVersionRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    const result = await getAdminModuleVersion(await contextFor(c.get("user")), id, version);
    return c.json(result, 200);
  })
  .openapi(adminCreateDraftRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await createDraftVersion(await contextFor(c.get("user")), id, body);
    return c.json(result, 201);
  })
  .openapi(adminUpdateDraftRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateDraftVersion(await contextFor(c.get("user")), id, version, body);
    return c.json(result, 200);
  })
  .openapi(adminSubmitReviewRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    const result = await submitDraftForReview(await contextFor(c.get("user")), id, version);
    return c.json(result, 200);
  })
  .openapi(adminApproveRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await approveModuleVersion(await contextFor(c.get("user")), id, version, body);
    return c.json(result, 200);
  })
  .openapi(adminPreviewRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    const result = await getAdminModulePreview(await contextFor(c.get("user")), id, version);
    return c.json(result, 200);
  });
