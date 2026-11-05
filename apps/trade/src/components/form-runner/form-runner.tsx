"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { checkAnswers, visibleQuestions } from "@entrust/forms";
import type { Answer, FormQuestion, FormSection } from "@entrust/forms";
import { Button, cn } from "@entrust/ui";
import { QuestionBlock } from "./question-block";
import { Review } from "./review";
import { SaveStatus } from "./save-status";
import { problemText } from "./text";
import { REVIEW_STEP, type FormRunnerProps, type SubmitCopy } from "./types";
import { useAutosave } from "./use-autosave";

const DEFAULT_SUBMIT: SubmitCopy = {
  button: "Submit",
  confirmTitle: "Submit this form?",
  confirmBody: "Check that your answers are right. You may not be able to change them after you submit.",
  confirmButton: "Submit",
};

const hasContent = (node: ReactNode) => node !== null && node !== undefined && node !== false;

// Documented in ./types.ts (FormRunnerProps).
export function FormRunner(props: FormRunnerProps) {
  const { definition, readOnly = false, variables, renderAttachments } = props;
  const [today] = useState(() => props.today ?? new Date().toISOString().slice(0, 10));
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => ({ ...props.answers }));
  const answersRef = useRef(answers);
  const autosave = useAutosave(props.onSave, { enabled: !readOnly });
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(new Set());
  const [listOpen, setListOpen] = useState(false);

  // Which questions are shown is worked out here, from the answers in front of the person, so a question appears or
  // goes the moment the answer it depends on changes.
  const visible = useMemo(() => visibleQuestions(definition, answers), [definition, answers]);
  const visibleBySection = useMemo(() => {
    const bySection = new Map<string, FormQuestion[]>();
    for (const q of visible) bySection.set(q.section, [...(bySection.get(q.section) ?? []), q]);
    return bySection;
  }, [visible]);
  const check = useMemo(() => checkAnswers(definition, answers, { today }), [definition, answers, today]);

  const attachments = new Map<string, ReactNode>(definition.sections.map((s) => [s.id, renderAttachments?.(s) ?? null]));
  const sections = definition.sections.filter((s) => (visibleBySection.get(s.id)?.length ?? 0) > 0 || hasContent(attachments.get(s.id)));

  const invalidByQuestion = new Map(check.errors.map((p) => [p.question, p]));
  const missingByQuestion = new Map(check.incomplete.map((p) => [p.question, p]));
  const sectionOf = new Map(definition.questions.map((q) => [q.id, q.section]));
  const sectionsWithProblems = new Set([...invalidByQuestion.keys(), ...missingByQuestion.keys()].map((id) => sectionOf.get(id)));

  const [step, setStep] = useState<string>(() => {
    if (props.initialSectionId === REVIEW_STEP) return REVIEW_STEP;
    if (props.initialSectionId && sections.some((s) => s.id === props.initialSectionId)) return props.initialSectionId;
    if (readOnly) return REVIEW_STEP;
    // Resume where the person left off: the first section with something still to answer.
    const firstOpen = sections.find((s) => {
      const progress = check.progress.bySection[s.id];
      return progress ? progress.answered < progress.total : false;
    });
    return firstOpen?.id ?? (Object.keys(props.answers).length > 0 ? REVIEW_STEP : (sections[0]?.id ?? REVIEW_STEP));
  });
  const current = step === REVIEW_STEP ? REVIEW_STEP : (sections.find((s) => s.id === step)?.id ?? sections[0]?.id ?? REVIEW_STEP);
  const index = sections.findIndex((s) => s.id === current);
  const section: FormSection | undefined = sections[index];

  // After moving to another step, bring the person to its top (or to the question they asked for).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusQuestion = useRef<string | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    const target = focusQuestion.current ? document.getElementById(`q-${focusQuestion.current}`) : null;
    focusQuestion.current = null;
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [current]);

  function goTo(next: string, questionId?: string) {
    moved.current = true;
    focusQuestion.current = questionId ?? null;
    setAttempted((previous) => {
      const marked = new Set(previous);
      if (current !== REVIEW_STEP) marked.add(current);
      if (next === REVIEW_STEP) for (const s of sections) marked.add(s.id);
      return marked;
    });
    void autosave.flush();
    setStep(next);
    setListOpen(false);
    props.onSectionChange?.(next);
  }

  function change(question: FormQuestion, value: Answer | null) {
    const next = { ...answersRef.current };
    if (value === null) delete next[question.id];
    else next[question.id] = value;
    answersRef.current = next;
    setAnswers(next);
    if (readOnly) return;
    // An answer that isn't valid stays on screen with its message but is not sent, so the saved copy is never invalid.
    const invalid = checkAnswers(definition, next, { today }).errors.some((p) => p.question === question.id);
    if (!invalid) autosave.queue({ [question.id]: value });
  }

  const notKnownAllowed = props.allowNotKnown ?? ((q: FormQuestion) => !q.mustBe);
  const submit = props.onSubmit
    ? async () => {
        const saved = await autosave.flush();
        if (!saved) throw new Error("Your latest changes could not be saved yet. Check your connection and try again.");
        await props.onSubmit?.();
      }
    : undefined;

  const percent = check.progress.percent;
  const questions = section ? (visibleBySection.get(section.id) ?? []) : [];

  const sectionList = (
    <nav aria-label="Sections">
      <ol className="space-y-1">
        {sections.map((s, i) => {
          const progress = check.progress.bySection[s.id];
          const done = progress ? progress.total > 0 && progress.answered === progress.total : false;
          const flagged = sectionsWithProblems.has(s.id) && attempted.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={s.id === current ? "step" : undefined}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  s.id === current ? "bg-brand-50 font-semibold text-brand-900" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    done ? "bg-brand-600 text-white" : flagged ? "bg-warn-50 text-warn ring-1 ring-warn/40" : "bg-surface-2 text-ink-2 ring-1 ring-line-strong",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" /> : flagged ? <AlertCircle className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{s.title}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {progress && progress.total > 0 ? `${progress.answered} of ${progress.total}` : ""}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => goTo(REVIEW_STEP)}
            aria-current={current === REVIEW_STEP ? "step" : undefined}
            className={cn(
              "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
              current === REVIEW_STEP ? "bg-brand-50 font-semibold text-brand-900" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 ring-1 ring-line-strong" aria-hidden="true">
              <ClipboardCheck className="size-3.5" />
            </span>
            {readOnly ? "Your answers" : "Check and send"}
          </button>
        </li>
      </ol>
    </nav>
  );

  return (
    <div className="md:grid md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <aside className="hidden md:block">
        <div className="sticky top-24">{sectionList}</div>
      </aside>

      <div className="min-w-0">
        <div className="space-y-3 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <p className="text-sm font-semibold text-ink-2">
              {current === REVIEW_STEP ? (readOnly ? "Your answers" : "Last step") : `Step ${index + 1} of ${sections.length}`}
            </p>
            <SaveStatus state={autosave.state} onRetry={() => void autosave.flush()} readOnly={readOnly} />
          </div>
          <div
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm text-ink-3">
            <span>
              {check.progress.answered} of {check.progress.total} questions answered
            </span>
            <button
              type="button"
              aria-expanded={listOpen}
              aria-controls="runner-sections"
              onClick={() => setListOpen((open) => !open)}
              className="inline-flex h-11 items-center gap-1 rounded-md px-2 font-semibold text-brand-700 hover:bg-brand-50 md:hidden"
            >
              All steps
              <ChevronDown className={cn("size-4 transition-transform", listOpen && "rotate-180")} aria-hidden="true" />
            </button>
          </div>
          <div id="runner-sections" hidden={!listOpen} className="rounded-lg border border-line bg-surface p-2 md:hidden">
            {listOpen && sectionList}
          </div>
        </div>

        {current === REVIEW_STEP ? (
          <Review
            definition={definition}
            sections={sections}
            visibleBySection={visibleBySection}
            answers={answers}
            check={check}
            variables={variables}
            readOnly={readOnly}
            top={props.reviewTop}
            onSubmit={submit}
            submit={props.submit ?? DEFAULT_SUBMIT}
            onGoTo={goTo}
          />
        ) : (
          section && (
            <section aria-labelledby="runner-section-title" className="space-y-6">
              <div className="space-y-2">
                <h2 id="runner-section-title" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-ink outline-none">
                  {section.title}
                </h2>
                {section.purpose && <p className="text-base text-ink-2">{section.purpose}</p>}
                {section.notes?.map((note) => (
                  <p key={note} className="text-sm text-ink-2">
                    {note}
                  </p>
                ))}
              </div>

              <div className="space-y-8">
                {questions.map((question, i) => {
                  const invalid = invalidByQuestion.get(question.id);
                  const missing = missingByQuestion.get(question.id);
                  const showMissing = Boolean(missing) && attempted.has(section.id);
                  const error = invalid ? problemText(invalid) : showMissing && missing ? problemText(missing) : undefined;
                  const answer = answers[question.id];
                  return (
                    <Fragment key={question.id}>
                      {question.group && question.group !== questions[i - 1]?.group && (
                        <h3 className="border-t border-line pt-6 font-display text-lg font-bold text-ink">{question.group}</h3>
                      )}
                      <QuestionBlock
                        question={question}
                        answer={answer}
                        onChange={(value) => change(question, value)}
                        disabled={readOnly}
                        notKnownAllowed={notKnownAllowed(question) && !readOnly}
                        error={error}
                        variables={variables}
                        today={today}
                      />
                    </Fragment>
                  );
                })}
              </div>

              {attachments.get(section.id)}
            </section>
          )
        )}

        {current !== REVIEW_STEP && (
          <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xs sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
            {index > 0 && (
              <Button variant="secondary" size="lg" className="flex-1 md:flex-none" onClick={() => goTo(sections[index - 1]?.id ?? current)}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
            )}
            <Button size="lg" className="flex-1 md:flex-none" onClick={() => goTo(sections[index + 1]?.id ?? REVIEW_STEP)}>
              {index >= sections.length - 1 ? (readOnly ? "See answers" : "Check answers") : "Next"}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
