"use server";

import { revalidatePath } from "next/cache";
import { serverApi } from "@/lib/api";
import type { DeliveryMode, EnrollmentStatus } from "@/lib/types";

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
