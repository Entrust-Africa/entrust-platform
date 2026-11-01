import Link from "next/link";
import { X } from "lucide-react";
import { Field, StatusBadge } from "@entrust/ui";
import type { Role } from "@entrust/gate-engine";
import { canWaiveFlags, evidenceActions, evidenceName, readable, stepActions } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/format";
import {
  EVIDENCE_STATUSES,
  FLAG_SEVERITIES,
  NEXT_ACTIONS,
  OWNERS,
  REQUIREMENT_STATUSES,
  TASK_STATUSES,
} from "@/lib/statuses";
import { submitEvidence, transitionStep, waiveFlag } from "../actions";
import { ActionForm } from "../action-form";
import { NoteField, SelectField } from "../inputs";
import { EvidenceReview, ReviewNote, Submission } from "./evidence";
import { Eyebrow, StepIcon } from "./parts";
import { caseHref, flagsHolding, phaseTitle, shownStatus, withStep, type Detail, type Step, type View } from "./view";

/** Everything about one step, and every change to it, in the side panel. */
export function StepPanel({ detail, step, view }: { detail: Detail; step: Step; view: View }) {
  const status = shownStatus(step);
  const closeHref = caseHref(detail.id, { ...view, step: undefined });
  const next = detail.nextAction?.stepId === step.id ? detail.nextAction : null;
  const flags = flagsHolding(detail, step.id);
  const requirements = detail.rulePack?.requirements.filter((r) => r.steps.some((s) => s.id === step.id)) ?? [];
  const waitsOn = step.blockedBy
    .map((id) => detail.workflow.steps.find((s) => s.id === id))
    .filter((s): s is Step => s !== undefined);
  // The engine's reason restates the flags and prerequisites, which the panel shows on their own.
  const reason = flags.length || waitsOn.length ? null : step.reason;

  return (
    <>
      <div className="border-b border-line px-5 pt-5 pb-4 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-3">{step.id}</span>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {step.milestone && <StatusBadge tone="product">Phase gate</StatusBadge>}
          </p>
          <Link
            href={closeHref}
            replace
            scroll={false}
            aria-label="Close the step"
            className="-mr-2 grid size-9 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </Link>
        </div>
        <h2 className="mt-2 text-lg leading-snug font-bold sm:text-xl">{step.name}</h2>
        <p className="mt-1 text-sm text-ink-3">
          Phase {step.phase} · {phaseTitle(step.phase)} · Who acts: {OWNERS[step.owner]}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-7">
        {flags.map((flag) => (
          <section key={flag.id} className="rounded-lg bg-danger-50 p-4 ring-1 ring-danger/25 ring-inset">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-sans text-sm font-bold text-danger">
                {flag.rule} · {flag.name}
              </h3>
              <StatusBadge tone={FLAG_SEVERITIES[flag.severity].tone}>{FLAG_SEVERITIES[flag.severity].label}</StatusBadge>
            </div>
            <p className="mt-1.5 text-sm">{flag.message}</p>
            <p className="mt-1.5 text-xs text-ink-3">
              Raised {formatDateTime(flag.raisedAt)} · holds {flag.blocks.join(", ")}
            </p>
            {canWaiveFlags(detail.yourRole) && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-brand-600">Waive it</summary>
                <ActionForm
                  action={waiveFlag}
                  hidden={{ caseId: detail.id, flagId: flag.id }}
                  submits={[{ label: "Waive the flag", variant: "danger" }]}
                  className="mt-3"
                >
                  <NoteField label="Why the situation is accepted" name="reason" required />
                </ActionForm>
              </details>
            )}
          </section>
        ))}

        {next && (
          <section className="rounded-lg bg-info-50 p-4 ring-1 ring-info/20 ring-inset">
            <h3 className="font-sans text-xs font-bold tracking-wider text-info uppercase">Next action: {NEXT_ACTIONS[next.kind]}</h3>
            <p className="mt-1 font-semibold">{readable(next.detail)}</p>
            <p className="mt-1 text-sm text-ink-3">Who acts: {OWNERS[next.owner]}</p>
          </section>
        )}

        {(reason || waitsOn.length > 0) && (
          <section className="flex flex-col gap-2 text-sm">
            {reason && <p className="text-ink-2">{reason}</p>}
            {waitsOn.length > 0 && (
              <div>
                <Eyebrow>Waits on</Eyebrow>
                <ul className="mt-2 overflow-hidden rounded-lg border border-line">
                  {waitsOn.map((s) => (
                    <li key={s.id} className="border-t border-line first:border-t-0">
                      <Link
                        href={withStep(detail.id, view, s.id)}
                        scroll={false}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2"
                      >
                        <StepIcon step={s} className="size-4" />
                        <span className="font-mono text-xs text-ink-3">{s.id}</span>
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="shrink-0 text-xs text-ink-3">{shownStatus(s).label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {step.warnings.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg bg-warn-50 p-3 text-sm text-warn">
            {step.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {step.evidence.length > 0 && (
          <section>
            <Eyebrow>Evidence this step asks for</Eyebrow>
            <ul className="mt-2 overflow-hidden rounded-lg border border-line">
              {step.evidence.map((need) => (
                <EvidenceNeed key={need.type} need={need} detail={detail} live={step.status !== "not_applicable"} />
              ))}
            </ul>
          </section>
        )}

        {requirements.length > 0 && (
          <section>
            <Eyebrow>{requirements.length === 1 ? "Requirement it covers" : "Requirements it covers"}</Eyebrow>
            <ul className="mt-2 overflow-hidden rounded-lg border border-line">
              {requirements.map((r) => (
                <li key={r.code} className="border-t border-line first:border-t-0">
                  <Link
                    href={`${caseHref(detail.id, { tab: "requirements", req: r.code })}#req-${r.code}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="mr-2 font-mono text-xs text-ink-3">{r.code}</span>
                      {r.name}
                    </span>
                    <StatusBadge tone={REQUIREMENT_STATUSES[r.status].tone}>{REQUIREMENT_STATUSES[r.status].label}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <StatusChanges step={step} caseId={detail.id} role={detail.yourRole} />
      </div>

      <Finish detail={detail} step={step} />
    </>
  );
}

/** A piece of evidence the step asks for: its latest submission, and submitting or reviewing it. */
function EvidenceNeed({ need, detail, live }: { need: Step["evidence"][number]; detail: Detail; live: boolean }) {
  const status = EVIDENCE_STATUSES[need.status];
  const submit = live && evidenceActions(need.status, detail.yourRole).submit;
  const latest = detail.evidence.find((e) => e.latest && e.type === need.type);
  return (
    <li className="border-t border-line p-3 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{evidenceName(need.type)}</p>
          {need.requiredIf && <p className="text-xs text-ink-3">Needed if {need.requiredIf}</p>}
          {latest && (
            <p className="text-xs text-ink-3">
              <Submission item={latest} />
            </p>
          )}
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {latest && <ReviewNote item={latest} />}
      {latest && <EvidenceReview item={latest} caseId={detail.id} role={detail.yourRole} />}
      {submit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">
            {need.status === "not_provided" ? "Submit it" : "Submit it again"}
          </summary>
          <ActionForm
            action={submitEvidence}
            hidden={{ caseId: detail.id, type: need.type }}
            submits={[{ label: "Submit for review" }]}
            className="mt-3"
          >
            <Field label="Issue date on the document" name="issuedOn" type="date" className="max-w-xs" />
            <p className="text-xs text-ink-3">
              Attaching the file comes with document uploads. Until then this records that it was provided, for an Entrust reviewer
              to check.
            </p>
          </ActionForm>
        </details>
      )}
    </li>
  );
}

/** Setting a working status, ruling the step out, or reopening it: the less common changes. */
function StatusChanges({ step, caseId, role }: { step: Step; caseId: string; role: Role }) {
  const actions = stepActions(step, role);
  const hidden = { caseId, stepId: step.id };
  if (!(actions.update.length > 0 || actions.markNotApplicable || actions.reopen || actions.unlock)) return null;
  return (
    <details className="rounded-lg border border-line">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-brand-600">Change the status</summary>
      <div className="flex flex-col gap-4 border-t border-line p-3">
        {actions.update.length > 0 && (
          <ActionForm action={transitionStep} hidden={hidden} submits={[{ label: "Save", variant: "secondary" }]}>
            <SelectField
              label="Status"
              name="to"
              options={actions.update.map((s) => ({ value: s, label: TASK_STATUSES[s].label }))}
              className="max-w-xs"
            />
          </ActionForm>
        )}
        {actions.markNotApplicable && (
          <ActionForm
            action={transitionStep}
            hidden={{ ...hidden, to: "not_applicable" }}
            submits={[{ label: "Mark not applicable", variant: "secondary" }]}
          >
            <NoteField label="Why it doesn't apply" name="reason" required />
          </ActionForm>
        )}
        {(actions.reopen || actions.unlock) && (
          <ActionForm
            action={transitionStep}
            hidden={{ ...hidden, to: "in_progress" }}
            submits={[{ label: actions.unlock ? "Unlock the gate" : "Reopen", variant: "danger" }]}
          >
            <NoteField label={actions.unlock ? "Why the gate is unlocked" : "Why it is reopened"} name="reason" required />
          </ActionForm>
        )}
      </div>
    </details>
  );
}

/** Completing the step, or signing off its phase, at the foot of the panel. */
function Finish({ detail, step }: { detail: Detail; step: Step }) {
  const actions = stepActions(step, detail.yourRole);
  const finish = step.milestone ? actions.signOff : actions.complete;
  if (!finish || step.status === "completed") return null;
  // Completing these steps starts a deadline clock, so the date it happened is asked for.
  const clock = detail.deadlines.find((d) => d.stepId === step.id);
  const outstanding = detail.workflow.phases.find((g) => g.phase === step.phase)?.outstanding ?? [];
  const blocker =
    step.missingEvidence.length > 0
      ? `It can be completed once this evidence is approved: ${step.missingEvidence.map(evidenceName).join(", ")}.`
      : step.milestone && outstanding.length > 0
        ? `The phase can be signed off once ${outstanding.length === 1 ? "this step is" : `these ${outstanding.length} steps are`} finished: ${outstanding.map((o) => o.stepId).join(", ")}.`
        : "It can't be completed yet.";
  return (
    <div className="border-t border-line bg-surface-2 px-5 py-4 sm:px-7">
      {step.canComplete ? (
        <ActionForm
          action={transitionStep}
          hidden={{ caseId: detail.id, stepId: step.id, to: "completed" }}
          submits={[{ label: step.milestone ? `Sign off phase ${step.phase}` : "Mark complete" }]}
        >
          {clock && (
            <Field
              label="Date it happened"
              name="occurredAt"
              type="date"
              hint={`It starts the ${clock.label.toLowerCase()} clock.`}
              className="max-w-xs"
            />
          )}
        </ActionForm>
      ) : (
        <p className="text-sm text-ink-3">{blocker}</p>
      )}
    </div>
  );
}
