"use client";

import { useActionState, useId, useState, type ChangeEvent } from "react";
import { Button, Field } from "@entrust/ui";
import { ACCEPT_ATTRIBUTE, openFile, uploadFile } from "@/lib/upload";
import { acceptAction, withdrawAction, type ActionState } from "./actions";

type Kind = "assessment_notice" | "platform_data";
const initial: ActionState = { error: null };
const today = () => new Date().toISOString().slice(0, 10);

function Message({ state, done }: { state: ActionState; done: string }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>;
  if (state.done) return <p role="status" className="text-sm font-medium text-ok">{done}</p>;
  return null;
}

/** A file field that uploads to the SME's own storage as soon as a file is picked, and keeps its id for the form. */
function ScanUpload({ organizationId, label, hint, required }: { organizationId: string; label: string; hint: string; required?: boolean }) {
  const id = useId();
  const [file, setFile] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setBusy(true);
    setError(null);
    const result = await uploadFile(organizationId, picked);
    setBusy(false);
    if (result.ok) setFile({ id: result.file.id, name: result.file.name });
    else {
      setFile(null);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required ? "" : " (optional)"}
      </label>
      <input id={id} type="file" accept={ACCEPT_ATTRIBUTE} onChange={onChange} disabled={busy} className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-sm file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
      <input type="hidden" name="fileId" value={file?.id ?? ""} />
      <p className="text-xs text-ink-3">{busy ? "Uploading…" : file ? `Uploaded: ${file.name}` : hint}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Staff record an acceptance given on paper (with the signed scan) or in TRADE (with TRADE's reference). */
export function RecordAcceptance({ organizationId, kind, currentVersion }: { organizationId: string; kind: Kind; currentVersion: string }) {
  const [state, action, pending] = useActionState(acceptAction, initial);
  const [method, setMethod] = useState<"paper" | "trade">("paper");
  const name = useId();

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value={kind} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">How it was given</legend>
        {(
          [
            ["paper", "Signed on paper", "Upload the scan of the signed notice."],
            ["trade", "Accepted in TRADE", "Give TRADE's reference, such as the diagnostic it was accepted in."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-2 text-sm text-ink-2">
            <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="mt-1" />
            <span>
              <span className="font-semibold text-ink">{label}.</span> {hint}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name of the person who accepted" name="signatoryName" required autoComplete="off" id={`${name}-n`} />
        <Field label="Their role in the business (optional)" name="signatoryRole" autoComplete="off" id={`${name}-r`} />
        <Field label="Date accepted" name="givenOn" type="date" defaultValue={today()} max={today()} required id={`${name}-d`} />
        {method === "paper" ? (
          <Field label="Notice version on the paper" name="noticeVersion" defaultValue={currentVersion} hint="The version printed at the foot of the notice." id={`${name}-v`} />
        ) : (
          <>
            <Field label="TRADE reference" name="sourceRef" required autoComplete="off" id={`${name}-s`} />
            <Field label="TRADE wording version (optional)" name="noticeVersion" autoComplete="off" id={`${name}-v`} />
          </>
        )}
      </div>
      {method === "paper" && <ScanUpload organizationId={organizationId} label="Scan of the signed notice" hint="PDF, JPEG or PNG, up to 20 MB." required />}
      <Message state={state} done="Recorded." />
      <Button type="submit" loading={pending}>
        Record acceptance
      </Button>
    </form>
  );
}

/** Staff record a withdrawal on the SME's word, with their letter or email if there is one. */
export function RecordWithdrawal({ organizationId, kind }: { organizationId: string; kind: Kind }) {
  const [state, action, pending] = useActionState(withdrawAction, initial);
  const name = useId();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name of the person who asked to withdraw" name="signatoryName" required autoComplete="off" id={`${name}-n`} />
        <Field label="Their role in the business (optional)" name="signatoryRole" autoComplete="off" id={`${name}-r`} />
        <Field label="Date they asked" name="givenOn" type="date" defaultValue={today()} max={today()} required id={`${name}-d`} />
        <Field label="How they asked, or why (optional)" name="reason" autoComplete="off" id={`${name}-w`} />
      </div>
      <ScanUpload organizationId={organizationId} label="Their letter or email" hint="Attach it if there is one. A phone call is enough." />
      <Message state={state} done="Withdrawn." />
      <Button type="submit" variant="danger" loading={pending}>
        Record withdrawal
      </Button>
    </form>
  );
}

/** Someone from the SME accepts the current wording, or withdraws, for themselves. */
export function SmeDecision({ organizationId, kind, inForce, businessName }: { organizationId: string; kind: Kind; inForce: boolean; businessName: string }) {
  const [acceptState, accept, accepting] = useActionState(acceptAction, initial);
  const [withdrawState, withdraw, withdrawing] = useActionState(withdrawAction, initial);
  const [agreed, setAgreed] = useState(false);
  const check = useId();

  if (inForce) {
    return (
      <form action={withdraw} className="space-y-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="kind" value={kind} />
        <p className="text-sm text-ink-2">You can withdraw at any time. Reports already issued stay as they are.</p>
        <Message state={withdrawState} done="Withdrawn." />
        <Button type="submit" variant="secondary" loading={withdrawing}>
          Withdraw
        </Button>
      </form>
    );
  }
  return (
    <form action={accept} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="method" value="in_platform" />
      <label htmlFor={check} className="flex items-start gap-2 text-sm text-ink-2">
        <input id={check} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>I have read this and I accept it for {businessName}.</span>
      </label>
      <Message state={acceptState} done="Thank you. Your acceptance is recorded." />
      <Button type="submit" disabled={!agreed} loading={accepting}>
        Accept
      </Button>
    </form>
  );
}

export function OpenFile({ fileId, children }: { fileId: string; children: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={async () => setError(await openFile(fileId))} className="font-semibold text-product-600 underline-offset-4 hover:underline">
        {children}
      </button>
      {error && <span className="ml-2 text-danger">{error}</span>}
    </>
  );
}
