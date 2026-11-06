"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import type { Workspace, WorkspaceCategory } from "@/lib/summit-staff";
import { scoreText } from "@/lib/summit-staff";
import { Outcome, TextArea, useAction } from "./use-action";

type Criterion = WorkspaceCategory["criteria"][number];

const input = "h-9 w-20 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25";

/** The scorecard: points for each criterion, the officer's note for each category, and the total so far. */
export function Scorecard({ applicationId, workspace, canEdit }: { applicationId: string; workspace: Workspace; canEdit: boolean }) {
  const [entered, setEntered] = useState<Record<string, string>>({});
  const save = useAction();
  const toSave = Object.fromEntries(Object.entries(entered).filter(([, v]) => v.trim() !== "" && Number.isInteger(Number(v))).map(([id, v]) => [id, Number(v)]));
  const count = Object.keys(toSave).length;
  const { score } = workspace;

  return (
    <section aria-labelledby="scorecard" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="scorecard" className="font-display text-xl font-bold text-ink">
          Scorecard
        </h2>
        <p className="text-sm text-ink-2" aria-live="polite">
          {score.complete ? (
            <>
              <span className="font-display text-2xl font-bold text-ink">{scoreText(score.total)}</span> out of 100
              {score.normalized && <span className="ml-1 text-xs text-ink-3">(scaled from {score.points} of {score.possible})</span>}
            </>
          ) : (
            "Score every criterion to get the total."
          )}
        </p>
      </div>
      {!workspace.approved && (
        <p role="status" className="rounded-md bg-warn-50 px-3 py-2 text-sm font-medium text-warn">
          The scoring rules this application uses are not approved yet, so scores can't be recorded.
        </p>
      )}
      {workspace.categories.map((category) => (
        <Category key={category.id} applicationId={applicationId} category={category} problems={workspace.noteProblems.filter((p) => p.category === category.id).map((p) => p.message)} canEdit={canEdit && workspace.approved} entered={entered} setEntered={setEntered} />
      ))}
      {canEdit && workspace.approved && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-md print:hidden">
          <Button
            loading={save.busy}
            disabled={count === 0}
            onClick={async () => {
              if (await save.run(() => ok(browserApi().v1.summit.applications[":id"].assessment.scores.$post({ param: { id: applicationId }, json: { scores: toSave } })), "Scores saved."))
                setEntered({});
            }}
          >
            {count === 0 ? "Save scores" : `Save ${count} score${count === 1 ? "" : "s"}`}
          </Button>
          <p className="text-xs text-ink-3">A score is written once. To change it later, adjust it with a reason.</p>
          <Outcome error={save.error} done={save.done} />
        </div>
      )}
    </section>
  );
}

function Category({
  applicationId,
  category,
  problems,
  canEdit,
  entered,
  setEntered,
}: {
  applicationId: string;
  category: WorkspaceCategory;
  problems: string[];
  canEdit: boolean;
  entered: Record<string, string>;
  setEntered: (next: Record<string, string>) => void;
}) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">
            {category.id}. {category.title}
          </h3>
          <p className="text-xs text-ink-3">Up to {category.maxPoints} points</p>
        </div>
        {category.applicable ? (
          <StatusBadge tone={category.points === null ? "idle" : "ok"}>{category.points === null ? "Not fully scored" : `${category.points} of ${category.maxPoints}`}</StatusBadge>
        ) : (
          <StatusBadge tone="idle">Does not apply</StatusBadge>
        )}
      </div>
      {category.assess.length > 0 && (
        <details className="text-sm text-ink-2">
          <summary className="cursor-pointer font-semibold text-ink">What to assess</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {category.assess.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {category.evidence.length > 0 && (
            <p className="mt-2">
              <span className="font-semibold text-ink">Evidence to look for:</span> {category.evidence.join("; ")}
            </p>
          )}
        </details>
      )}
      {category.applicable ? (
        <>
          <ul className="divide-y divide-line">
            {category.criteria.map((c) => (
              <CriterionRow key={c.id} applicationId={applicationId} criterion={c} canEdit={canEdit} value={entered[c.id] ?? ""} onChange={(v) => setEntered({ ...entered, [c.id]: v })} />
            ))}
          </ul>
          <CategoryNote applicationId={applicationId} category={category} problems={problems} canEdit={canEdit} />
        </>
      ) : (
        <p className="text-sm text-ink-2">The applicant is not seeking investment, so this category is left out and the other points are scaled up.</p>
      )}
    </Card>
  );
}

function CriterionRow({ applicationId, criterion, canEdit, value, onChange }: { applicationId: string; criterion: Criterion; canEdit: boolean; value: string; onChange: (value: string) => void }) {
  const adjust = useAction();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const scored = criterion.points !== null;
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            <span className="font-mono font-semibold">{criterion.id}</span> {criterion.text}
          </p>
          {criterion.guidance.length > 0 && (
            <details className="mt-1 text-xs text-ink-2">
              <summary className="cursor-pointer font-semibold">Scoring guidance</summary>
              <ul className="mt-1 space-y-0.5">
                {criterion.guidance.map((g) => (
                  <li key={`${g.from}-${g.to}`}>
                    <span className="font-semibold">{g.from === g.to ? g.from : `${g.from} to ${g.to}`}:</span> {g.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scored ? (
            <>
              <span className="font-display text-lg font-bold text-ink">{criterion.points}</span>
              <span className="text-xs text-ink-3">of {criterion.maxPoints}</span>
              {criterion.adjusted && <StatusBadge tone="warn">Adjusted</StatusBadge>}
            </>
          ) : canEdit ? (
            <label className="flex items-center gap-2 text-xs text-ink-3">
              <span className="sr-only">Points for {criterion.id}</span>
              <input type="number" inputMode="numeric" min={0} max={criterion.maxPoints} step={1} value={value} onChange={(e) => onChange(e.target.value)} className={input} />
              of {criterion.maxPoints}
            </label>
          ) : (
            <span className="text-xs text-ink-3">Not scored</span>
          )}
        </div>
      </div>
      {scored && criterion.adjusted && criterion.original && (
        <p className="text-xs text-ink-3">
          First scored {criterion.original.points} by {criterion.original.by?.name ?? "an officer"}.
        </p>
      )}
      {scored && canEdit && (
        <div>
          <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Cancel the adjustment" : "Adjust this score"}
          </button>
          {open && (
            <div className="mt-2 space-y-2 rounded-md bg-canvas p-3">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                New points
                <input type="number" min={0} max={criterion.maxPoints} step={1} value={points} onChange={(e) => setPoints(e.target.value)} className={input} />
                of {criterion.maxPoints}
              </label>
              <TextArea label="Why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} hint="Kept with the old and new score, your name and the time." />
              <Button
                size="sm"
                loading={adjust.busy}
                disabled={points === "" || !reason.trim()}
                onClick={async () => {
                  if (await adjust.run(() => ok(browserApi().v1.summit.applications[":id"].assessment.adjustments.$post({ param: { id: applicationId }, json: { criterion: criterion.id, points: Number(points), reason } })), "Adjusted."))
                    setOpen(false);
                }}
              >
                Record the adjustment
              </Button>
              <Outcome error={adjust.error} done={adjust.done} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CategoryNote({ applicationId, category, problems, canEdit }: { applicationId: string; category: WorkspaceCategory; problems: string[]; canEdit: boolean }) {
  const note = useAction();
  const [justification, setJustification] = useState(category.note?.justification ?? "");
  const [evidence, setEvidence] = useState((category.note?.evidence ?? []).join("\n"));
  return (
    <div className="space-y-2 rounded-md bg-canvas p-3">
      <h4 className="text-sm font-semibold text-ink">Your note on {category.title.toLowerCase()}</h4>
      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-warn">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <>
          <TextArea label="Why these points" value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={2000} />
          <TextArea label="Evidence the points rest on" hint="One item per line." value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          <Button
            size="sm"
            variant="secondary"
            loading={note.busy}
            onClick={() =>
              note.run(
                () =>
                  ok(
                    browserApi().v1.summit.applications[":id"].assessment.notes[":category"].$put({
                      param: { id: applicationId, category: category.id },
                      json: { justification, evidence: evidence.split("\n").map((l) => l.trim()).filter(Boolean) },
                    }),
                  ),
                "Note saved.",
              )
            }
          >
            Save the note
          </Button>
          <Outcome error={note.error} done={note.done} />
        </>
      ) : category.note ? (
        <div className="space-y-1 text-sm text-ink-2">
          <p>{category.note.justification}</p>
          {category.note.evidence.length > 0 && (
            <ul className="list-disc pl-5">
              {category.note.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-3">No note yet.</p>
      )}
    </div>
  );
}
