"use client";

import { isNotKnown } from "@entrust/forms";
import type { Answer, FormQuestion } from "@entrust/forms";
import { cn } from "@entrust/ui";
import { QuestionInput } from "./inputs";
import { questionText } from "./text";

const CHOICE_TYPES = ["single_choice", "multiple_choice", "yes_no"];

export interface QuestionBlockProps {
  question: FormQuestion;
  answer: Answer | undefined;
  onChange: (value: Answer | null) => void;
  disabled: boolean;
  /** Offer "I don't know". */
  notKnownAllowed: boolean;
  /** What is wrong with the answer, or that it is missing, in a sentence. */
  error: string | undefined;
  variables: Readonly<Record<string, string>> | undefined;
  today: string;
}

/** One question: its words, its control, "I don't know" where the form allows it, and what is wrong with the answer. */
export function QuestionBlock({ question, answer, onChange, disabled, notKnownAllowed, error, variables, today }: QuestionBlockProps) {
  const domId = `field-${question.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const unknown = isNotKnown(answer);
  const helpId = question.help ? `${domId}-help` : undefined;
  const errorId = error ? `${domId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const text = questionText(question.text, variables);
  const choice = CHOICE_TYPES.includes(question.type);

  const heading = (
    <>
      {text}
      {question.optional && <span className="ml-2 text-sm font-normal text-ink-3">(optional)</span>}
    </>
  );

  return (
    <div id={`q-${question.id}`} className="scroll-mt-24 space-y-2.5">
      {choice ? (
        <p id={`${domId}-label`} className="text-base font-semibold leading-snug text-ink">
          {heading}
        </p>
      ) : (
        <label id={`${domId}-label`} htmlFor={domId} className="block text-base font-semibold leading-snug text-ink">
          {heading}
        </label>
      )}
      {question.help && (
        <p id={helpId} className="text-sm leading-relaxed text-ink-2">
          {questionText(question.help, variables)}
        </p>
      )}

      {unknown ? (
        <p className="rounded-md bg-surface-2 px-3 py-3 text-sm text-ink-2">You said you don't know the answer to this one.</p>
      ) : (
        <QuestionInput
          question={question}
          answer={answer}
          onChange={onChange}
          disabled={disabled}
          invalid={Boolean(error)}
          describedBy={describedBy}
          domId={domId}
          today={today}
        />
      )}

      {notKnownAllowed && (
        <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink-2", disabled && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            checked={unknown}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked ? { notKnown: true } : null)}
            className="size-5 shrink-0 accent-brand-600"
          />
          <span>I don't know</span>
        </label>
      )}

      {error && (
        <p id={errorId} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
