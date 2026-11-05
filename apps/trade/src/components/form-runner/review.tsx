"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import type { Answers, FormCheck, FormDefinition, FormQuestion, FormSection } from "@entrust/forms";
import { Button, Card } from "@entrust/ui";
import { ConfirmDialog } from "../confirm-dialog";
import { answerLines, problemText, questionText } from "./text";
import type { SubmitCopy } from "./types";

export interface ReviewProps {
  definition: FormDefinition;
  sections: readonly FormSection[];
  visibleBySection: ReadonlyMap<string, FormQuestion[]>;
  answers: Answers;
  check: FormCheck;
  variables: Readonly<Record<string, string>> | undefined;
  readOnly: boolean;
  top: ReactNode;
  /** Present when the form can be sent. */
  onSubmit: (() => Promise<void>) | undefined;
  submit: SubmitCopy;
  onGoTo: (sectionId: string, questionId?: string) => void;
}

/** Every shown question with its answer, what is still missing, and the button to send. */
export function Review({ definition, sections, visibleBySection, answers, check, variables, readOnly, top, onSubmit, submit, onGoTo }: ReviewProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const missing = new Map(check.incomplete.map((p) => [p.question, p]));
  const invalid = new Map(check.errors.map((p) => [p.question, p]));
  const problems = missing.size + invalid.size;
  const firstProblem = [...sections].flatMap((s) => visibleBySection.get(s.id) ?? []).find((q) => missing.has(q.id) || invalid.has(q.id));
  const ready = problems === 0;

  async function send() {
    if (!onSubmit) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit();
      // The caller moves on. Keep the dialog busy so nobody taps twice while the page changes.
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't send it. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{readOnly ? "Your answers" : "Check your answers"}</h2>
        {!readOnly && <p className="mt-1 text-base text-ink-2">Look through your answers. Use Change to fix anything.</p>}
      </div>

      {top}

      {!readOnly && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${ready ? "border-ok/30 bg-ok-50" : "border-warn/30 bg-warn-50"}`}
          role="status"
        >
          {ready ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-base font-semibold text-ink">
              {ready ? "Everything is answered." : `${problems} ${problems === 1 ? "answer needs" : "answers need"} your attention.`}
            </p>
            {!ready && firstProblem && (
              <button
                type="button"
                onClick={() => onGoTo(firstProblem.section, firstProblem.id)}
                className="inline-flex h-11 items-center rounded-md px-1 text-base font-semibold text-brand-700 underline underline-offset-4"
              >
                Go to the first one
              </button>
            )}
          </div>
        </div>
      )}

      {sections.map((section) => {
        const questions = visibleBySection.get(section.id) ?? [];
        if (questions.length === 0) return null;
        return (
          <Card key={section.id} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3">
              <h3 className="font-display text-base font-bold text-ink">{section.title}</h3>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onGoTo(section.id)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Change
                  <span className="sr-only"> {section.title}</span>
                </button>
              )}
            </div>
            <dl className="divide-y divide-line">
              {questions.map((q) => {
                const lines = answerLines(q, answers[q.id]);
                const problem = invalid.get(q.id) ?? missing.get(q.id);
                return (
                  <div key={q.id} className="px-4 py-3">
                    <dt className="text-sm text-ink-2">{questionText(q.text, variables)}</dt>
                    <dd className="mt-1 text-base text-ink">
                      {lines === null ? (
                        q.optional ? (
                          <span className="text-ink-3">Not answered (optional)</span>
                        ) : (
                          <span className="font-medium text-warn">Not answered</span>
                        )
                      ) : lines.length === 1 ? (
                        <span className="whitespace-pre-wrap break-words">{lines[0]}</span>
                      ) : (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {lines.map((line, i) => (
                            <li key={i} className="break-words">
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                      {problem && lines !== null && <span className="mt-1 block text-sm font-medium text-danger">{problemText(problem)}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        );
      })}

      {!readOnly && onSubmit && (
        <div className="space-y-3 pb-4">
          <Button size="lg" className="w-full sm:w-auto" disabled={!ready} onClick={() => setConfirming(true)}>
            {submit.button}
          </Button>
          {!ready && <p className="text-sm text-ink-2">You can send it once every question is answered.</p>}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={submit.confirmTitle}
        confirmLabel={submit.confirmButton}
        busy={busy}
        error={error}
        onConfirm={() => void send()}
        onCancel={() => {
          setConfirming(false);
          setError(undefined);
        }}
      >
        <p>{submit.confirmBody}</p>
      </ConfirmDialog>
    </div>
  );
}
