"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { CoffeeType, EvidenceStatus, PriceUnit, RecordedStatus } from "@entrust/gate-engine";
import { serverApi } from "@/lib/api";

// The case pages' changes. Each one calls the API as the signed-in visitor, so the API decides
// what they may do and the message it refuses with is what the form shows.

/** What an action form shows after it runs: the API's refusal, or nothing. */
export type ActionState = { error: string | null };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};
const required = (form: FormData, key: string) => text(form, key) ?? "";

async function failure(res: { status: number; json(): Promise<unknown> }): Promise<ActionState> {
  if (res.status === 401) redirect("/sign-in");
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return { error: body?.error ?? `The request failed (${res.status}).` };
}

async function settle(res: { ok: boolean; status: number; json(): Promise<unknown> }): Promise<ActionState> {
  if (!res.ok) return failure(res);
  refresh();
  return { error: null };
}

/** Facts from the new case form, which names its fields after the fact keys. */
function caseFacts(form: FormData): Record<string, string | string[]> {
  const facts: Record<string, string | string[]> = {};
  for (const key of ["product", "transportMode", "coldChain", "incoterm"]) {
    const value = text(form, key);
    if (value) facts[key] = value;
  }
  const destination = text(form, "otherDestination") ?? text(form, "destinationCountry");
  if (destination) facts.destinationCountry = destination.toUpperCase();
  const paymentTerms = form.getAll("paymentTerms").filter((v): v is string => typeof v === "string" && v !== "");
  if (paymentTerms.length) facts.paymentTerms = paymentTerms;
  return facts;
}

export async function createCase(_: ActionState, form: FormData): Promise<ActionState> {
  const cad = text(form, "cadAmountUsd");
  const res = await (await serverApi()).v1.clear.cases.$post({
    json: {
      organizationId: text(form, "organizationId"),
      facts: caseFacts(form),
      cadAmountUsd: cad === undefined ? undefined : Number(cad),
    },
  });
  if (!res.ok) return failure(res);
  const created = await res.json();
  redirect(`/cases/${created.id}`);
}

export async function transitionStep(_: ActionState, form: FormData): Promise<ActionState> {
  const res = await (await serverApi()).v1.clear.cases[":id"].steps[":stepId"].transition.$post({
    param: { id: required(form, "caseId"), stepId: required(form, "stepId") },
    json: { to: required(form, "to") as RecordedStatus, reason: text(form, "reason"), occurredAt: text(form, "occurredAt") },
  });
  return settle(res);
}

export async function submitEvidence(_: ActionState, form: FormData): Promise<ActionState> {
  const res = await (await serverApi()).v1.clear.cases[":id"].evidence.$post({
    param: { id: required(form, "caseId") },
    json: { type: required(form, "type"), issuedOn: text(form, "issuedOn") },
  });
  return settle(res);
}

/**
 * A decision on submitted evidence. The API takes a review in two moves (start it, then decide), so
 * evidence still waiting is put under review first: both are recorded, as the reviewer's.
 */
export async function reviewEvidence(_: ActionState, form: FormData): Promise<ActionState> {
  const api = await serverApi();
  const param = { id: required(form, "caseId"), evidenceId: required(form, "evidenceId") };
  const to = required(form, "to") as EvidenceStatus;
  const start = form.get("from") === "submitted" && to !== "under_review";
  if (start) {
    const started = await api.v1.clear.cases[":id"].evidence[":evidenceId"].review.$post({ param, json: { to: "under_review" } });
    if (!started.ok) return failure(started);
  }
  const res = await api.v1.clear.cases[":id"].evidence[":evidenceId"].review.$post({
    param,
    json: { to, note: text(form, "note"), issuedOn: text(form, "issuedOn") },
  });
  // A started review stands even if the decision was refused (a rejection with no note, say).
  if (!res.ok && start) refresh();
  return settle(res);
}

/**
 * The facts form sends every fact it shows, with the values the case had when the page was drawn
 * (`current`). Only the ones that changed are sent on, so an untouched field changes nothing.
 */
export async function updateFacts(_: ActionState, form: FormData): Promise<ActionState> {
  const current = JSON.parse(required(form, "current") || "{}") as Record<string, string | string[]>;
  const keys = form.getAll("key").filter((k): k is string => typeof k === "string");
  const changes: Record<string, string | string[] | null> = {};
  for (const key of keys) {
    const values = form.getAll(`fact:${key}`).filter((v): v is string => typeof v === "string" && v.trim() !== "");
    const multiple = form.get(`multiple:${key}`) === "true";
    const next = multiple ? values : (values[0]?.trim() ?? null);
    const before = current[key] ?? (multiple ? [] : null);
    if (JSON.stringify(next) === JSON.stringify(before)) continue;
    changes[key] = multiple ? ((next as string[]).length ? next : null) : (next as string | null);
  }
  if (!Object.keys(changes).length) return { error: "Nothing changed." };
  const res = await (await serverApi()).v1.clear.cases[":id"].facts.$patch({
    param: { id: required(form, "caseId") },
    json: { facts: changes },
  });
  return settle(res);
}

export async function recordContract(_: ActionState, form: FormData): Promise<ActionState> {
  const amount = text(form, "amount");
  const res = await (await serverApi()).v1.clear.cases[":id"].contract.$put({
    param: { id: required(form, "caseId") },
    json: {
      number: required(form, "number"),
      buyerName: required(form, "buyerName"),
      contractDate: required(form, "contractDate"),
      unitPrice:
        amount === undefined
          ? null
          : { amount: Number(amount), currency: (text(form, "currency") ?? "USD").toUpperCase(), per: required(form, "per") as PriceUnit },
      coffeeType: (text(form, "coffeeType") as CoffeeType | undefined) ?? null,
      grade: text(form, "grade") ?? null,
      origin: text(form, "origin") ?? null,
    },
  });
  return settle(res);
}

export async function waiveFlag(_: ActionState, form: FormData): Promise<ActionState> {
  const res = await (await serverApi()).v1.clear.cases[":id"].flags[":flagId"].waive.$post({
    param: { id: required(form, "caseId"), flagId: required(form, "flagId") },
    json: { reason: required(form, "reason") },
  });
  return settle(res);
}

export async function reevaluateRulePack(_: ActionState, form: FormData): Promise<ActionState> {
  const res = await (await serverApi()).v1.clear.cases[":id"]["rule-pack"].$post({
    param: { id: required(form, "caseId") },
    json: { reason: required(form, "reason") },
  });
  return settle(res);
}
