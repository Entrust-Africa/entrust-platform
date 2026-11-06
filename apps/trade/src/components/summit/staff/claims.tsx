"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { DOCUMENT_LABELS, type SummitApplication } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import { VERIFICATION_CLASSES, labelOf, type Workspace } from "@/lib/summit-staff";
import { Outcome, Select, TextArea, useAction } from "./use-action";

type Verification = Workspace["verification"][number];
type ClassId = (typeof VERIFICATION_CLASSES)[number]["id"];
type Document = SummitApplication["documents"][number];

const TONES: Record<string, "ok" | "info" | "warn" | "idle"> = {
  independently_verified: "ok",
  document_supported: "info",
  self_reported: "warn",
  not_verified: "warn",
  not_applicable: "idle",
};

/**
 * Verification of the applicant's claims: what each rests on. A document the applicant uploaded is never enough for
 * "independently verified"; the officer says what was checked outside the application.
 */
export function Claims({ applicationId, workspace, documents, canEdit }: { applicationId: string; workspace: Workspace; documents: Document[]; canEdit: boolean }) {
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const known = new Map(workspace.verification.map((v) => [v.claim, v]));
  const claims = [
    ...workspace.claims.map((c) => ({ id: c.id, label: c.label, hint: c.evidence })),
    ...workspace.verification.filter((v) => !workspace.claims.some((c) => c.id === v.claim)).map((v) => ({ id: v.claim, label: v.label ?? v.claim, hint: "" })),
    ...extra.filter((id) => !known.has(id) && !workspace.claims.some((c) => c.id === id)).map((id) => ({ id, label: id, hint: "" })),
  ];
  return (
    <section aria-labelledby="claims" className="space-y-3">
      <h2 id="claims" className="font-display text-xl font-bold text-ink">
        Verification of claims
      </h2>
      <p className="max-w-2xl text-sm text-ink-2">Say what each important claim rests on. Nothing here changes the score; the committee reads it beside the score.</p>
      {claims.map((claim) => (
        <ClaimRow key={claim.id} applicationId={applicationId} claim={claim} current={known.get(claim.id)} documents={documents} canEdit={canEdit} />
      ))}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Another claim
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={100}
              placeholder="for example export_contract_2025"
              className="h-9 w-72 max-w-full rounded-md border border-line-strong bg-surface px-3 text-sm font-normal"
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            disabled={!custom.trim()}
            onClick={() => {
              setExtra([...extra, custom.trim()]);
              setCustom("");
            }}
          >
            Add
          </Button>
        </div>
      )}
    </section>
  );
}

function ClaimRow({ applicationId, claim, current, documents, canEdit }: { applicationId: string; claim: { id: string; label: string; hint: string }; current: Verification | undefined; documents: Document[]; canEdit: boolean }) {
  const save = useAction();
  const [open, setOpen] = useState(false);
  const [cls, setCls] = useState<ClassId>((current?.class as ClassId | undefined) ?? "self_reported");
  const [check, setCheck] = useState(current?.independentCheck ?? "");
  const [chosen, setChosen] = useState<string[]>(current?.documents.map((d) => d.id) ?? []);
  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{claim.label}</p>
          {claim.hint && <p className="text-xs text-ink-3">Evidence: {claim.hint}</p>}
        </div>
        {current ? <StatusBadge tone={TONES[current.class] ?? "idle"}>{labelOf(VERIFICATION_CLASSES, current.class)}</StatusBadge> : <StatusBadge tone="idle">Not classified</StatusBadge>}
      </div>
      {current && (
        <div className="text-xs text-ink-2">
          {current.independentCheck && <p>Checked: {current.independentCheck}</p>}
          {current.documents.length > 0 && <p>Documents: {current.documents.map((d) => d.fileName).join(", ")}</p>}
          <p className="text-ink-3">
            By {current.by?.name ?? "an officer"}.
          </p>
        </div>
      )}
      {canEdit && (
        <div>
          <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Close" : current ? "Change" : "Classify"}
          </button>
          {open && (
            <div className="mt-2 space-y-3 rounded-md bg-canvas p-3">
              <Select label="What it rests on" value={cls} onChange={(e) => setCls(e.target.value as ClassId)} options={VERIFICATION_CLASSES} />
              {cls === "independently_verified" && (
                <TextArea label="What you checked outside the application" value={check} onChange={(e) => setCheck(e.target.value)} maxLength={1000} hint="Required. An uploaded document alone is never independent verification." />
              )}
              {documents.length > 0 && (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-semibold text-ink">Documents that support it</legend>
                  {documents.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm text-ink-2">
                      <input type="checkbox" checked={chosen.includes(d.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, d.id] : chosen.filter((x) => x !== d.id))} />
                      {DOCUMENT_LABELS[d.kind]}: {d.fileName}
                    </label>
                  ))}
                </fieldset>
              )}
              <Button
                size="sm"
                loading={save.busy}
                onClick={async () => {
                  if (
                    await save.run(
                      () =>
                        ok(
                          browserApi().v1.summit.applications[":id"].verification[":claim"].$put({
                            param: { id: applicationId, claim: claim.id },
                            json: { class: cls, documents: chosen, ...(check.trim() ? { independentCheck: check.trim() } : {}) },
                          }),
                        ),
                      "Saved.",
                    )
                  )
                    setOpen(false);
                }}
              >
                Save
              </Button>
              <Outcome error={save.error} done={save.done} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
