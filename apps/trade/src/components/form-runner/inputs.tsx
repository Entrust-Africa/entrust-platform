"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CURRENCIES } from "@entrust/forms";
import type { Answer, FormQuestion, Money } from "@entrust/forms";
import { cn } from "@entrust/ui";
import { choiceRow, inputBase, inputBorder, textArea, textInput } from "./styles";

export interface InputProps {
  question: FormQuestion;
  answer: Answer | undefined;
  onChange: (value: Answer | null) => void;
  disabled: boolean;
  invalid: boolean;
  /** The ID of the element that describes this input (its help and error text). */
  describedBy: string | undefined;
  /** The base for DOM IDs inside the input. */
  domId: string;
  today: string;
}

const asString = (answer: Answer | undefined) => (typeof answer === "string" ? answer : "");
const asArray = (answer: Answer | undefined): string[] => (Array.isArray(answer) ? [...(answer as readonly string[])] : []);

function Choices({ question, answer, onChange, disabled, domId, describedBy }: InputProps) {
  const multiple = question.type === "multiple_choice";
  const choices = question.type === "yes_no"
    ? [
        { value: "yes", label: "Yes", exclusive: false, description: undefined as string | undefined },
        { value: "no", label: "No", exclusive: false, description: undefined as string | undefined },
      ]
    : (question.options ?? []).map((o) => ({ value: o.value, label: o.label, exclusive: Boolean(o.exclusive), description: o.description }));
  const chosen = multiple ? asArray(answer) : [asString(answer)];

  function pick(choice: { value: string; exclusive: boolean }) {
    if (!multiple) return onChange(choice.value);
    const on = chosen.includes(choice.value);
    if (on) {
      const rest = chosen.filter((v) => v !== choice.value);
      return onChange(rest.length ? rest : null);
    }
    // An "none of these" choice can't be combined with another, in either direction.
    if (choice.exclusive) return onChange([choice.value]);
    const exclusive = (question.options ?? []).filter((o) => o.exclusive).map((o) => o.value);
    return onChange([...chosen.filter((v) => !exclusive.includes(v)), choice.value]);
  }

  const compact = question.type === "yes_no";
  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby={`${domId}-label`}
      aria-describedby={describedBy}
      className={cn("grid gap-2", compact && "grid-cols-2")}
    >
      {choices.map((choice) => {
        const selected = chosen.includes(choice.value);
        return (
          <label key={choice.value} className={choiceRow(selected, disabled)}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={domId}
              value={choice.value}
              checked={selected}
              disabled={disabled}
              onChange={() => pick(choice)}
              className="size-5 shrink-0 accent-brand-600"
            />
            <span className={cn("min-w-0 flex-1", compact && "text-center font-semibold")}>
              {choice.label}
              {choice.description && <span className="mt-0.5 block text-sm font-normal leading-snug text-ink-2">{choice.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Text({ question, answer, onChange, disabled, invalid, domId, describedBy }: InputProps) {
  const long = question.type === "long_text";
  const limit = question.maxLength ?? (long ? 5000 : 300);
  const value = asString(answer);
  const props = {
    id: domId,
    value,
    disabled,
    maxLength: limit,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value === "" ? null : event.target.value),
  };
  return (
    <div>
      {long ? <textarea {...props} rows={5} className={textArea(invalid)} /> : <input {...props} type="text" className={textInput(invalid)} />}
      {long && value.length > limit * 0.8 && (
        <p className="mt-1 text-right text-xs text-ink-3">
          {value.length} of {limit} characters
        </p>
      )}
    </div>
  );
}

/** Digits with an optional minus and one decimal point; spaces and thousands commas are ignored. */
export function parseNumber(text: string, integer: boolean): number | null {
  const cleaned = text.replace(/[\s,]/g, "");
  if (!(integer ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/).test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function NumberInput({ question, answer, onChange, disabled, invalid, domId, describedBy }: InputProps) {
  const integer = Boolean(question.integer);
  const [text, setText] = useState(typeof answer === "number" ? String(answer) : "");
  const unreadable = text.trim() !== "" && parseNumber(text, integer) === null;
  return (
    <div>
      <input
        id={domId}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={text}
        disabled={disabled}
        aria-invalid={invalid || unreadable || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === "") return onChange(null);
          const parsed = parseNumber(next, integer);
          if (parsed !== null) onChange(parsed);
        }}
        className={cn(textInput(invalid || unreadable), "max-w-xs")}
      />
      {unreadable && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {integer ? "Enter a whole number, using digits only." : "Enter a number, using digits only."}
        </p>
      )}
    </div>
  );
}

function MoneyInput({ question, answer, onChange, disabled, invalid, domId, describedBy }: InputProps) {
  const currencies: readonly string[] = question.currencies ?? CURRENCIES;
  const money = answer && typeof answer === "object" && "amount" in answer ? (answer as Money) : undefined;
  const [text, setText] = useState(money ? String(money.amount) : "");
  const [currency, setCurrency] = useState(money?.currency ?? currencies[0] ?? "USD");
  const amount = parseNumber(text, false);
  const unreadable = text.trim() !== "" && amount === null;

  function emit(nextText: string, nextCurrency: string) {
    if (nextText.trim() === "") return onChange(null);
    const parsed = parseNumber(nextText, false);
    if (parsed !== null) onChange({ amount: parsed, currency: nextCurrency });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={domId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder="Amount"
          aria-label="Amount"
          aria-invalid={invalid || unreadable || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setText(event.target.value);
            emit(event.target.value, currency);
          }}
          className={cn(textInput(invalid || unreadable), "min-w-0 flex-1")}
        />
        <select
          aria-label="Currency"
          value={currency}
          disabled={disabled}
          onChange={(event) => {
            setCurrency(event.target.value);
            emit(text, event.target.value);
          }}
          className={cn(inputBase, "h-12 w-28 shrink-0", inputBorder(invalid))}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {unreadable && (
        <p className="mt-1 text-sm text-danger" role="alert">
          Enter an amount, using digits only.
        </p>
      )}
    </div>
  );
}

function DateInput({ question, answer, onChange, disabled, invalid, domId, describedBy, today }: InputProps) {
  return (
    <input
      id={domId}
      type="date"
      value={asString(answer)}
      max={question.notFuture ? today : undefined}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      className={cn(textInput(invalid), "max-w-xs")}
    />
  );
}

function ListInput({ question, answer, onChange, disabled, invalid, domId, describedBy }: InputProps) {
  const max = question.maxItems ?? 10;
  const limit = question.maxLength ?? 300;
  // The rows are this input's own while it is on screen. Blank rows are not part of the answer.
  const [items, setItems] = useState<string[]>(() => {
    const saved = asArray(answer);
    return saved.length ? saved : [""];
  });
  function update(next: string[]) {
    setItems(next);
    const filled = next.filter((v) => v.trim() !== "");
    onChange(filled.length ? filled : null);
  }

  return (
    <div className="space-y-2" aria-describedby={describedBy}>
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <input
            id={index === 0 ? domId : undefined}
            type="text"
            value={item}
            disabled={disabled}
            maxLength={limit}
            aria-label={`Item ${index + 1}`}
            aria-invalid={invalid || undefined}
            onChange={(event) => update(items.map((v, i) => (i === index ? event.target.value : v)))}
            className={cn(textInput(invalid), "min-w-0 flex-1")}
          />
          {items.length > 1 && !disabled && (
            <button
              type="button"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => update(items.filter((_, i) => i !== index))}
              className="flex size-12 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {!disabled && items.length < max && (
        <button
          type="button"
          onClick={() => setItems([...items, ""])}
          className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add another
        </button>
      )}
    </div>
  );
}

/** The control for a question, by its type. */
export function QuestionInput(props: InputProps) {
  switch (props.question.type) {
    case "single_choice":
    case "multiple_choice":
    case "yes_no":
      return <Choices {...props} />;
    case "short_text":
    case "long_text":
      return <Text {...props} />;
    case "number":
      return <NumberInput {...props} />;
    case "money":
      return <MoneyInput {...props} />;
    case "date":
      return <DateInput {...props} />;
    case "list":
      return <ListInput {...props} />;
  }
}
