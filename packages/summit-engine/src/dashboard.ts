import type { ApplicationStatus, OpportunityPathway, SuitableOpportunity, VerificationClass } from "./types";
import { OPPORTUNITY_PATHWAYS, SUITABLE_OPPORTUNITIES, VERIFICATION_CLASSES } from "./types";

// The figures of the live distribution dashboard (spec section 8), worked out from one row per application. Nothing
// here reads a database, so what the dashboard says can be checked against rows written by hand.

/** The planning target: how many SMEs the committee aims to select from each country. Section 8 puts it at 10 for each of 10 countries. */
export const DEFAULT_SELECTION_TARGET = 10;

/** What the dashboard needs to know about one application. */
export interface DashboardRow {
  /** ISO 3166-1 alpha-2 code from the SME profile, or null if it has none. */
  country: string | null;
  status: ApplicationStatus;
  /** The applicant has submitted it at some point. A draft hasn't. */
  submitted: boolean;
  /** The latest eligibility screening found it eligible. */
  eligible: boolean;
  /** The assessment has been completed (and not sent back). */
  assessed: boolean;
  /** The adjusted score out of 100, once the assessment is complete. */
  score: number | null;
  sector: string | null;
  pathway: OpportunityPathway | null;
  /** The opportunity the officer thinks suits the applicant best. */
  suitableOpportunity: SuitableOpportunity | null;
  womanOwned: boolean | null;
  youthOwned: boolean | null;
}

export interface SelectionTarget {
  /** For every country of the period that has no figure of its own. */
  perCountry: number;
  /** Countries with a figure of their own, by ISO code. */
  overrides: Readonly<Record<string, number>>;
}

export interface DashboardInput {
  rows: readonly DashboardRow[];
  /** The countries the period takes applications from, in the order to show them. */
  countries: readonly string[];
  target: SelectionTarget;
  /** How many officer classifications of each class there are across the period's claims. */
  verification: Readonly<Record<VerificationClass, number>>;
  /** Applications with at least one classified claim. */
  classifiedApplications: number;
}

export interface CountryFigures {
  /** Null for applications whose organisation has no country. */
  country: string | null;
  applications: number;
  eligible: number;
  underAssessment: number;
  assessed: number;
  /** Mean adjusted score of the assessed applications, to one decimal. Null with none. */
  averageScore: number | null;
  selected: number;
  waitlisted: number;
  notSelected: number;
  target: number;
  /** How many more selections reach the target. Never below zero. */
  remaining: number;
}

export interface Dashboard {
  totals: {
    /** Submitted applications that haven't been withdrawn. */
    applications: number;
    drafts: number;
    withdrawn: number;
    eligible: number;
    ineligible: number;
    awaitingInformation: number;
    underAssessment: number;
    assessed: number;
    inCommitteeReview: number;
    selected: number;
    waitlisted: number;
    notSelected: number;
    averageScore: number | null;
  };
  target: { perCountry: number; total: number; selected: number; remaining: number };
  byCountry: CountryFigures[];
  byIndustry: { sector: string | null; applications: number; selected: number }[];
  byPathway: Record<OpportunityPathway, number>;
  /** What the officers thought suited each applicant, among those who have a recommendation. */
  bySuitableOpportunity: Record<SuitableOpportunity, number>;
  ownership: {
    womanOwned: { applications: number; selected: number };
    youthOwned: { applications: number; selected: number };
  };
  verification: { byClass: Record<VerificationClass, number>; classifiedApplications: number };
}

const UNDER_ASSESSMENT: readonly ApplicationStatus[] = ["under_assessment", "under_verification"];

const average = (scores: readonly number[]): number | null =>
  scores.length === 0 ? null : Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;

const normalise = (sector: string): string => sector.trim().replace(/\s+/g, " ").toLowerCase();

/** The figure for a country, which is its own if the committee set one, otherwise the same for all. */
export const targetFor = (target: SelectionTarget, country: string | null): number =>
  (country !== null ? target.overrides[country.toUpperCase()] : undefined) ?? target.perCountry;

/**
 * The dashboard of section 8. Applications are the submitted ones that haven't been withdrawn; a draft is counted on its
 * own and never in the distribution. Countries are the period's, in its order, then any other an application is from,
 * then applications with no country. A country with no applications shows zeros against its target, and only the
 * period's countries have a target.
 */
export function summarise(input: DashboardInput): Dashboard {
  const live = input.rows.filter((r) => r.submitted && r.status !== "withdrawn");
  const is = (row: DashboardRow, ...statuses: ApplicationStatus[]) => statuses.includes(row.status);
  const assessed = live.filter((r) => r.assessed && r.score !== null);

  const countries: (string | null)[] = [...new Set(input.countries.map((c) => c.toUpperCase()))];
  const planned = new Set<string | null>(countries);
  for (const row of live) {
    const country = row.country?.toUpperCase() ?? null;
    if (!countries.includes(country)) countries.push(country);
  }
  const byCountry = countries.map((country): CountryFigures => {
    const rows = live.filter((r) => (r.country?.toUpperCase() ?? null) === country);
    const selected = rows.filter((r) => r.status === "selected").length;
    // Only the period's countries have a target. An application whose organisation has since moved country has none.
    const target = country !== null && planned.has(country) ? targetFor(input.target, country) : 0;
    return {
      country,
      applications: rows.length,
      eligible: rows.filter((r) => r.eligible).length,
      underAssessment: rows.filter((r) => is(r, ...UNDER_ASSESSMENT)).length,
      assessed: rows.filter((r) => r.assessed).length,
      averageScore: average(rows.filter((r) => r.assessed && r.score !== null).map((r) => r.score as number)),
      selected,
      waitlisted: rows.filter((r) => r.status === "waitlisted").length,
      notSelected: rows.filter((r) => r.status === "not_selected").length,
      target,
      remaining: Math.max(0, target - selected),
    };
  });

  const industries = new Map<string, { sector: string | null; applications: number; selected: number }>();
  for (const row of live) {
    const key = row.sector ? normalise(row.sector) : "";
    const entry = industries.get(key) ?? { sector: row.sector ? row.sector.trim().replace(/\s+/g, " ") : null, applications: 0, selected: 0 };
    entry.applications += 1;
    if (row.status === "selected") entry.selected += 1;
    industries.set(key, entry);
  }

  const inPeriod = byCountry.filter((c) => planned.has(c.country));
  const targetTotal = inPeriod.reduce((sum, c) => sum + c.target, 0);
  const plannedSelected = inPeriod.reduce((sum, c) => sum + c.selected, 0);

  const owned = (pick: (r: DashboardRow) => boolean | null) => {
    const rows = live.filter((r) => pick(r) === true);
    return { applications: rows.length, selected: rows.filter((r) => r.status === "selected").length };
  };

  return {
    totals: {
      applications: live.length,
      drafts: input.rows.filter((r) => !r.submitted && r.status !== "withdrawn").length,
      withdrawn: input.rows.filter((r) => r.status === "withdrawn").length,
      eligible: live.filter((r) => r.eligible).length,
      ineligible: live.filter((r) => r.status === "ineligible").length,
      awaitingInformation: live.filter((r) => r.status === "awaiting_additional_information").length,
      underAssessment: live.filter((r) => is(r, ...UNDER_ASSESSMENT)).length,
      assessed: live.filter((r) => r.assessed).length,
      inCommitteeReview: live.filter((r) => r.status === "committee_review").length,
      selected: live.filter((r) => r.status === "selected").length,
      waitlisted: live.filter((r) => r.status === "waitlisted").length,
      notSelected: live.filter((r) => r.status === "not_selected").length,
      averageScore: average(assessed.map((r) => r.score as number)),
    },
    target: {
      perCountry: input.target.perCountry,
      total: targetTotal,
      selected: plannedSelected,
      remaining: Math.max(0, targetTotal - plannedSelected),
    },
    byCountry,
    byIndustry: [...industries.values()].sort(
      (a, b) => b.applications - a.applications || (a.sector === null ? 1 : b.sector === null ? -1 : a.sector.localeCompare(b.sector)),
    ),
    byPathway: Object.fromEntries(OPPORTUNITY_PATHWAYS.map((p) => [p, live.filter((r) => r.pathway === p).length])) as Record<OpportunityPathway, number>,
    bySuitableOpportunity: Object.fromEntries(
      SUITABLE_OPPORTUNITIES.map((o) => [o.id, live.filter((r) => r.suitableOpportunity === o.id).length]),
    ) as Record<SuitableOpportunity, number>,
    ownership: { womanOwned: owned((r) => r.womanOwned), youthOwned: owned((r) => r.youthOwned) },
    verification: {
      byClass: Object.fromEntries(VERIFICATION_CLASSES.map((c) => [c, input.verification[c] ?? 0])) as Record<VerificationClass, number>,
      classifiedApplications: input.classifiedApplications,
    },
  };
}

/** A figure the committee sets for a country must be a whole number from 0 to 1000. */
export const validTarget = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= 1000;
