"use server";

import { revalidatePath } from "next/cache";
import { serverApi } from "@/lib/api";

export type ActionState = { error: string | null; done?: boolean };

type Kind = "assessment_notice" | "platform_data";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

const failed = async (res: Response): Promise<ActionState> => {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return { error: body?.error ?? `That didn't work (${res.status}). Try again.` };
};

/** Records an acceptance: the SME's own in MIZAN, or staff recording one given on paper or in TRADE. */
export async function acceptAction(_: ActionState, form: FormData): Promise<ActionState> {
  const organizationId = text(form, "organizationId")!;
  const method = text(form, "method") as "in_platform" | "paper" | "trade";
  if (method !== "in_platform" && !text(form, "signatoryName")) return { error: "Give the name of the person who accepted for the SME." };
  if (method !== "in_platform" && !text(form, "givenOn")) return { error: "Give the date it was accepted." };
  if (method === "paper" && !text(form, "fileId")) return { error: "Upload the scan of the signed notice first." };
  if (method === "trade" && !text(form, "sourceRef")) return { error: "Give TRADE's reference for the acceptance." };
  const res = await (await serverApi()).v1.mizan.smes[":organizationId"].consents.$post({
    param: { organizationId },
    json: {
      kind: text(form, "kind") as Kind,
      method,
      signatoryName: text(form, "signatoryName"),
      signatoryRole: text(form, "signatoryRole"),
      givenOn: text(form, "givenOn"),
      noticeVersion: text(form, "noticeVersion"),
      fileId: method === "paper" ? text(form, "fileId") : undefined,
      sourceRef: method === "trade" ? text(form, "sourceRef") : undefined,
    },
  });
  if (!res.ok) return failed(res);
  revalidatePath(`/smes/${organizationId}/consent`);
  return { error: null, done: true };
}

/** Withdraws the acceptance in force. */
export async function withdrawAction(_: ActionState, form: FormData): Promise<ActionState> {
  const organizationId = text(form, "organizationId")!;
  const res = await (await serverApi()).v1.mizan.smes[":organizationId"].consents[":kind"].withdraw.$post({
    param: { organizationId, kind: text(form, "kind") as Kind },
    json: {
      signatoryName: text(form, "signatoryName"),
      signatoryRole: text(form, "signatoryRole"),
      givenOn: text(form, "givenOn"),
      fileId: text(form, "fileId"),
      reason: text(form, "reason"),
    },
  });
  if (!res.ok) return failed(res);
  revalidatePath(`/smes/${organizationId}/consent`);
  return { error: null, done: true };
}
