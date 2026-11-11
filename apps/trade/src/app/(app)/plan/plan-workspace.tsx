"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, StatusBadge, type StatusTone } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type { CertificateView, EvidenceRecordView, LearningPlanRecord, ModuleExemptionView, ModuleProgressView } from "@/lib/types";

const MODULES = Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);
/** Every learner completes these, so they're never removed, softened or exempted. */
const MANDATORY = new Set(["M11", "M12"]);

const ASSIGNMENT_LABEL: Record<string, string> = {
  required: "Required",
  priority_required: "Required first",
  assessment_needed: "More answers needed",
  optional: "Test-out offered",
};
const PROGRESS: Record<string, [string, StatusTone]> = {
  not_started: ["Not started", "idle"],
  in_progress: ["In progress", "info"],
  submitted: ["Waiting for its score", "warn"],
  needs_revision: ["Needs revision", "danger"],
  passed: ["Passed", "ok"],
  exempted: ["Exempted", "ok"],
};
const EXEMPTION: Record<string, [string, StatusTone]> = {
  pending: ["Waiting for a decision", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Not approved", "danger"],
};

interface Props {
  enrollment: { id: string; status: string };
  plan: LearningPlanRecord | null;
  progress: ModuleProgressView[];
  exemptions: ModuleExemptionView[];
  certificate: CertificateView | null;
  /** The business's own evidence that can back an exemption request. */
  evidence: EvidenceRecordView[];
  role: string | null;
  /** The signed-in person works for the business (not Entrust staff looking at it). */
  isMember: boolean;
}

export function PlanWorkspace({ enrollment, plan, progress, exemptions, certificate, evidence, role, isMember }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = role === "admin";
  const canManage = role === "admin" || role === "facilitator";

  async function run(call: () => ReturnType<typeof tradeFetch>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await call();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setNotice(done);
    router.refresh();
    return true;
  }

  const progressOf = new Map(progress.map((p) => [p.moduleId, p]));
  const assigned = plan?.modules ?? [];
  const missing = MODULES.filter((m) => !assigned.some((a) => a.moduleId === m));

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${error ? "bg-danger-50 text-danger" : "bg-ok-50 text-ok"}`}>
          {error ?? notice}
        </p>
      )}

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">Modules in the plan</h2>
          {plan && <StatusBadge tone={plan.status === "review_required" ? "warn" : "info"}>{`Plan ${plan.status.replaceAll("_", " ")}, Pathway ${plan.pathway}`}</StatusBadge>}
        </div>
        {!plan ? (
          <p className="text-sm text-ink-2">There is no plan yet. It&apos;s made when the placement assessment is scored.</p>
        ) : (
          <>
            {plan.status === "review_required" && canManage && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => tradeFetch("POST", `/plans/${plan.id}/approve`, {}), "The plan is approved.")}>
                Approve the plan
              </Button>
            )}
            <ul className="divide-y divide-line">
              {assigned.map((a) => (
                <ModuleRow
                  key={a.moduleId}
                  moduleId={a.moduleId}
                  assignment={a.status}
                  progress={progressOf.get(a.moduleId)}
                  busy={busy}
                  canRemove={canManage && !MANDATORY.has(a.moduleId) && plan.status !== "completed"}
                  canOverride={isAdmin && !["passed", "exempted"].includes(progressOf.get(a.moduleId)?.status ?? "")}
                  onRemove={(reason) => run(() => tradeFetch("POST", `/plans/${plan.id}/override`, { reason, removals: [a.moduleId] }), `${a.moduleId} is out of the plan.`)}
                  onOverride={(reason) =>
                    run(() => tradeFetch("POST", "/admin/override-module-completion", { enrollmentId: enrollment.id, moduleId: a.moduleId, reason }), `${a.moduleId} is completed by override.`)
                  }
                />
              ))}
            </ul>
            {canManage && plan.status !== "completed" && missing.length > 0 && (
              <AddModule missing={missing} busy={busy} onAdd={(moduleId, status, reason) => run(() => tradeFetch("POST", `/plans/${plan.id}/override`, { reason, additions: [{ moduleId, status }] }), `${moduleId} is in the plan.`)} />
            )}
          </>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-ink">Exemptions</h2>
        <p className="text-sm text-ink-2">
          A module can be exempted when the business shows it has already done what the module teaches. M11 and M12 can&apos;t be exempted.
        </p>
        {exemptions.length === 0 ? (
          <p className="text-sm text-ink-3">None asked for.</p>
        ) : (
          <ul className="divide-y divide-line">
            {exemptions.map((x) => (
              <ExemptionRow key={x.id} exemption={x} canDecide={canManage} busy={busy} onDecide={(status, comment) => run(() => tradeFetch("POST", `/exemptions/${x.id}/review`, { status, ...(comment ? { comment } : {}) }), status === "approved" ? `The ${x.moduleId} exemption is approved.` : `The ${x.moduleId} exemption is not approved.`)} />
            ))}
          </ul>
        )}
        {isMember && (
          <AskExemption
            modules={assigned.map((a) => a.moduleId).filter((m) => !MANDATORY.has(m) && !["passed", "exempted"].includes(progressOf.get(m)?.status ?? ""))}
            evidence={evidence}
            busy={busy}
            onAsk={(moduleId, evidenceRecordId, reason) => run(() => tradeFetch("POST", "/exemptions", { enrollmentId: enrollment.id, moduleId, evidenceRecordId, reason }), `Your ${moduleId} exemption request is with Entrust.`)}
          />
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-ink">Certificate</h2>
        {!certificate ? (
          <p className="text-sm text-ink-2">Issued when every module in the plan is passed or exempted.</p>
        ) : (
          <CertificatePanel certificate={certificate} canRevoke={isAdmin} busy={busy} onRevoke={(reason, publicReason) => run(() => tradeFetch("POST", `/certificates/${certificate.id}/revoke`, { reason, ...(publicReason ? { publicReason } : {}) }), "The certificate is revoked.")} />
        )}
      </Card>
    </div>
  );
}

/** Asks for a short reason before acting, since every one of these changes is audited with its reason. */
function ReasonedAction({ label, prompt, busy, onConfirm, variant = "ghost" }: { label: string; prompt: string; busy: boolean; onConfirm: (reason: string) => Promise<boolean>; variant?: "ghost" | "danger" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button type="button" size="sm" variant={variant} disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onConfirm(reason.trim())) {
          setOpen(false);
          setReason("");
        }
      }}
    >
      <Field label={prompt} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={2000} className="min-w-64 flex-1" />
      <Button type="submit" size="sm" variant={variant === "ghost" ? "secondary" : variant} loading={busy} disabled={reason.trim().length < 3}>
        {label}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

function ModuleRow(props: {
  moduleId: string;
  assignment: string;
  progress: ModuleProgressView | undefined;
  busy: boolean;
  canRemove: boolean;
  canOverride: boolean;
  onRemove: (reason: string) => Promise<boolean>;
  onOverride: (reason: string) => Promise<boolean>;
}) {
  const [label, tone] = PROGRESS[props.progress?.status ?? "not_started"] ?? ["Not started", "idle"];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-ink">{props.moduleId}</span>
        <span className="text-xs text-ink-3">{ASSIGNMENT_LABEL[props.assignment] ?? props.assignment}</span>
        <StatusBadge tone={tone}>{label}</StatusBadge>
        {props.progress?.contentVersion && <span className="text-[11px] text-ink-3">content {props.progress.contentVersion}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.canOverride && <ReasonedAction label="Complete by override" prompt={`Why is ${props.moduleId} complete without passing work?`} busy={props.busy} onConfirm={props.onOverride} />}
        {props.canRemove && <ReasonedAction label="Remove from plan" prompt={`Why does ${props.moduleId} come out of the plan?`} busy={props.busy} onConfirm={props.onRemove} variant="danger" />}
      </div>
    </li>
  );
}

function AddModule({ missing, busy, onAdd }: { missing: string[]; busy: boolean; onAdd: (moduleId: string, status: string, reason: string) => Promise<boolean> }) {
  const [moduleId, setModuleId] = useState(missing[0] ?? "");
  const [status, setStatus] = useState("required");
  const [reason, setReason] = useState("");
  const select = "mt-1 block h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink";
  return (
    <form
      className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(moduleId, status, reason.trim())) setReason("");
      }}
    >
      <label className="text-sm font-semibold text-ink">
        Add a module
        <select className={select} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          {missing.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-ink">
        As
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="required">Required</option>
          <option value="optional">Test-out offered</option>
        </select>
      </label>
      <Field label="Why" value={reason} onChange={(e) => setReason(e.target.value)} required className="min-w-64 flex-1" />
      <Button type="submit" variant="secondary" loading={busy} disabled={!moduleId || !reason.trim()}>
        Add to plan
      </Button>
    </form>
  );
}

function ExemptionRow({ exemption, canDecide, busy, onDecide }: { exemption: ModuleExemptionView; canDecide: boolean; busy: boolean; onDecide: (status: "approved" | "rejected", comment?: string) => Promise<boolean> }) {
  const [label, tone] = EXEMPTION[exemption.status] ?? [exemption.status, "idle"];
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-ink">{exemption.moduleId}</span>
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <span className="text-xs text-ink-3">Evidence: {exemption.evidenceTitle}</span>
      </div>
      <p className="text-sm text-ink-2">{exemption.reason}</p>
      {exemption.reviewComment && <p className="text-xs text-ink-3">Entrust: {exemption.reviewComment}</p>}
      {canDecide && (
        <div className="flex flex-wrap gap-2">
          {exemption.status === "pending" && (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void onDecide("approved")}>
              Approve
            </Button>
          )}
          {exemption.status !== "rejected" && (
            <ReasonedAction
              label={exemption.status === "approved" ? "Take back" : "Don't approve"}
              prompt="Tell the business why"
              busy={busy}
              onConfirm={(comment) => onDecide("rejected", comment)}
              variant="danger"
            />
          )}
        </div>
      )}
    </li>
  );
}

function AskExemption({ modules, evidence, busy, onAsk }: { modules: string[]; evidence: EvidenceRecordView[]; busy: boolean; onAsk: (moduleId: string, evidenceRecordId: string, reason: string) => Promise<boolean> }) {
  const [moduleId, setModuleId] = useState(modules[0] ?? "");
  const [evidenceId, setEvidenceId] = useState(evidence[0]?.id ?? "");
  const [reason, setReason] = useState("");
  if (modules.length === 0) return null;
  const select = "mt-1 block h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink";
  return (
    <form
      className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAsk(moduleId, evidenceId, reason.trim())) setReason("");
      }}
    >
      <h3 className="font-display text-base font-bold text-ink sm:col-span-2">Ask for an exemption</h3>
      <label className="text-sm font-semibold text-ink">
        Module
        <select className={select} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-ink">
        Evidence it rests on
        <select className={select} value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)} required>
          {evidence.length === 0 && <option value="">Add evidence first</option>}
          {evidence.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <Field label="Why the module isn't needed" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={2000} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy} disabled={!moduleId || !evidenceId || !reason.trim()}>
          Send the request
        </Button>
      </div>
    </form>
  );
}

function CertificatePanel({ certificate, canRevoke, busy, onRevoke }: { certificate: CertificateView; canRevoke: boolean; busy: boolean; onRevoke: (reason: string, publicReason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [publicReason, setPublicReason] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-ink">{certificate.code}</span>
        <StatusBadge tone={certificate.isValid ? "ok" : "danger"}>{certificate.isValid ? "Valid" : "Revoked"}</StatusBadge>
        <a href={certificate.verificationUrl} className="text-sm font-semibold text-brand-600 hover:underline">
          Public check
        </a>
      </div>
      {certificate.isRevoked && certificate.revocationReason && <p className="text-sm text-ink-2">Why: {certificate.revocationReason}</p>}
      {canRevoke && certificate.isValid && !open && (
        <Button type="button" size="sm" variant="danger" onClick={() => setOpen(true)}>
          Revoke the certificate
        </Button>
      )}
      {canRevoke && certificate.isValid && open && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onRevoke(reason.trim(), publicReason.trim())) setOpen(false);
          }}
        >
          <Field label="Why (kept on the record, for staff)" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={2000} />
          <Field label="What the public check says (optional)" hint="Without this it says only that Entrust Africa withdrew the certificate." value={publicReason} onChange={(e) => setPublicReason(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy} disabled={reason.trim().length < 3}>
              Revoke
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
