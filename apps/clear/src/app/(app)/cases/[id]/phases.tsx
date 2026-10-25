import { Field, StatusBadge, cn } from "@entrust/ui";
import type { CaseDetailView } from "@entrust/api/client";
import type { Role } from "@entrust/gate-engine";
import { evidenceActions, evidenceName, stepActions } from "@/lib/catalogue";
import { EVIDENCE_STATUSES, GATE_STATUSES, OWNERS, PHASES, STEP_STATUSES, TASK_STATUSES } from "@/lib/statuses";
import { submitEvidence, transitionStep } from "../actions";
import { ActionForm } from "../action-form";
import { NoteField, SelectField } from "../inputs";

type Step = CaseDetailView["workflow"]["steps"][number];
type Gate = CaseDetailView["workflow"]["phases"][number];

/** The case's seven phases, each with its gate and the steps that apply. */
export function Phases({ detail }: { detail: CaseDetailView }) {
  // Completing these steps starts a deadline clock, so the date it happened is asked for.
  const clockSteps = new Map(detail.deadlines.map((d) => [d.stepId, d.label]));
  return (
    <ol className="flex flex-col gap-4">
      {PHASES.map((phase) => {
        const gate = detail.workflow.phases.find((g) => g.phase === phase.n);
        const steps = detail.workflow.steps.filter((s) => s.phase === phase.n);
        return (
          <li key={phase.n}>
            <Phase
              n={phase.n}
              title={phase.title}
              gate={gate}
              steps={steps}
              current={phase.n === detail.currentPhase}
              caseId={detail.id}
              role={detail.yourRole}
              clockSteps={clockSteps}
            />
          </li>
        );
      })}
    </ol>
  );
}

function Phase({
  n,
  title,
  gate,
  steps,
  current,
  caseId,
  role,
  clockSteps,
}: {
  n: number;
  title: string;
  gate: Gate | undefined;
  steps: Step[];
  current: boolean;
  caseId: string;
  role: Role;
  clockSteps: Map<string, string>;
}) {
  const applying = steps.filter((s) => s.applicability !== "not_applicable");
  const ruledOut = steps.filter((s) => s.applicability === "not_applicable");
  const done = applying.filter((s) => s.status === "completed" || s.status === "not_applicable").length;
  const gateStatus = gate ? GATE_STATUSES[gate.status] : null;
  return (
    <details open={current} className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
              gate?.status === "locked"
                ? "bg-ok text-white"
                : current
                  ? "bg-product-600 text-white"
                  : "bg-surface text-ink-3 ring-1 ring-line-strong ring-inset",
            )}
          >
            {n}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{title}</span>
            <span className="block text-sm text-ink-3">
              {done} of {applying.length} steps done
            </span>
          </span>
        </span>
        {gateStatus && <StatusBadge tone={gateStatus.tone}>{gateStatus.label}</StatusBadge>}
      </summary>
      <div className="border-t border-line px-4 sm:px-6">
        {gate && gate.status !== "locked" && gate.outstanding.length > 0 && (
          <p className="pt-4 text-sm text-ink-2">
            <span className="font-semibold">
              {gate.outstanding.length === 1 ? "1 step" : `${gate.outstanding.length} steps`} to finish before {gate.milestoneStep} can be
              signed off
            </span>
            {gate.outstanding.length <= 5 && <>: {gate.outstanding.map((o) => o.stepId).join(", ")}</>}
          </p>
        )}
        <ol>
          {applying.map((step) => (
            <StepItem key={step.id} step={step} caseId={caseId} role={role} clock={clockSteps.get(step.id)} />
          ))}
        </ol>
        {ruledOut.length > 0 && (
          <details className="border-t border-line py-3 text-sm">
            <summary className="cursor-pointer text-ink-2">
              {ruledOut.length === 1 ? "1 step doesn't apply" : `${ruledOut.length} steps don't apply`} to this case
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-ink-3">
              {ruledOut.map((s) => (
                <li key={s.id}>
                  <span className="font-mono text-xs">{s.id}</span> {s.name}
                  {s.reason && <span className="block text-xs">{s.reason}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  );
}

/**
 * The step's status as shown. The engine reports a step waiting on its prerequisites as blocked;
 * that is shown as waiting, and blocked is kept for a flag holding it or a person marking it so.
 */
function shownStatus(step: Step) {
  if (step.status === "blocked" && step.derived) {
    return step.heldBy.length ? { label: "Held by a flag", tone: "danger" as const } : { label: "Waiting", tone: "idle" as const };
  }
  return STEP_STATUSES[step.status];
}

function StepItem({ step, caseId, role, clock }: { step: Step; caseId: string; role: Role; clock: string | undefined }) {
  const status = shownStatus(step);
  const actions = stepActions(step, role);
  const hidden = { caseId, stepId: step.id };
  const finish = step.milestone ? actions.signOff : actions.complete;
  const changes = actions.update.length > 0 || actions.markNotApplicable || actions.reopen || actions.unlock;

  return (
    <li id={step.id} className="scroll-mt-4 border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-ink-3">
            {step.id}
            {step.milestone && " · phase gate"}
          </p>
          <h3 className="font-sans text-sm font-semibold">{step.name}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {OWNERS[step.owner]}
            {step.reason && <> · {step.reason}</>}
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      {step.evidence.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {step.evidence.map((e) => (
            <EvidenceNeed key={e.type} need={e} caseId={caseId} role={role} live={step.status !== "not_applicable"} />
          ))}
        </ul>
      )}

      {step.warnings.length > 0 && (
        <ul className="mt-2 text-sm text-warn">
          {step.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {finish &&
        (step.canComplete ? (
          <ActionForm
            action={transitionStep}
            hidden={{ ...hidden, to: "completed" }}
            submits={[{ label: step.milestone ? `Sign off phase ${step.phase}` : "Mark complete" }]}
            className="mt-3"
          >
            {clock && (
              <Field
                label="Date it happened"
                name="occurredAt"
                type="date"
                hint={`It starts the ${clock.toLowerCase()} clock.`}
                className="max-w-xs"
              />
            )}
          </ActionForm>
        ) : (
          step.missingEvidence.length > 0 &&
          step.status !== "completed" && (
            <p className="mt-3 text-sm text-ink-3">
              It can be completed once this evidence is approved: {step.missingEvidence.map(evidenceName).join(", ")}.
            </p>
          )
        ))}

      {changes && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">Change the status</summary>
          <div className="mt-3 flex flex-col gap-4 rounded-md bg-surface-2 p-3">
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
      )}
    </li>
  );
}

/** A piece of evidence a step asks for, and submitting it when the role may and the step applies. */
function EvidenceNeed({ need, caseId, role, live }: { need: Step["evidence"][number]; caseId: string; role: Role; live: boolean }) {
  const status = EVIDENCE_STATUSES[need.status];
  const submit = live && evidenceActions(need.status, role).submit;
  return (
    <li className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm">
          {evidenceName(need.type)}
          {need.requiredIf && <span className="block text-xs text-ink-3">Needed if {need.requiredIf}</span>}
        </p>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {submit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">
            {need.status === "not_provided" ? "Submit it" : "Submit it again"}
          </summary>
          <ActionForm
            action={submitEvidence}
            hidden={{ caseId, type: need.type }}
            submits={[{ label: "Submit for review" }]}
            className="mt-3"
          >
            <Field label="Issue date on the document" name="issuedOn" type="date" className="max-w-xs" />
            <p className="text-xs text-ink-3">
              Attaching the file comes with document uploads. Until then this records that it was provided, for an Entrust
              reviewer to check.
            </p>
          </ActionForm>
        </details>
      )}
    </li>
  );
}
