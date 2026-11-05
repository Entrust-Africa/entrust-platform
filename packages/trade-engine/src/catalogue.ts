import { isYes, tidyPhone } from "./applications";
import type { ReadinessLevel, RegisterRecord } from "./register";
import { letters } from "./register";

// The catalogue of pilot SMEs, one list a cohort. Cohort 1 is the leather businesses, from the diagnostic workbook; cohort 2 is
// the agro-processing businesses that applied to the training programme. Both are put in one shape so a screen can list them alike.

/** A cohort is active while it is running or about to, and previous once it has finished. */
export type CohortStatus = "active" | "previous";

export interface PilotCohort {
  number: number;
  name: string;
  description: string;
  status: CohortStatus;
}

// Fixed in code, like the split itself: both pilot cohorts are over, so none is active. A new cohort will be the first active one.
// When cohorts and enrolments are managed in the database (#56), the status should come from a cohort's dates instead.
export const PILOT_COHORTS: readonly PilotCohort[] = [
  { number: 1, name: "Leather", description: "The leather businesses in the export readiness diagnostic.", status: "previous" },
  { number: 2, name: "Agro-processing", description: "The agro-processing businesses in Ethiopia that applied to the training programme.", status: "previous" },
];

/** An application belongs to cohort 2 when the programme it was loaded for has "agro" in its name. */
export const AGRO_PROGRAMME = /agro/i;

export interface CatalogueSme {
  /** Stable across loads, so a list can key on it. */
  key: string;
  /** The stored record's id: the register row for cohort 1, the (latest) application for cohort 2. A detail page is opened with it. */
  id: string;
  cohort: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  /** What it makes or sells, as one line. */
  product: string | null;
  /** As typed: a form's answer is not always a number. */
  employees: string | null;
  bank: string | null;
  /** The workbook's SME ID (cohort 1). Cohort 2 has none yet. */
  reference: string | null;
  /** Cohort 1: from the diagnostic. */
  readinessLevel: ReadinessLevel | null;
  readinessScore: number | null;
  /** Cohort 2: from the application. */
  exportedBefore: boolean | null;
  wantsZemenFinancing: boolean | null;
  /** The other cohorts the same business is in, found by its phone number or email address. */
  alsoInCohorts: number[];
}

const oneLine = (text: string | null | undefined, max = 140): string | null => {
  const line = (text ?? "").replace(/\s*\n\s*/g, "; ").replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

const yesNo = (answer: string | undefined): boolean | null => (answer === undefined ? null : isYes(answer) ? true : /^\s*n/i.test(answer) ? false : null);

export function catalogueFromRegister(record: RegisterRecord, id: string): CatalogueSme {
  return {
    key: `register:${record.code}`,
    id,
    cohort: 1,
    name: record.companyName,
    contactName: record.participantName,
    phone: tidyPhone(record.phone, "ET"),
    email: record.email,
    location: record.location,
    product: record.mainProduct,
    employees: record.employees === null ? null : String(record.employees),
    bank: record.currentBank,
    reference: record.code,
    readinessLevel: record.financeReadinessLevel,
    readinessScore: record.exportReadinessScore,
    exportedBefore: null,
    wantsZemenFinancing: null,
    alsoInCohorts: [],
  };
}

export interface ApplicationRow {
  id: string;
  submittedAt: string;
  email: string;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  location: string | null;
  answers: Partial<Record<string, string>>;
}

/**
 * One entry a business, not a response: a business that applied twice (found by its email address or its name) is listed once, from
 * its latest response.
 */
export function catalogueFromApplications(applications: readonly ApplicationRow[]): CatalogueSme[] {
  const latest = new Map<string, ApplicationRow>();
  const groupOf = new Map<string, string>(); // an email or a name -> the group it first appeared in
  for (const application of applications) {
    const keys = [`e:${application.email.toLowerCase()}`, `n:${letters(application.businessName)}`];
    const group = keys.map((k) => groupOf.get(k)).find((g) => g !== undefined) ?? keys[0]!;
    for (const k of keys) groupOf.set(k, group);
    const current = latest.get(group);
    if (!current || application.submittedAt > current.submittedAt) latest.set(group, application);
  }
  return [...latest.values()].map((a) => ({
    key: `application:${a.id}`,
    id: a.id,
    cohort: 2,
    name: a.businessName,
    contactName: a.contactName,
    phone: a.phone,
    email: a.email,
    location: a.location,
    product: oneLine(a.answers.mainProducts) ?? oneLine(a.answers.produces) ?? oneLine(a.answers.category),
    employees: oneLine(a.answers.employees, 60),
    bank: oneLine(a.answers.bank, 60),
    reference: null,
    readinessLevel: null,
    readinessScore: null,
    exportedBefore: yesNo(a.answers.exportedBefore),
    wantsZemenFinancing: yesNo(a.answers.zemenInterest),
    alsoInCohorts: [],
  }));
}

/** How a business is recognised across the register and the applications: the last nine digits of its phone number, or its email address. */
export const identityKeys = ({ phone, email }: { phone: string | null; email: string | null }): string[] => {
  const ids: string[] = [];
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 9) ids.push(`p:${digits.slice(-9)}`);
  if (email) ids.push(`e:${email.toLowerCase()}`);
  return ids;
};

/** Whether two records are one business, by phone number or email address. */
export const sameBusiness = (a: { phone: string | null; email: string | null }, b: { phone: string | null; email: string | null }): boolean => {
  const keys = new Set(identityKeys(a));
  return identityKeys(b).some((k) => keys.has(k));
};

const identities = identityKeys;

/** Fills in `alsoInCohorts`: a business in more than one cohort shares a phone number or email address across them. */
export function markSharedBusinesses(smes: CatalogueSme[]): CatalogueSme[] {
  const cohortsBy = new Map<string, Set<number>>();
  for (const sme of smes) for (const id of identities(sme)) cohortsBy.set(id, (cohortsBy.get(id) ?? new Set()).add(sme.cohort));
  return smes.map((sme) => {
    const others = new Set<number>();
    for (const id of identities(sme)) for (const c of cohortsBy.get(id) ?? []) if (c !== sme.cohort) others.add(c);
    return { ...sme, alsoInCohorts: [...others].sort((a, b) => a - b) };
  });
}

export interface CatalogueCohort extends PilotCohort {
  count: number;
  smes: CatalogueSme[];
}

/** The pilot's cohorts, each with its businesses by name. */
export function buildCatalogue(smes: readonly CatalogueSme[]): CatalogueCohort[] {
  const marked = markSharedBusinesses([...smes]);
  return PILOT_COHORTS.map((cohort) => {
    const members = marked.filter((s) => s.cohort === cohort.number).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.key.localeCompare(b.key));
    return { ...cohort, count: members.length, smes: members };
  });
}
