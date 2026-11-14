"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { serverApi } from "@/lib/api";
import type { DeliveryMode, EnrollmentStatus, RegistrySme } from "@/lib/types";

export type ActionState = { error: string | null; success?: boolean };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

export async function createProgramAction(_: ActionState, form: FormData): Promise<ActionState> {
  const name = text(form, "name");
  const description = text(form, "description");

  if (!name) return { error: "Program name is required." };

  const api = await serverApi();
  const res = await api.v1.trade.programs.$post({
    json: {
      name,
      description: description || undefined,
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to create program (${res.status}).` };
  }

  revalidatePath("/cohorts");
  return { error: null, success: true };
}

export async function createCohortAction(_: ActionState, form: FormData): Promise<ActionState> {
  const programId = text(form, "programId");
  const name = text(form, "name");
  const deliveryMode = (text(form, "deliveryMode") ?? "self_paced") as DeliveryMode;
  const country = text(form, "country") ?? "ET";
  const language = text(form, "language") ?? "en";
  const sponsorOrganizationId = text(form, "sponsorOrganizationId") || null;
  const startDate = text(form, "startDate") || null;
  const endDate = text(form, "endDate") || null;

  if (!programId) return { error: "Program is required." };
  if (!name) return { error: "Cohort name is required." };

  const api = await serverApi();
  const res = await api.v1.trade.cohorts.$post({
    json: {
      programId,
      name,
      deliveryMode,
      country,
      language,
      sponsorOrganizationId,
      startDate,
      endDate,
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to create cohort (${res.status}).` };
  }

  revalidatePath("/cohorts");
  return { error: null, success: true };
}

export async function enrolSmeAction(_: ActionState, form: FormData): Promise<ActionState> {
  const cohortId = text(form, "cohortId");
  const organizationId = text(form, "organizationId");

  if (!cohortId) return { error: "Cohort ID is missing." };
  if (!organizationId) return { error: "Organisation ID is required." };

  const api = await serverApi();
  const res = await api.v1.trade.enrollments.$post({
    json: {
      cohortId,
      organizationId,
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to enrol SME (${res.status}).` };
  }

  revalidatePath(`/cohorts/${cohortId}`);
  return { error: null, success: true };
}

export async function updateStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const enrollmentId = text(form, "enrollmentId");
  const cohortId = text(form, "cohortId");
  const status = text(form, "status") as EnrollmentStatus;
  const reason = text(form, "reason") || null;

  if (!enrollmentId) return { error: "Enrolment ID is missing." };
  if (!status) return { error: "Status is required." };

  const api = await serverApi();
  const res = await api.v1.trade.enrollments[":id"].status.$patch({
    param: { id: enrollmentId },
    json: {
      status,
      reason,
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to update status (${res.status}).` };
  }

  if (cohortId) {
    revalidatePath(`/cohorts/${cohortId}`);
  }
  return { error: null, success: true };
}

/** Looks businesses up in the SME registry by name, SME ID, TIN or registration number (Entrust staff only). */
export async function searchSmesAction(query: string): Promise<{ smes: RegistrySme[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) return { smes: [], error: null };
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/smes/search?q=${encodeURIComponent(q)}&limit=15`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) return { smes: [], error: "The search didn't work. Try again." };
  const data = (await response.json()) as { smes: RegistrySme[] };
  return { smes: data.smes.filter((s) => !s.isMerged), error: null };
}

export type EnrolManyResult = { enrolled: number; failed: { organizationId: string; error: string }[] };

/** Enrols several businesses in one go. One that fails (already in the cohort, say) doesn't stop the rest. */
export async function enrolManyAction(cohortId: string, organizationIds: string[]): Promise<EnrolManyResult> {
  const api = await serverApi();
  const result: EnrolManyResult = { enrolled: 0, failed: [] };
  for (const organizationId of organizationIds) {
    const res = await api.v1.trade.enrollments.$post({ json: { cohortId, organizationId } });
    if (res.ok) {
      result.enrolled += 1;
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      result.failed.push({ organizationId, error: data?.error ?? `Failed (${res.status}).` });
    }
  }
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/cohorts");
  return result;
}

export type EnrolFromDiagnosticsResult = { enrolled: number; invited: number; failed: { publicDiagnosticId: string; error: string }[] };

/**
 * Makes a business from each submitted public diagnostic and enrols it. `confirmDuplicateName` is set for the forms whose
 * similar registered business staff were shown. One that fails doesn't stop the rest.
 */
export async function enrolFromDiagnosticsAction(
  cohortId: string,
  forms: { publicDiagnosticId: string; confirmDuplicateName: boolean }[],
): Promise<EnrolFromDiagnosticsResult> {
  const api = await serverApi();
  const result: EnrolFromDiagnosticsResult = { enrolled: 0, invited: 0, failed: [] };
  for (const form of forms) {
    const res = await api.v1.trade.enrollments["from-diagnostic"].$post({ json: { cohortId, ...form } });
    if (res.ok) {
      const data = (await res.json()) as { owner: "owner" | "invited" };
      result.enrolled += 1;
      if (data.owner === "invited") result.invited += 1;
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      result.failed.push({ publicDiagnosticId: form.publicDiagnosticId, error: data?.error ?? `Failed (${res.status}).` });
    }
  }
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/cohorts");
  revalidatePath("/diagnostics");
  return result;
}

export async function assignCohortStaffAction(cohortId: string, userId: string): Promise<ActionState> {
  const api = await serverApi();
  const res = await api.v1.trade.cohorts[":id"].staff.$post({ param: { id: cohortId }, json: { userId } });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to add them (${res.status}).` };
  }
  revalidatePath(`/cohorts/${cohortId}`);
  return { error: null, success: true };
}

export async function removeCohortStaffAction(cohortId: string, userId: string): Promise<ActionState> {
  const api = await serverApi();
  const res = await api.v1.trade.cohorts[":id"].staff[":userId"].$delete({ param: { id: cohortId, userId } });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to remove them (${res.status}).` };
  }
  revalidatePath(`/cohorts/${cohortId}`);
  return { error: null, success: true };
}
