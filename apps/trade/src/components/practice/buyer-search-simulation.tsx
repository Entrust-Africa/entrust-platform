"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { BUYER_SIMULATION, isStepCorrect, simulationScore, type SimulationAnswer, type SimulationOption } from "@entrust/trade-engine";

const Feedback = ({ correct, children }: { correct: boolean; children: React.ReactNode }) => (
  <p className={`rounded-md border-l-4 px-3 py-2 text-sm ${correct ? "border-brand-600 bg-brand-50/50 text-ink" : "border-amber-500 bg-amber-50 text-ink"}`}>{children}</p>
);

export function BuyerSearchSimulation({ marketIntelligenceUrl, marketplaceUrl }: { marketIntelligenceUrl: string; marketplaceUrl: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SimulationAnswer>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const finished = index >= BUYER_SIMULATION.length;

  if (finished) {
    const { correct, total } = simulationScore(answers);
    return (
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl font-bold text-ink">
          You finished with {correct} of {total} right
        </h2>
        <p className="text-sm text-ink-2">Now do it for your own product. On AfriConnect, some analyses depend on your plan, and you'll need to sign in. Put what you find in your M05 worksheets, with the source and date.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a href={marketIntelligenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-600 hover:underline">
            Open Market Intelligence on AfriConnect →
          </a>
          <a href={marketplaceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-600 hover:underline">
            Open the Marketplace on AfriConnect →
          </a>
          <Link href="/modules/M05" className="text-sm font-semibold text-brand-600 hover:underline">
            Back to M05
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setAnswers({});
            setChecked({});
            setIndex(0);
          }}
        >
          Start again
        </Button>
      </Card>
    );
  }

  const step = BUYER_SIMULATION[index]!;
  const answer = answers[step.id];
  const shown = checked[step.id] === true;
  const correct = isStepCorrect(step, answer);
  const answered =
    step.kind === "choice"
      ? typeof answer === "string"
      : step.kind === "multi"
        ? Array.isArray(answer) && answer.length > 0
        : step.records.every((r) => (answer as Record<string, string> | undefined)?.[r.id]);
  const set = (value: SimulationAnswer) => {
    setAnswers({ ...answers, [step.id]: value });
    setChecked({ ...checked, [step.id]: false });
  };
  const optionFeedback = (o: SimulationOption) => <Feedback correct={o.correct}>{o.feedback}</Feedback>;

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-3">
          Step {index + 1} of {BUYER_SIMULATION.length}
        </p>
        <StatusBadge tone="info">{step.where}</StatusBadge>
      </div>
      <h2 className="font-display text-xl font-bold text-ink">{step.title}</h2>
      <p className="text-sm text-ink-2">{step.body}</p>

      {step.table && (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs font-semibold text-ink-2">
              <tr>
                {step.table.head.map((h) => (
                  <th key={h} className="min-w-24 px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {step.table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i} className="min-w-24 px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold text-ink">{step.question}</legend>

        {step.kind === "choice" &&
          step.options.map((o) => (
            <div key={o.id} className="space-y-1">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-3 text-sm text-ink">
                <input type="radio" name={step.id} className="mt-1" checked={answer === o.id} onChange={() => set(o.id)} />
                {o.text}
              </label>
              {shown && answer === o.id && optionFeedback(o)}
            </div>
          ))}

        {step.kind === "multi" &&
          step.options.map((o) => {
            const list = Array.isArray(answer) ? (answer as readonly string[]) : [];
            const on = list.includes(o.id);
            return (
              <div key={o.id} className="space-y-1">
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-line p-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1" checked={on} onChange={() => set(on ? list.filter((id) => id !== o.id) : [...list, o.id])} />
                  {o.text}
                </label>
                {shown && (on || o.correct) && optionFeedback(o)}
              </div>
            );
          })}

        {step.kind === "classify" &&
          step.records.map((record) => {
            const classes = (answer ?? {}) as Record<string, string>;
            return (
              <div key={record.id} className="space-y-2 rounded-md border border-line p-3">
                <p className="font-semibold text-ink">{record.name}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {record.facts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
                <label className="block text-xs font-semibold text-ink-3">
                  Your decision
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                    value={classes[record.id] ?? ""}
                    onChange={(e) => set({ ...classes, [record.id]: e.target.value })}
                  >
                    <option value="">Choose</option>
                    {step.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {shown && <Feedback correct={classes[record.id] === record.answer}>{record.feedback}</Feedback>}
              </div>
            );
          })}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {!shown ? (
          <Button type="button" disabled={!answered} onClick={() => setChecked({ ...checked, [step.id]: true })}>
            Check my answer
          </Button>
        ) : (
          <Button type="button" onClick={() => setIndex(index + 1)}>
            {correct ? "Next" : "Next, I've read why"}
          </Button>
        )}
        {index > 0 && (
          <Button type="button" variant="ghost" onClick={() => setIndex(index - 1)}>
            Back
          </Button>
        )}
      </div>
    </Card>
  );
}
