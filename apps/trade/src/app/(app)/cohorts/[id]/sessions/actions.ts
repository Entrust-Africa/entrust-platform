"use server";

import { revalidatePath } from "next/cache";
import { parseTradeLocalDateTime } from "@entrust/trade-engine";
import { serverApi } from "@/lib/api";
import type { AttendanceStatus } from "@/lib/types";

export type ActionState = { error: string | null; success?: boolean; data?: any };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

export async function createSessionAction(_: ActionState, form: FormData): Promise<ActionState> {
  const cohortId = text(form, "cohortId");
  const title = text(form, "title");
  const description = text(form, "description");
  const moduleCodesRaw = text(form, "moduleCodes");
  const startTime = text(form, "startTime");
  const endTime = text(form, "endTime");
  const venue = text(form, "venue");
  const recordingUrl = text(form, "recordingUrl");

  if (!cohortId) return { error: "Cohort ID is required." };
  if (!title) return { error: "Session title is required." };
  if (!startTime || !endTime) return { error: "Start and end times are required." };
  // The form's times are Addis Ababa time. This runs on a UTC server, where `new Date()` would read them as UTC.
  const start = parseTradeLocalDateTime(startTime);
  const end = parseTradeLocalDateTime(endTime);
  if (!start || !end) return { error: "Enter the start and end as a date and a time." };
  if (end <= start) return { error: "The session has to end after it starts." };

  const moduleCodes = moduleCodesRaw
    ? moduleCodesRaw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const api = await serverApi();
  const res = await api.v1.trade.cohorts[":cohortId"].sessions.$post({
    param: { cohortId },
    json: {
      title,
      description: description || undefined,
      moduleCodes,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      venue: venue || null,
      recordingUrl: recordingUrl || null,
      learnerMaterials: [],
      facilitatorMaterials: [],
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to create session (${res.status}).` };
  }

  revalidatePath(`/cohorts/${cohortId}`);
  return { error: null, success: true };
}

export async function recordAttendanceAction(
  sessionId: string,
  records: { userId: string; organizationId: string; status: AttendanceStatus; notes?: string }[],
): Promise<ActionState> {
  if (!sessionId) return { error: "Session ID is required." };
  if (!records.length) return { error: "No attendance records provided." };

  const api = await serverApi();
  const res = await api.v1.trade.sessions[":id"].attendance.$post({
    param: { id: sessionId },
    json: {
      records: records.map((r) => ({
        userId: r.userId,
        organizationId: r.organizationId,
        status: r.status,
        notes: r.notes || null,
      })),
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to record attendance (${res.status}).` };
  }

  revalidatePath(`/cohorts`);
  return { error: null, success: true };
}

export async function sendRemindersAction(sessionId: string): Promise<ActionState> {
  if (!sessionId) return { error: "Session ID is required." };

  const api = await serverApi();
  const res = await api.v1.trade.sessions[":id"].reminders.$post({
    param: { id: sessionId },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: data?.error ?? `Failed to send reminders (${res.status}).` };
  }

  const json = (await res.json()) as { queued: number };
  return { error: null, success: true, data: json };
}
