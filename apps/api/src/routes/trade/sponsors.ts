import { createRoute } from "@hono/zod-openapi";
import {
  AddSponsorMemberBody,
  ConsentParam,
  ConsentQuery,
  ConsentView,
  CreateSponsorBody,
  GrantConsentBody,
  SponsorCohortDetail,
  SponsorCohortList,
  SponsorCohortParam,
  SponsorList,
  SponsorMemberParam,
  SponsorParam,
  SponsorSmeParam,
  SponsorSmeView,
  SponsorView,
} from "../../schemas/trade";
import {
  addSponsorMember,
  createSponsor,
  getSponsor,
  getSponsorCohort,
  getSponsorSme,
  grantConsent,
  listConsents,
  listSponsorCohorts,
  listSponsors,
  removeSponsorMember,
  withdrawConsent,
} from "../../services/trade-sponsors";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

// Sponsor organisations, what they see, and what an SME agrees to share with them (#70).

const tags = ["TRADE sponsors"];
const sponsors = clearRouter("trade");
const forbidden = problem("The caller's role can't do this");

const createRoute_ = createRoute({
  method: "post",
  path: "/sponsors",
  tags,
  summary: "Create a sponsor organisation",
  description: "An Entrust administrator creates the organisation, with TRADE access, and can name its first administrator (someone who already has an account).",
  request: { body: { content: json(CreateSponsorBody), required: true } },
  responses: { 201: { description: "The sponsor", content: json(SponsorView) }, ...writeErrors, 403: forbidden },
});

const listRoute = createRoute({
  method: "get",
  path: "/sponsors",
  tags,
  summary: "List the sponsor organisations",
  description: "For Entrust staff.",
  responses: { 200: { description: "The sponsors", content: json(SponsorList) }, ...listErrors, 403: forbidden },
});

const getRoute = createRoute({
  method: "get",
  path: "/sponsors/{id}",
  tags,
  summary: "View a sponsor and its people",
  request: { params: SponsorParam },
  responses: { 200: { description: "The sponsor", content: json(SponsorView) }, ...listErrors },
});

const addMemberRoute = createRoute({
  method: "post",
  path: "/sponsors/{id}/members",
  tags,
  summary: "Add a colleague to a sponsor",
  description: "An Entrust administrator or an administrator of the sponsor adds someone who already has an account, as `sponsor_admin` or `sponsor_viewer`. A viewer only reads.",
  request: { params: SponsorParam, body: { content: json(AddSponsorMemberBody), required: true } },
  responses: { 200: { description: "The sponsor", content: json(SponsorView) }, ...writeErrors, 403: forbidden },
});

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/sponsors/{id}/members/{userId}",
  tags,
  summary: "Remove someone from a sponsor",
  description: "The last administrator can't be removed, and nobody removes themselves.",
  request: { params: SponsorMemberParam },
  responses: { 200: { description: "The sponsor", content: json(SponsorView) }, ...writeErrors, 403: forbidden },
});

const cohortsRoute = createRoute({
  method: "get",
  path: "/sponsor/cohorts",
  tags,
  summary: "The cohorts a sponsor sponsors",
  description: "For sponsor users. Figures name nobody. Someone who isn't in a sponsor organisation gets 404.",
  responses: { 200: { description: "The cohorts", content: json(SponsorCohortList) }, ...listErrors },
});

const cohortRoute = createRoute({
  method: "get",
  path: "/sponsor/cohorts/{id}",
  tags,
  summary: "A sponsored cohort",
  description: "The figures, and the SMEs whose owners agreed to share something with this sponsor. A cohort that another organisation sponsors is 404.",
  request: { params: SponsorCohortParam },
  responses: { 200: { description: "The cohort", content: json(SponsorCohortDetail) }, ...listErrors },
});

const smeRoute = createRoute({
  method: "get",
  path: "/sponsor/cohorts/{id}/smes/{organizationId}",
  tags,
  summary: "A named SME",
  description:
    "Only the kinds of data the SME's owner agreed to share. With no live agreement the SME is 404. Each view is written to the audit log with what was shown.",
  request: { params: SponsorSmeParam },
  responses: { 200: { description: "The SME", content: json(SponsorSmeView) }, ...listErrors },
});

const consentsRoute = createRoute({
  method: "get",
  path: "/consents",
  tags,
  summary: "What an organisation shares with its sponsors",
  description: "For each sponsor of the cohorts the organisation is enrolled in, every kind of data with the words the owner agrees to, and whether it is granted now.",
  request: { query: ConsentQuery },
  responses: { 200: { description: "The consents", content: json(ConsentView) }, ...listErrors },
});

const grantRoute = createRoute({
  method: "post",
  path: "/consents",
  tags,
  summary: "Agree to share",
  description: "The owner of the organisation agrees to share kinds of data with a sponsor of one of its cohorts. The words agreed to are stored.",
  request: { body: { content: json(GrantConsentBody), required: true } },
  responses: { 200: { description: "The consents", content: json(ConsentView) }, ...writeErrors, 403: forbidden },
});

const withdrawRoute = createRoute({
  method: "post",
  path: "/consents/{id}/withdraw",
  tags,
  summary: "Take back an agreement",
  description: "Stops at once: the sponsor's next request no longer sees the data.",
  request: { params: ConsentParam },
  responses: { 200: { description: "The consents", content: json(ConsentView) }, ...writeErrors, 403: forbidden },
});

export const tradeSponsors = sponsors
  .openapi(createRoute_, async (c) => c.json(await createSponsor(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(listRoute, async (c) => c.json({ items: await listSponsors(await contextFor(c.get("user"))) }, 200))
  .openapi(getRoute, async (c) => c.json(await getSponsor(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(addMemberRoute, async (c) => c.json(await addSponsorMember(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(removeMemberRoute, async (c) => {
    const { id, userId } = c.req.valid("param");
    return c.json(await removeSponsorMember(await contextFor(c.get("user")), id, userId), 200);
  })
  .openapi(cohortsRoute, async (c) => c.json(await listSponsorCohorts(await contextFor(c.get("user"))), 200))
  .openapi(cohortRoute, async (c) => c.json(await getSponsorCohort(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(smeRoute, async (c) => {
    const { id, organizationId } = c.req.valid("param");
    return c.json(await getSponsorSme(await contextFor(c.get("user")), id, organizationId), 200);
  })
  .openapi(consentsRoute, async (c) => c.json(await listConsents(await contextFor(c.get("user")), c.req.valid("query").organizationId), 200))
  .openapi(grantRoute, async (c) => c.json(await grantConsent(await contextFor(c.get("user")), c.req.valid("json")), 200))
  .openapi(withdrawRoute, async (c) => c.json(await withdrawConsent(await contextFor(c.get("user")), c.req.valid("param").id), 200));
