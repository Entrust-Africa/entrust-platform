import { createRoute, z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { addActionEvidence, archiveResource, attachToOutput, createResource, listActionEvidence, listResources, outputVersionDetails, removeActionEvidence, removeOutputAttachment, resourceDownload, reviewOutput } from "../../services/trade-outputs";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE outputs, evidence and resources"];
const router = clearRouter("trade");
const ok = (description: string, schema: z.ZodType) => ({ description, content: json(schema) });
const text = z.string().trim().max(2000);
const id = z.object({ id: z.uuid() });
const FileRef = z.object({ id: z.string(), name: z.string(), contentType: z.string(), sizeBytes: z.number(), scanStatus: z.enum(schema.FILE_SCAN_STATUSES) });
const Attach = z.object({ fileId: z.uuid(), description: text.nullable().optional() });

const Details = z
  .object({
    versionId: z.string(),
    status: z.string(),
    attachments: z.array(z.object({ id: z.string(), description: z.string().nullable(), file: FileRef, createdAt: z.string() })),
    review: z.object({ status: z.enum(schema.OUTPUT_REVIEW_STATUSES), comments: z.string().nullable(), reviewedAt: z.string().nullable() }),
  })
  .openapi("TradeOutputVersionDetails");
const Evidence = z.object({ items: z.array(z.object({ id: z.string(), description: z.string().nullable(), file: FileRef, submittedAt: z.string() })) }).openapi("TradeActionEvidence");
const Resource = z
  .object({ id: z.string(), moduleId: z.string(), lessonId: z.string().nullable(), name: z.string(), resourceType: z.enum(schema.RESOURCE_TYPES), version: z.string(), accessLevel: z.enum(schema.RESOURCE_ACCESS_LEVELS), archived: z.boolean(), file: z.object({ name: z.string(), contentType: z.string(), sizeBytes: z.number() }) })
  .openapi("TradeLearningResource");

const details = createRoute({ method: "get", path: "/worksheet-versions/{id}/details", tags, summary: "An output version's attachments and review", request: { params: id }, responses: { 200: ok("Details", Details), ...listErrors } });
const attach = createRoute({ method: "post", path: "/worksheet-versions/{id}/attachments", tags, summary: "Attach one of the business's files to a draft output", request: { params: id, body: { content: json(Attach), required: true } }, responses: { 201: ok("Details", Details), ...writeErrors } });
const detach = createRoute({ method: "delete", path: "/worksheet-versions/{id}/attachments/{attachmentId}", tags, summary: "Remove an attachment from a draft output", request: { params: z.object({ id: z.uuid(), attachmentId: z.uuid() }) }, responses: { 200: ok("Details", Details), ...writeErrors } });
const review = createRoute({ method: "post", path: "/worksheet-versions/{id}/review", tags, summary: "Review a submitted output version", description: "Staff only. Sending it back needs comments, and the business is told.", request: { params: id, body: { content: json(z.object({ status: z.enum(["under_review", "reviewed", "changes_requested"]), comments: text.nullable().optional() })), required: true } }, responses: { 200: ok("Details", Details), ...writeErrors } });
const evidenceList = createRoute({ method: "get", path: "/action-plan/items/{id}/evidence", tags, summary: "Evidence files on an action item", request: { params: id }, responses: { 200: ok("Evidence", Evidence), ...listErrors } });
const evidenceAdd = createRoute({ method: "post", path: "/action-plan/items/{id}/evidence", tags, summary: "Attach a file as evidence that an action was done", request: { params: id, body: { content: json(Attach), required: true } }, responses: { 201: ok("Evidence", Evidence), ...writeErrors } });
const evidenceRemove = createRoute({ method: "delete", path: "/action-plan/items/{id}/evidence/{evidenceId}", tags, summary: "Remove evidence from an action item", request: { params: z.object({ id: z.uuid(), evidenceId: z.uuid() }) }, responses: { 200: ok("Evidence", Evidence), ...writeErrors } });
const resourceList = createRoute({ method: "get", path: "/modules/{id}/resources", tags, summary: "A module's downloadable resources", description: "A learner sees the learner resources of a module they can open. Staff also see staff resources and, on request, archived ones.", request: { params: z.object({ id: z.string() }), query: z.object({ includeArchived: z.coerce.boolean().optional() }) }, responses: { 200: ok("Resources", z.object({ items: z.array(Resource) })), ...listErrors } });
const resourceAdd = createRoute({ method: "post", path: "/modules/{id}/resources", tags, summary: "Add a resource to a module", description: "Super Admin or Cohort Manager. The file must be one uploaded to Entrust's own organisation.", request: { params: z.object({ id: z.string() }), body: { content: json(z.object({ lessonId: text.nullable().optional(), name: text.min(1, "Name the resource"), fileId: z.uuid(), resourceType: z.enum(schema.RESOURCE_TYPES), version: text.optional(), accessLevel: z.enum(schema.RESOURCE_ACCESS_LEVELS) })), required: true } }, responses: { 201: ok("The resource", Resource), ...writeErrors } });
const resourceDownloadRoute = createRoute({ method: "get", path: "/resources/{id}/download-url", tags, summary: "A short-lived link to download a resource", request: { params: id }, responses: { 200: ok("The link", z.object({ downloadUrl: z.string(), expiresInSeconds: z.number(), fileName: z.string() })), ...listErrors } });
const resourceArchive = createRoute({ method: "delete", path: "/resources/{id}", tags, summary: "Archive a resource", request: { params: id }, responses: { 200: ok("Archived", z.object({ ok: z.literal(true) })), ...writeErrors } });

export const tradeOutputs = router
  .openapi(details, async (c) => c.json(await outputVersionDetails(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(attach, async (c) => c.json(await attachToOutput(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201))
  .openapi(detach, async (c) => c.json(await removeOutputAttachment(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("param").attachmentId), 200))
  .openapi(review, async (c) => c.json(await reviewOutput(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(evidenceList, async (c) => c.json(await listActionEvidence(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(evidenceAdd, async (c) => c.json(await addActionEvidence(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201))
  .openapi(evidenceRemove, async (c) => c.json(await removeActionEvidence(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("param").evidenceId), 200))
  .openapi(resourceList, async (c) => c.json(await listResources(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query")), 200))
  .openapi(resourceAdd, async (c) => c.json(await createResource(await contextFor(c.get("user")), { moduleId: c.req.valid("param").id, ...c.req.valid("json") }), 201))
  .openapi(resourceDownloadRoute, async (c) => c.json(await resourceDownload(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(resourceArchive, async (c) => c.json(await archiveResource(await contextFor(c.get("user")), c.req.valid("param").id), 200));
