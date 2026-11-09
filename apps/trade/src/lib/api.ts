import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createApiClient } from "@entrust/api/client";
import type {
  UserProfile,
  TradeProgram,
  TradeCohort,
  TradeCohortDetail,
  TradeEnrollmentSummary,
  WaitingSme,
  StaffAssessmentRow,
  TradeSessionSummary,
  TradeSessionDetail,
  TradeFacilitatorRoster,
} from "./types";
import { tradeGet } from "./trade-api";

/** Server-side API client that forwards the visitor's cookies. */
export async function serverApi() {
  const cookie = (await headers()).get("cookie") ?? "";
  return createApiClient(process.env.API_URL ?? "http://localhost:4000", { headers: { cookie } });
}

/**
 * The signed-in user, or null. Once per page render: the layout and the page both ask, and each
 * call is a request to the API.
 */
export const getMe = cache(async (): Promise<UserProfile | null> => {
  const res = await (await serverApi()).v1.me.$get();
  return res.status === 200 ? ((await res.json()) as unknown as UserProfile) : null;
});

/** The organisations the signed-in user belongs to. */
export async function listOrganizations(): Promise<{ id: string; name: string }[]> {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/organization/list`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const organizations = (await res.json()) as { id: string; name: string }[];
  return organizations.map(({ id, name }) => ({ id, name }));
}

/** All programs (Entrust staff only). */
export async function listPrograms(): Promise<TradeProgram[]> {
  const res = await (await serverApi()).v1.trade.programs.$get();
  if (res.status !== 200) return [];
  const data = (await res.json()) as { programs: TradeProgram[] };
  return data.programs;
}

/** Cohorts list, optionally filtered by program ID (Entrust staff only). */
export async function listCohorts(programId?: string): Promise<TradeCohort[]> {
  const res = await (await serverApi()).v1.trade.cohorts.$get({
    query: programId ? { programId } : {},
  });
  if (res.status !== 200) return [];
  const data = (await res.json()) as { cohorts: TradeCohort[] };
  return data.cohorts;
}

/** Cohort details including enrolled SMEs (Entrust staff only). */
/** Who works on a cohort. Only an administrator can read or change it. */
export async function getCohortStaff(id: string): Promise<{
  assigned: { userId: string; name: string; email: string }[];
  available: { userId: string; name: string; email: string; role: string }[];
} | null> {
  const res = await (await serverApi()).v1.trade.cohorts[":id"].staff.$get({ param: { id } });
  if (!res.ok) return null;
  return (await res.json()) as never;
}

export async function getCohort(id: string): Promise<TradeCohortDetail | null> {
  const res = await (await serverApi()).v1.trade.cohorts[":id"].$get({
    param: { id },
  });
  if (res.status !== 200) return null;
  return (await res.json()) as unknown as TradeCohortDetail;
}

/** Enrollments list filtered by cohortId or organizationId. */
export async function listEnrollments(filter?: {
  cohortId?: string;
  organizationId?: string;
}): Promise<TradeEnrollmentSummary[]> {
  const res = await (await serverApi()).v1.trade.enrollments.$get({
    query: {
      ...(filter?.cohortId ? { cohortId: filter.cohortId } : {}),
      ...(filter?.organizationId ? { organizationId: filter.organizationId } : {}),
    },
  });
  if (res.status !== 200) return [];
  const data = (await res.json()) as { enrollments: TradeEnrollmentSummary[] };
  return data.enrollments;
}

/** Businesses that signed up to TRADE and are in no cohort yet (Entrust staff only). */
export async function listWaitingSmes(): Promise<WaitingSme[]> {
  const result = await tradeGet<{ smes: WaitingSme[] }>("/enrollments/waiting");
  return result.data?.smes ?? [];
}

/** Every onboarding diagnostic with its status and avenue, newest first (Entrust staff only). */
export async function listDiagnostics(): Promise<StaffAssessmentRow[]> {
  const result = await tradeGet<{ items: StaffAssessmentRow[] }>("/assessments?kind=diagnostic");
  return (result.data?.items ?? []).filter((item) => item.status !== "superseded");
}

/** Every placement assessment with its status, newest first (Entrust staff only). */
export async function listPlacements(): Promise<StaffAssessmentRow[]> {
  const result = await tradeGet<{ items: StaffAssessmentRow[] }>("/assessments?kind=placement");
  return (result.data?.items ?? []).filter((item) => item.status !== "superseded");
}

/** List sessions for a cohort. */
export async function listSessions(cohortId: string): Promise<TradeSessionSummary[]> {
  const res = await (await serverApi()).v1.trade.cohorts[":cohortId"].sessions.$get({
    param: { cohortId },
  });
  if (res.status !== 200) return [];
  const data = (await res.json()) as { sessions: TradeSessionSummary[] };
  return data.sessions;
}

/** Session details by ID. */
export async function getSession(id: string): Promise<TradeSessionDetail | null> {
  const res = await (await serverApi()).v1.trade.sessions[":id"].$get({
    param: { id },
  });
  if (res.status !== 200) return null;
  return (await res.json()) as unknown as TradeSessionDetail;
}

/** Facilitator roster for a session (Staff only). */
export async function getFacilitatorRoster(id: string): Promise<TradeFacilitatorRoster | null> {
  const res = await (await serverApi()).v1.trade.sessions[":id"].roster.$get({
    param: { id },
  });
  if (res.status !== 200) return null;
  return (await res.json()) as unknown as TradeFacilitatorRoster;
}
