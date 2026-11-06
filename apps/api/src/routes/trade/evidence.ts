import { createRoute } from "@hono/zod-openapi";
import {
  CreateEvidenceBody,
  EvidenceListQuery,
  EvidenceParam,
  EvidenceRecordList,
  EvidenceRecordSchema,
  RequestEvidenceBody,
  ReviewEvidenceBody,
} from "../../schemas/trade";
import {
  createEvidence,
  listEvidence,
  requestEvidence,
  reviewEvidence,
} from "../../services/trade-evidence";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE evidence"];
const router = clearRouter("trade");

const listEvidenceRoute = createRoute({
  method: "get",
  path: "/evidence",
  tags,
  summary: "List evidence records",
  description:
    "Evidence records submitted by SMEs or requested by Entrust staff, with optional filters by organization, enrollment, target, and status.",
  request: { query: EvidenceListQuery },
  responses: {
    200: { description: "List of evidence records", content: json(EvidenceRecordList) },
    ...listErrors,
  },
});

const createEvidenceRoute = createRoute({
  method: "post",
  path: "/evidence",
  tags,
  summary: "Submit an evidence record",
  description: "Uploads or references evidence against a target (question, module, exemption).",
  request: { body: { content: json(CreateEvidenceBody), required: true } },
  responses: {
    201: { description: "The created evidence record", content: json(EvidenceRecordSchema) },
    ...writeErrors,
  },
});

const reviewEvidenceRoute = createRoute({
  method: "post",
  path: "/evidence/{id}/review",
  tags,
  summary: "Review an evidence record",
  description:
    "Entrust staff reviews an evidence submission, setting status to accepted, rejected, or resubmission_required. A comment is required on rejection.",
  request: {
    params: EvidenceParam,
    body: { content: json(ReviewEvidenceBody), required: true },
  },
  responses: {
    200: { description: "The reviewed evidence record", content: json(EvidenceRecordSchema) },
    ...writeErrors,
  },
});

const requestEvidenceRoute = createRoute({
  method: "post",
  path: "/evidence/request",
  tags,
  summary: "Request evidence from an SME",
  description: "Entrust staff requests supporting documentation or clarification from an SME.",
  request: { body: { content: json(RequestEvidenceBody), required: true } },
  responses: {
    201: { description: "The requested evidence record", content: json(EvidenceRecordSchema) },
    ...writeErrors,
  },
});

export const tradeEvidence = router
  .openapi(listEvidenceRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const items = await listEvidence(ctx, c.req.valid("query"));
    return c.json({ items }, 200);
  })
  .openapi(createEvidenceRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const created = await createEvidence(ctx, c.req.valid("json"));
    return c.json(created, 201);
  })
  .openapi(reviewEvidenceRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const reviewed = await reviewEvidence(ctx, id, c.req.valid("json"));
    return c.json(reviewed, 200);
  })
  .openapi(requestEvidenceRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const requested = await requestEvidence(ctx, c.req.valid("json"));
    return c.json(requested, 201);
  });
