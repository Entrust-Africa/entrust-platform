import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  MINIMUM_SMES_IN_A_FIGURE,
  PIPELINE_STAGES,
  SPONSOR_DATA_KINDS,
  SPONSOR_DISCLAIMER,
  figureIsVisible,
  protectGroup,
  type GroupCell,
  type SponsorDataKind,
} from "@entrust/trade-engine";
import { MODULE_IDS, latestTradeRules } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { recordTradeChange } from "./trade-shared";

// Programme reports (#72): who took part, what capabilities improved and what commercial results followed. Entrust staff
// see everything. A sponsor sees its own cohorts, with no names, and only figures that cover at least five SMEs or SMEs
// that all agreed to share that kind of data. Amounts are always per currency: they are never added across currencies.

const ACTIVE_WITHIN_DAYS = 30;
const M04_BRIEF = "m04-transaction-brief";
const RFQ_STAGE = PIPELINE_STAGES.indexOf("rfq_received");
const SHIPPED_STATUSES = new Set(["shipped", "delivered", "payment_pending", "paid"]);
const SCORE_BUCKETS = [
  { key: "below_40", from: 0, to: 40 },
  { key: "40_to_59", from: 40, to: 60 },
  { key: "60_to_79", from: 60, to: 80 },
  { key: "80_and_above", from: 80, to: Number.POSITIVE_INFINITY },
] as const;

type CohortRow = typeof schema.cohort.$inferSelect;

interface Scope {
  kind: "program" | "cohort";
  id: string;
  name: string;
  program: string;
  cohorts: CohortRow[];
  sponsorIds: ReadonlySet<string> | null;
}

/** The sponsors the caller works for, or null for Entrust staff, who see every cohort. */
function sponsorScope(ctx: Ctx): ReadonlySet<string> | null {
  if (ctx.principal.staffRole) return null;
  const ids = new Set(ctx.principal.sponsorRoles.keys());
  // An SME has no programme reports. The route looks the same to it as one that doesn't exist.
  if (ids.size === 0) throw new ServiceError("not_found", "Report not found.");
  return ids;
}

async function programScope(ctx: Ctx, id: string): Promise<Scope> {
  const sponsorIds = sponsorScope(ctx);
  const [program] = await ctx.db.select().from(schema.program).where(eq(schema.program.id, id));
  if (!program) throw new ServiceError("not_found", "Report not found.");
  const all = await ctx.db.select().from(schema.cohort).where(eq(schema.cohort.programId, id)).orderBy(asc(schema.cohort.startDate), asc(schema.cohort.name));
  const cohorts = sponsorIds ? all.filter((c) => c.sponsorOrganizationId && sponsorIds.has(c.sponsorOrganizationId)) : all;
  if (sponsorIds && cohorts.length === 0) throw new ServiceError("not_found", "Report not found.");
  return { kind: "program", id, name: program.name, program: program.name, cohorts, sponsorIds };
}

async function cohortScope(ctx: Ctx, id: string): Promise<Scope> {
  const sponsorIds = sponsorScope(ctx);
  const [found] = await ctx.db
    .select({ cohort: schema.cohort, program: schema.program.name })
    .from(schema.cohort)
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .where(eq(schema.cohort.id, id));
  // A cohort that someone else sponsors looks the same as one that doesn't exist.
  if (!found || (sponsorIds && !(found.cohort.sponsorOrganizationId && sponsorIds.has(found.cohort.sponsorOrganizationId)))) {
    throw new ServiceError("not_found", "Report not found.");
  }
  return { kind: "cohort", id, name: found.cohort.name, program: found.program, cohorts: [found.cohort], sponsorIds };
}

const toNumber = (value: string | null | undefined): number => (value ? Number(value) : 0);
const round = (value: number): number => Math.round(value * 100) / 100;
const currencyOf = (value: string | null | undefined): string => value ?? "USD";

/** Everything a report is worked out from. */
async function loadFacts(db: Executor, scope: Scope) {
  const cohortIds = scope.cohorts.map((c) => c.id);
  const enrollments = cohortIds.length
    ? await db
        .select({
          id: schema.enrollment.id,
          cohortId: schema.enrollment.cohortId,
          organizationId: schema.enrollment.organizationId,
          status: schema.enrollment.status,
          name: schema.organization.name,
          smeId: schema.smeProfile.smeId,
        })
        .from(schema.enrollment)
        .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
        .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
        .where(inArray(schema.enrollment.cohortId, cohortIds))
        .orderBy(asc(schema.organization.name))
    : [];
  const ids = enrollments.map((e) => e.id);
  const organizations = [...new Set(enrollments.map((e) => e.organizationId))];
  if (ids.length === 0) {
    return { enrollments, pathways: [], scores: [], progress: [], attempts: [], submissions: [], opportunities: [], outcomes: [], briefs: [], consents: [] };
  }
  const [pathways, scores, progress, attempts, submissions, opportunities, outcomes, briefs, consents] = await Promise.all([
    db
      .select({ enrollmentId: schema.pathwayAssignment.enrollmentId, pathway: schema.pathwayAssignment.pathway })
      .from(schema.pathwayAssignment)
      .where(and(inArray(schema.pathwayAssignment.enrollmentId, ids), ne(schema.pathwayAssignment.status, "superseded"))),
    db
      .select({ enrollmentId: schema.tradeAssessment.enrollmentId, kind: schema.tradeAssessment.kind, domain: schema.capabilityScore.domain, score: schema.capabilityScore.score })
      .from(schema.capabilityScore)
      .innerJoin(schema.tradeAssessment, eq(schema.tradeAssessment.id, schema.capabilityScore.assessmentId))
      .where(
        and(
          inArray(schema.tradeAssessment.enrollmentId, ids),
          inArray(schema.tradeAssessment.kind, ["placement", "exit"]),
          ne(schema.tradeAssessment.status, "superseded"),
          eq(schema.capabilityScore.kind, "domain"),
        ),
      )
      .orderBy(asc(schema.tradeAssessment.createdAt)),
    db
      .select({ enrollmentId: schema.moduleProgress.enrollmentId, moduleId: schema.moduleProgress.moduleId, status: schema.moduleProgress.status, updatedAt: schema.moduleProgress.updatedAt })
      .from(schema.moduleProgress)
      .where(inArray(schema.moduleProgress.enrollmentId, ids)),
    db
      .select({ enrollmentId: schema.knowledgeCheckAttempt.enrollmentId, moduleId: schema.knowledgeCheckAttempt.moduleId, passed: schema.knowledgeCheckAttempt.passed })
      .from(schema.knowledgeCheckAttempt)
      .where(inArray(schema.knowledgeCheckAttempt.enrollmentId, ids)),
    db
      .select({ enrollmentId: schema.moduleSubmission.enrollmentId })
      .from(schema.moduleSubmission)
      .where(and(inArray(schema.moduleSubmission.enrollmentId, ids), eq(schema.moduleSubmission.status, "submitted"))),
    db
      .select({
        organizationId: schema.commercialOpportunity.organizationId,
        enrollmentId: schema.commercialOpportunity.enrollmentId,
        stage: schema.commercialOpportunity.stage,
        verificationStatus: schema.commercialOpportunity.verificationStatus,
      })
      .from(schema.commercialOpportunity)
      .where(inArray(schema.commercialOpportunity.organizationId, organizations)),
    db.select().from(schema.outcome).where(inArray(schema.outcome.organizationId, organizations)),
    db
      .select({ enrollmentId: schema.worksheetVersion.enrollmentId, version: schema.worksheetVersion.version, values: schema.worksheetVersion.values, result: schema.worksheetVersion.result })
      .from(schema.worksheetVersion)
      .where(and(inArray(schema.worksheetVersion.enrollmentId, ids), eq(schema.worksheetVersion.worksheetId, M04_BRIEF), eq(schema.worksheetVersion.status, "submitted")))
      .orderBy(desc(schema.worksheetVersion.version)),
    scope.sponsorIds
      ? db
          .select({ sponsorId: schema.sponsorConsent.sponsorOrganizationId, organizationId: schema.sponsorConsent.smeOrganizationId, kind: schema.sponsorConsent.kind })
          .from(schema.sponsorConsent)
          .where(
            and(
              inArray(schema.sponsorConsent.sponsorOrganizationId, [...scope.sponsorIds]),
              inArray(schema.sponsorConsent.smeOrganizationId, organizations),
              isNull(schema.sponsorConsent.withdrawnAt),
              inArray(schema.sponsorConsent.kind, [...SPONSOR_DATA_KINDS]),
            ),
          )
      : Promise.resolve([] as { sponsorId: string; organizationId: string; kind: string }[]),
  ]);
  return { enrollments, pathways, scores, progress, attempts, submissions, opportunities, outcomes, briefs, consents };
}

type Facts = Awaited<ReturnType<typeof loadFacts>>;

interface Total {
  count: number;
  amount: number;
  smes: Set<string>;
}

const emptyTotal = (): Total => ({ count: 0, amount: 0, smes: new Set() });

function addTo(total: Total, organizationId: string, amount: number): void {
  total.count += 1;
  total.amount += amount;
  total.smes.add(organizationId);
}

/** Works a report out from its facts, as the caller may see it. */
function buildReport(scope: Scope, facts: Facts, now: Date) {
  const isStaff = scope.sponsorIds === null;
  const { enrollments } = facts;
  const organizationOf = new Map(enrollments.map((e) => [e.id, e.organizationId]));
  const allOrganizations = new Set(enrollments.map((e) => e.organizationId));
  const smesOf = (rows: readonly { enrollmentId: string }[]) => new Set(rows.flatMap((r) => organizationOf.get(r.enrollmentId) ?? []));

  // An agreement counts only with the sponsor of a cohort the SME is in.
  const sponsorOf = new Map(scope.cohorts.map((c) => [c.id, c.sponsorOrganizationId]));
  const sponsorsOfSme = new Map<string, Set<string>>();
  for (const e of enrollments) {
    const sponsor = sponsorOf.get(e.cohortId);
    if (sponsor) sponsorsOfSme.set(e.organizationId, (sponsorsOfSme.get(e.organizationId) ?? new Set()).add(sponsor));
  }
  const consenting = new Map<SponsorDataKind, Set<string>>(SPONSOR_DATA_KINDS.map((k) => [k, new Set<string>()]));
  for (const c of facts.consents) {
    if (sponsorsOfSme.get(c.organizationId)?.has(c.sponsorId)) consenting.get(c.kind as SponsorDataKind)?.add(c.organizationId);
  }

  const canSee = (smes: ReadonlySet<string>, kind: SponsorDataKind) => isStaff || figureIsVisible(smes, consenting.get(kind)!);
  const shown = (value: number, smes: ReadonlySet<string>, kind: SponsorDataKind) => (canSee(smes, kind) ? value : null);
  const shownGroup = (cells: readonly GroupCell[], kind: SponsorDataKind, totalIsVisible = true): (number | null)[] =>
    isStaff ? cells.map((c) => c.value) : protectGroup(cells, consenting.get(kind)!, totalIsVisible);

  // ---- Reach ----
  const reachKind = "placement_results" as const;
  const byStatus = (["invited", "registered", "active", "paused", "completed", "withdrawn"] as const).map((status) => {
    const rows = enrollments.filter((e) => e.status === status);
    return { status, value: rows.length, smes: new Set(rows.map((r) => r.organizationId)) };
  });
  const statusCounts = shownGroup(byStatus, reachKind, canSee(allOrganizations, reachKind));
  const pathwayCells = (["A", "B"] as const).map((pathway) => {
    const rows = facts.pathways.filter((p) => p.pathway === pathway);
    return { value: rows.length, smes: smesOf(rows) };
  });
  const [pathwayA, pathwayB] = shownGroup(pathwayCells, reachKind);

  // ---- Engagement ----
  const progressKind = "learning_progress" as const;
  const activeSince = now.getTime() - ACTIVE_WITHIN_DAYS * 24 * 60 * 60 * 1000;
  const active = smesOf(facts.progress.filter((p) => p.status !== "not_started" && p.updatedAt.getTime() >= activeSince));
  const modules = MODULE_IDS.map((moduleId) => {
    const rows = facts.progress.filter((p) => p.moduleId === moduleId);
    const started = smesOf(rows.filter((p) => p.status !== "not_started"));
    const passed = smesOf(rows.filter((p) => p.status === "passed" || p.status === "exempted"));
    return { moduleId, started: shown(started.size, started, progressKind), passed: shown(passed.size, passed, progressKind) };
  });
  const knowledgeChecks = MODULE_IDS.flatMap((moduleId) => {
    const rows = facts.attempts.filter((a) => a.moduleId === moduleId);
    if (rows.length === 0) return [];
    const attempted = smesOf(rows);
    const passed = smesOf(rows.filter((a) => a.passed));
    const notPassed = new Set([...attempted].filter((sme) => !passed.has(sme)));
    const [shownPassed, shownNotPassed] = shownGroup([{ value: passed.size, smes: passed }, { value: notPassed.size, smes: notPassed }], progressKind, canSee(attempted, progressKind));
    const rate = shownPassed != null && shownNotPassed != null ? Math.round((passed.size / attempted.size) * 100) : null;
    return [{ moduleId, attempted: shown(attempted.size, attempted, progressKind), passed: shownPassed ?? null, passRate: rate }];
  });
  const waiting = smesOf(facts.submissions);

  // ---- Capability ----
  const scoreKind = "placement_results" as const;
  const distribution = (domain: string, kind: "placement" | "exit") => {
    // The newest assessment of an enrolment counts. The rows come oldest first.
    const latest = new Map<string, number>();
    for (const s of facts.scores) if (s.domain === domain && s.kind === kind && s.score !== null) latest.set(s.enrollmentId, Number(s.score));
    const scored = [...latest.entries()];
    const smes = smesOf(scored.map(([enrollmentId]) => ({ enrollmentId })));
    const visible = canSee(smes, scoreKind);
    const cells = SCORE_BUCKETS.map((bucket) => {
      const inBucket = scored.filter(([, score]) => score >= bucket.from && score < bucket.to);
      return { value: inBucket.length, smes: smesOf(inBucket.map(([enrollmentId]) => ({ enrollmentId }))) };
    });
    const counts = shownGroup(cells, scoreKind, visible);
    return {
      smes: visible ? smes.size : null,
      average: visible && scored.length ? round(scored.reduce((sum, [, score]) => sum + score, 0) / scored.length) : null,
      buckets: SCORE_BUCKETS.map((bucket, i) => ({ bucket: bucket.key, count: counts[i] ?? null })),
    };
  };
  const capability = latestTradeRules().domains.map((domain) => ({
    domain: domain.id,
    title: domain.title,
    placement: distribution(domain.id, "placement"),
    exit: distribution(domain.id, "exit"),
  }));

  // ---- Pipeline, finance and export execution ----
  const outcomesKind = "commercial_outcomes" as const;
  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  // A record with no enrolment on it belongs to the business, so it counts wherever the business is enrolled.
  const inScope = <T extends { enrollmentId: string | null }>(rows: readonly T[]) => rows.filter((r) => r.enrollmentId === null || enrollmentIds.has(r.enrollmentId));
  const opportunities = inScope(facts.opportunities);
  const outcomes = inScope(facts.outcomes);
  const countOpportunities = (test: (o: (typeof opportunities)[number]) => boolean) => {
    const rows = opportunities.filter(test);
    return shown(rows.length, new Set(rows.map((r) => r.organizationId)), outcomesKind);
  };
  const live = (stage: string) => stage !== "closed_lost" && stage !== "disqualified";
  const pipeline = {
    leads: countOpportunities(() => true),
    verifiedLeads: countOpportunities((o) => o.verificationStatus !== "unverified"),
    qualifiedProspects: countOpportunities((o) => o.verificationStatus === "qualified_opportunity"),
    rfqs: countOpportunities((o) => live(o.stage) && PIPELINE_STAGES.indexOf(o.stage) >= RFQ_STAGE),
    firmOrders: countOpportunities((o) => o.stage === "firm_order_secured"),
  };

  const financeTotals = new Map<string, { requests: Total; approvals: Total; disbursements: Total }>();
  const exportTotals = new Map<string, { shipments: Total; payments: Total }>();
  for (const o of outcomes) {
    const currency = currencyOf(o.currency);
    if (o.kind === "financing") {
      const totals = financeTotals.get(currency) ?? { requests: emptyTotal(), approvals: emptyTotal(), disbursements: emptyTotal() };
      financeTotals.set(currency, totals);
      if (o.status !== "not_started" && o.status !== "cancelled" && toNumber(o.amountRequested) > 0) addTo(totals.requests, o.organizationId, toNumber(o.amountRequested));
      if ((o.status === "approved" || o.status === "disbursed") && toNumber(o.amountApproved) > 0) addTo(totals.approvals, o.organizationId, toNumber(o.amountApproved));
      if (toNumber(o.amountDisbursed) > 0) addTo(totals.disbursements, o.organizationId, toNumber(o.amountDisbursed));
    } else if (o.status !== "cancelled") {
      const totals = exportTotals.get(currency) ?? { shipments: emptyTotal(), payments: emptyTotal() };
      exportTotals.set(currency, totals);
      if (SHIPPED_STATUSES.has(o.status) || toNumber(o.valueShipped) > 0 || o.shipmentDate) addTo(totals.shipments, o.organizationId, toNumber(o.valueShipped));
      if (o.status === "paid" || toNumber(o.valuePaid) > 0 || o.paymentDate) addTo(totals.payments, o.organizationId, toNumber(o.valuePaid));
    }
  }
  const money = (total: Total, kind: SponsorDataKind) => {
    const visible = canSee(total.smes, kind);
    return { count: visible ? total.count : null, amount: visible ? round(total.amount) : null };
  };
  const anyShown = (entries: readonly { count: number | null }[]) => entries.some((e) => e.count !== null && e.count > 0);
  const financeRows = [...financeTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, t]) => ({ currency, requests: money(t.requests, outcomesKind), approvals: money(t.approvals, outcomesKind), disbursements: money(t.disbursements, outcomesKind) }))
    .filter((r) => anyShown([r.requests, r.approvals, r.disbursements]));
  const exportRows = [...exportTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, t]) => ({ currency, shipments: money(t.shipments, outcomesKind), payments: money(t.payments, outcomesKind) }))
    .filter((r) => anyShown([r.shipments, r.payments]));

  // ---- From each enrolment's newest submitted M04 brief ----
  const briefKind = "m04_brief" as const;
  const latestBrief = new Map<string, Facts["briefs"][number]>();
  for (const b of facts.briefs) if (!latestBrief.has(b.enrollmentId)) latestBrief.set(b.enrollmentId, b);
  const gapTotals = new Map<string, Total>();
  const methodSmes = new Map<string, Set<string>>();
  for (const [enrollmentId, brief] of latestBrief) {
    const organizationId = organizationOf.get(enrollmentId);
    if (!organizationId) continue;
    const currency = typeof brief.values.currency === "string" ? brief.values.currency : "ETB";
    const computed = ((brief.result ?? {}) as { computed?: Record<string, unknown> }).computed ?? {};
    if (typeof computed.funding_needed === "number" && computed.funding_needed > 0) {
      const total = gapTotals.get(currency) ?? emptyTotal();
      gapTotals.set(currency, total);
      addTo(total, organizationId, computed.funding_needed);
    }
    if (typeof brief.values.payment_method === "string" && brief.values.payment_method) {
      methodSmes.set(brief.values.payment_method, (methodSmes.get(brief.values.payment_method) ?? new Set()).add(organizationId));
    }
  }
  const fundingGap = [...gapTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, ...money(total, briefKind) }))
    .filter((r) => r.count !== null);
  const methods = [...methodSmes.entries()].sort(([a], [b]) => a.localeCompare(b));
  const methodCounts = shownGroup(methods.map(([, smes]) => ({ value: smes.size, smes })), briefKind);
  const paymentMethods = methods.map(([method], i) => ({ method, count: methodCounts[i] ?? null }));

  // ---- Named rows: every SME for staff, and for a sponsor only what an SME agreed to share ----
  const smes = enrollments.flatMap((e) => {
    const allowed = (kind: SponsorDataKind) => isStaff || consenting.get(kind)!.has(e.organizationId);
    const kinds = isStaff ? [] : SPONSOR_DATA_KINDS.filter(allowed);
    if (!isStaff && (kinds.length === 0 || e.status === "withdrawn")) return [];
    const belongs = (r: { enrollmentId: string | null; organizationId: string }) => r.enrollmentId === e.id || (r.enrollmentId === null && r.organizationId === e.organizationId);
    const own = opportunities.filter(belongs);
    const progress = facts.progress.filter((p) => p.enrollmentId === e.id);
    const averageOf = (kind: "placement" | "exit") => {
      const latest = new Map<string, number>();
      for (const s of facts.scores) if (s.enrollmentId === e.id && s.kind === kind && s.score !== null) latest.set(s.domain, Number(s.score));
      return latest.size ? round([...latest.values()].reduce((a, b) => a + b, 0) / latest.size) : null;
    };
    const ownOutcomes = outcomes.filter(belongs);
    const perCurrency = (kind: "financing" | "export", pick: (o: (typeof outcomes)[number]) => string | null) => {
      const totals = new Map<string, number>();
      for (const o of ownOutcomes) {
        const amount = o.kind === kind ? toNumber(pick(o)) : 0;
        if (amount > 0) totals.set(currencyOf(o.currency), (totals.get(currencyOf(o.currency)) ?? 0) + amount);
      }
      return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: round(amount) }));
    };
    const showsPlacement = allowed("placement_results");
    const showsProgress = allowed("learning_progress");
    const showsOutcomes = allowed("commercial_outcomes");
    return [
      {
        organizationId: e.organizationId,
        name: e.name,
        smeId: e.smeId,
        cohortId: e.cohortId,
        cohort: scope.cohorts.find((c) => c.id === e.cohortId)?.name ?? "",
        status: e.status,
        sharedKinds: kinds,
        pathway: showsPlacement ? (facts.pathways.find((p) => p.enrollmentId === e.id)?.pathway ?? null) : null,
        placementAverage: showsPlacement ? averageOf("placement") : null,
        exitAverage: showsPlacement ? averageOf("exit") : null,
        modulesStarted: showsProgress ? progress.filter((p) => p.status !== "not_started").length : null,
        modulesPassed: showsProgress ? progress.filter((p) => p.status === "passed" || p.status === "exempted").length : null,
        submissionsWaiting: showsProgress ? facts.submissions.filter((s) => s.enrollmentId === e.id).length : null,
        leads: showsOutcomes ? own.length : null,
        firmOrders: showsOutcomes ? own.filter((o) => o.stage === "firm_order_secured").length : null,
        financingRequested: showsOutcomes ? perCurrency("financing", (o) => o.amountRequested) : null,
        financingApproved: showsOutcomes ? perCurrency("financing", (o) => o.amountApproved) : null,
        financingDisbursed: showsOutcomes ? perCurrency("financing", (o) => o.amountDisbursed) : null,
        valueShipped: showsOutcomes ? perCurrency("export", (o) => o.valueShipped) : null,
        valuePaid: showsOutcomes ? perCurrency("export", (o) => o.valuePaid) : null,
      },
    ];
  });

  return {
    scope: { kind: scope.kind, id: scope.id, name: scope.name, program: scope.program, cohorts: scope.cohorts.map((c) => ({ id: c.id, name: c.name })) },
    audience: isStaff ? ("staff" as const) : ("sponsor" as const),
    generatedAt: now.toISOString(),
    minimumSmes: MINIMUM_SMES_IN_A_FIGURE,
    disclaimer: SPONSOR_DISCLAIMER,
    reach: {
      enrolled: shown(enrollments.length, allOrganizations, reachKind),
      byStatus: byStatus.map((s, i) => ({ status: s.status, count: statusCounts[i] ?? null })),
      pathwayA: pathwayA ?? null,
      pathwayB: pathwayB ?? null,
    },
    engagement: { activeWithinDays: ACTIVE_WITHIN_DAYS, activeLearners: shown(active.size, active, progressKind), modules, knowledgeChecks, submissionsWaiting: shown(facts.submissions.length, waiting, progressKind) },
    capability,
    pipeline,
    finance: { byCurrency: financeRows, fundingGap },
    exportExecution: { byCurrency: exportRows, paymentMethods },
    smes,
  };
}

/** A sponsor reading named rows leaves the same trace as opening an SME's page. */
async function auditNamedRows(ctx: Ctx, report: ReturnType<typeof buildReport>): Promise<void> {
  if (report.audience !== "sponsor" || report.smes.length === 0) return;
  await Promise.all(
    report.smes.map((sme) =>
      recordTradeChange(ctx.db, ctx.principal.userId, {
        action: "trade.sponsor.viewedReport",
        organizationId: sme.organizationId,
        entityType: "organization",
        entityId: sme.organizationId,
        after: { scope: report.scope.kind, scopeId: report.scope.id, cohortId: sme.cohortId, kinds: sme.sharedKinds },
      }),
    ),
  );
}

async function reportFor(ctx: Ctx, scope: Scope) {
  const report = buildReport(scope, await loadFacts(ctx.db, scope), ctx.now);
  await auditNamedRows(ctx, report);
  return report;
}

export async function getProgramReport(ctx: Ctx, id: string) {
  return reportFor(ctx, await programScope(ctx, id));
}

export async function getCohortReport(ctx: Ctx, id: string) {
  return reportFor(ctx, await cohortScope(ctx, id));
}

// ---- CSV, for Entrust staff ----

const moneyCell = (rows: readonly { currency: string; amount: number }[] | null): string => (rows ?? []).map((r) => `${r.currency} ${r.amount}`).join("; ");

function csvText(cell: string | number | null): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  // A cell a spreadsheet would run as a formula is made plain text.
  const text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const CSV_COLUMNS = [
  "Business", "SME ID", "Cohort", "Status", "Pathway", "Placement average", "Exit average", "Modules started", "Modules passed", "Submissions waiting",
  "Leads", "Firm orders", "Financing requested", "Financing approved", "Financing disbursed", "Value shipped", "Value paid",
];

async function exportReport(ctx: Ctx, scope: Scope): Promise<{ csv: string; filename: string }> {
  if (scope.sponsorIds !== null) throw new ServiceError("forbidden", "Only Entrust staff can export a programme report.");
  const report = buildReport(scope, await loadFacts(ctx.db, scope), ctx.now);
  const rows = report.smes.map((s) => [
    s.name, s.smeId, s.cohort, s.status, s.pathway, s.placementAverage, s.exitAverage, s.modulesStarted, s.modulesPassed, s.submissionsWaiting,
    s.leads, s.firmOrders, moneyCell(s.financingRequested), moneyCell(s.financingApproved), moneyCell(s.financingDisbursed), moneyCell(s.valueShipped), moneyCell(s.valuePaid),
  ]);
  const csv = [CSV_COLUMNS, ...rows].map((row) => row.map(csvText).join(",")).join("\r\n");
  return { csv: `﻿${csv}\r\n`, filename: `trade-${scope.kind}-report-${ctx.now.toISOString().slice(0, 10)}.csv` };
}

export async function exportProgramReport(ctx: Ctx, id: string) {
  return exportReport(ctx, await programScope(ctx, id));
}

export async function exportCohortReport(ctx: Ctx, id: string) {
  return exportReport(ctx, await cohortScope(ctx, id));
}
