"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isNotKnown, visibleQuestions } from "@entrust/forms";
import type { Answer, FormDefinition } from "@entrust/forms";
import { Button, Card } from "@entrust/ui";
import { QuestionBlock } from "@/components/form-runner/question-block";
import { tradeFetch } from "@/lib/trade-client";

const amountFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** What the form holds for a question now, in words, so the person can see what went wrong. */
function received(answer: unknown): string {
  if (answer === undefined || answer === null) return "nothing";
  if (isNotKnown(answer as Answer)) return "\"I don't know\"";
  const money = answer as { amount?: unknown; currency?: unknown };
  return typeof money.amount === "number" ? `${amountFormat.format(money.amount)} ${String(money.currency ?? "")}`.trim() : "nothing";
}

/**
 * A submitted diagnostic whose money amounts staff asked for again: until 12 November 2026 the amount boxes were too
 * narrow to show what was typed. Only the amount questions are asked, every one of them afresh, and they are sent once.
 */
export function AmountsAgain({
  token,
  definition,
  answers,
  variables,
}: {
  token: string;
  definition: FormDefinition;
  answers: Record<string, unknown>;
  variables: Record<string, string>;
}) {
  const router = useRouter();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const questions = useMemo(() => visibleQuestions(definition, answers as never).filter((q) => q.type === "money"), [definition, answers]);
  const [values, setValues] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const missing = questions.filter((q) => !q.optional && values[q.id] === undefined);

  async function send() {
    setTried(true);
    setError(null);
    if (missing.length > 0) return setError("Enter every amount, or tick \"I don't know\".");
    setBusy(true);
    const res = await tradeFetch("PUT", `/public/diagnostic/${token}/amounts`, { answers: values });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-ink">Please enter your amounts again</h2>
        <p className="text-base text-ink-2">
          Our form had a fault: the boxes for money amounts were too narrow to show what was typed in them, so the amounts we received may
          be wrong or missing. It is fixed now, and we are sorry for the trouble. Only these amounts are asked; the rest of your answers and
          your learning path stay as they are.
        </p>
      </div>

      <div className="space-y-8">
        {questions.map((question) => (
          <div key={question.id} className="space-y-2">
            <QuestionBlock
              question={question}
              answer={values[question.id]}
              onChange={(value) =>
                setValues((current) => {
                  const next = { ...current };
                  if (value === null) delete next[question.id];
                  else next[question.id] = value;
                  return next;
                })
              }
              disabled={busy}
              notKnownAllowed
              error={tried && !question.optional && values[question.id] === undefined ? "Enter the amount, or tick \"I don't know\"." : undefined}
              variables={variables}
              today={today}
            />
            <p className="text-sm text-ink-3">We received: {received(answers[question.id])}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button size="lg" onClick={() => void send()} loading={busy} className="w-full sm:w-auto">
        Send the amounts
      </Button>
    </Card>
  );
}
