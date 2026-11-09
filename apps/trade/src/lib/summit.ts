import type { FormDefinition } from "@entrust/forms";
import type { StatusTone } from "@entrust/ui";
import type { ApiClient, Body } from "./summit-api";
import type { UserProfile } from "./types";

// What the Summit screens share: the shapes the API returns, the words we use for them, and the rules for who can see
// the Summit. Nothing here talks to the network.

type Summit = ApiClient["v1"]["summit"];

/** One application as the API shows it to its applicant: answers, documents, progress, eligibility, requests. No scores. */
export type SummitApplication = Body<Awaited<ReturnType<Summit["applications"][":id"]["$get"]>>>;
export type SummitApplicationList = Body<Awaited<ReturnType<Summit["applications"]["$get"]>>>;
export type SummitPeriod = NonNullable<Body<Awaited<ReturnType<Summit["period"]["$get"]>>>["period"]>;
export type SummitClarification = SummitApplication["clarifications"][number];
export type SummitDocument = SummitApplication["documents"][number];
export type SummitDocumentKind = SummitDocument["kind"];

/** The form as the API sends it, read as the shared form package's definition. */
export type SummitFormView = Body<Awaited<ReturnType<Summit["forms"][":version"]["$get"]>>>;
export function asDefinition(form: SummitFormView): FormDefinition {
  return form as unknown as FormDefinition;
}

// ---- Words ----

export const DOCUMENT_LABELS: Record<SummitDocumentKind, string> = {
  registration_certificate: "Registration certificate",
  financial_statements: "Financial statements or management accounts",
  product_information: "Product information or catalogue",
  business_plan: "Business plan",
  export_records: "Export declarations, shipping records or invoices",
  buyer_contracts: "Buyer contracts, purchase orders or correspondence",
  certifications: "Certifications or test reports",
  use_of_funds_schedule: "Use-of-funds schedule",
};

/** The kinds an applicant can add. Financial statements keep a label so a file attached earlier still has a name, but are not asked for. */
export const DOCUMENT_KIND_ORDER = (Object.keys(DOCUMENT_LABELS) as SummitDocumentKind[]).filter((kind) => kind !== "financial_statements");

export const PATHWAY_LABELS: Record<string, string> = {
  trade_and_market_access: "Trade and market access",
  investment: "Investment",
  strategic_partnership: "Strategic partnership",
  combined_trade_and_investment: "Combined trade and investment",
};

export interface StatusCopy {
  label: string;
  tone: StatusTone;
  /** What happens next, in a sentence or two. */
  next: string;
}

/** What an applicant is told about each status the API can show them. */
export function statusCopy(status: string, result: SummitApplication["result"]): StatusCopy {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "idle", next: "You have not sent your application yet. Finish the form and send it before the closing date." };
    case "in_review":
      return {
        label: "In review",
        tone: "info",
        next: "We have your application and our team is going through it. We will email you if we need anything more from you.",
      };
    case "action_required":
      return { label: "We need more from you", tone: "warn", next: "Please read what we need below, then follow the steps to answer." };
    case "not_eligible":
      return { label: "Not eligible", tone: "danger", next: "Your application does not meet the requirements for this Summit." };
    case "withdrawn":
      return { label: "Withdrawn", tone: "idle", next: "You withdrew this application. You can start a new one while applications are open." };
    case "selected":
      return { label: result?.label ?? "Selected", tone: "ok", next: result?.message ?? "Congratulations. We will be in touch with the next steps." };
    case "waitlisted":
      return { label: result?.label ?? "On the waiting list", tone: "info", next: result?.message ?? "You are on the waiting list. We will tell you if a place opens." };
    case "not_selected":
      return { label: result?.label ?? "Not selected", tone: "idle", next: result?.message ?? "Thank you for applying. You were not selected this time." };
    default:
      return { label: "In review", tone: "info", next: "We have your application and our team is going through it." };
  }
}

/** The eligibility check in plain words. */
export function eligibilitySummary(eligibility: NonNullable<SummitApplication["eligibility"]>): { title: string; body: string; tone: StatusTone } {
  switch (eligibility.outcome) {
    case "eligible":
      return {
        title: "You meet the requirements to apply",
        body: "Your application passed our first check. It now goes to our team for review.",
        tone: "ok",
      };
    case "ineligible":
      return {
        title: "Your application does not meet the requirements",
        body: "We checked your answers and documents against the requirements for this Summit. At least one was not met.",
        tone: "danger",
      };
    case "pending_clarification":
      return {
        title: "We need a little more to finish the check",
        body: "Your answers and documents do not yet show that every requirement is met. Add what is missing, then send your application again.",
        tone: "warn",
      };
  }
}

// Written out by hand, not with Intl: the server and the browser can word a date differently ("5 November 2026 at 00:00"
// against "5 November 2026, 00:00"), and a client component that shows a date has to match on both.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A date and time. The period's times are shown in UTC so they read the same for every country. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(iso)} at ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let regionNames: Intl.DisplayNames | undefined;

/** A country's name from its two-letter code. */
export function countryName(code: string): string {
  regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// ---- Who can see the Summit ----

export interface SummitAccess {
  /** The organisation the person is acting for: the active one, otherwise the first. */
  activeOrg: NonNullable<UserProfile["organizations"]>[number] | undefined;
  hasTrade: boolean;
  hasSummit: boolean;
  /** Has the Summit and not TRADE, so TRADE's learner pages have nothing for them. */
  summitOnly: boolean;
  isStaff: boolean;
}

/** What the active organisation's platform grants let the person see. Entrust staff see everything. */
export function summitAccess(user: UserProfile): SummitAccess {
  const activeOrg = user.organizations?.find((o) => o.id === user.activeOrganizationId) ?? user.organizations?.[0];
  const isStaff = Boolean(user.staffRole);
  const hasTrade = isStaff || (activeOrg?.platforms.includes("trade") ?? false);
  const hasSummit = isStaff || (activeOrg?.platforms.includes("summit") ?? false);
  return { activeOrg, hasTrade, hasSummit, summitOnly: !isStaff && hasSummit && !hasTrade, isStaff };
}

/** The organisations that can apply: the ones the person belongs to that are SMEs. */
export function smeOrganizations(user: UserProfile) {
  return (user.organizations ?? []).filter((o) => (o.kind ?? "sme") === "sme");
}
