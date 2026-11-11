"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, StatusBadge, type StatusTone } from "@entrust/ui";
import { FileUpload } from "@/components/files/file-upload";
import { tradeFetch } from "@/lib/trade-client";
import type { EvidenceRecordView } from "@/lib/types";
import { openFile, type UploadedFile } from "@/lib/upload";

const STATUS: Record<string, [string, StatusTone]> = {
  not_submitted: ["Asked for", "warn"],
  submitted: ["Waiting for review", "info"],
  under_review: ["Being reviewed", "info"],
  accepted: ["Accepted", "ok"],
  rejected: ["Not accepted", "danger"],
  resubmission_required: ["Send again", "warn"],
};
const CONFIDENCE: Record<string, string> = { self_reported: "Self-reported", documented: "Documented", reviewed: "Reviewed by staff", verified: "Verified" };

export function EvidenceWorkspace({ organizationId, initial, role, isMember }: { organizationId: string; initial: EvidenceRecordView[]; role: string | null; isMember: boolean }) {
  const router = useRouter();
  const [records, setRecords] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const isStaff = role !== null;

  const replace = (next: EvidenceRecordView) => setRecords((now) => (now.some((r) => r.id === next.id) ? now.map((r) => (r.id === next.id ? next : r)) : [next, ...now]));
  async function run(call: () => Promise<{ ok: boolean; data: EvidenceRecordView | null; error: string | null }>) {
    setError(null);
    const res = await call();
    if (!res.ok || !res.data) {
      setError(res.error);
      return false;
    }
    replace(res.data);
    router.refresh();
    return true;
  }

  const asked = records.filter((r) => r.status === "not_submitted" || r.status === "resubmission_required");
  const rest = records.filter((r) => !asked.includes(r));

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {asked.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-ink">{isMember ? "Asked of you" : "Waiting for the business"}</h2>
          <ul className="divide-y divide-line">
            {asked.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <RecordHead record={r} />
                {r.requestPrompt && <p className="text-sm text-ink-2">{r.requestPrompt}</p>}
                {r.reviewComment && <p className="text-sm text-ink-2">Entrust: {r.reviewComment}</p>}
                {isMember && <Answer organizationId={organizationId} record={r} onAnswer={(body) => run(() => tradeFetch<EvidenceRecordView>("POST", `/evidence/${r.id}/answer`, body))} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isMember && <AddEvidence organizationId={organizationId} onAdd={(body) => run(() => tradeFetch<EvidenceRecordView>("POST", "/evidence", { organizationId, ...body }))} />}
      {isStaff && role !== "reviewer" && <RequestEvidence onRequest={(body) => run(() => tradeFetch<EvidenceRecordView>("POST", "/evidence/request", { organizationId, ...body }))} />}

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-ink">Sent</h2>
        {rest.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rest.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <RecordHead record={r} />
                {r.responseNote && <p className="text-sm text-ink-2">{r.responseNote}</p>}
                {r.reviewComment && <p className="text-xs text-ink-3">Review: {r.reviewComment}</p>}
                {isStaff && (r.status === "submitted" || r.status === "under_review") && (
                  <Review onReview={(body) => run(() => tradeFetch<EvidenceRecordView>("POST", `/evidence/${r.id}/review`, body))} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RecordHead({ record }: { record: EvidenceRecordView }) {
  const [label, tone] = STATUS[record.status] ?? [record.status, "idle"];
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-ink">{record.title}</span>
      <StatusBadge tone={tone}>{label}</StatusBadge>
      <span className="text-xs text-ink-3">{CONFIDENCE[record.confidence] ?? record.confidence}</span>
      {record.targetId && <span className="font-mono text-xs text-ink-3">{record.targetId}</span>}
      {record.fileId && (
        <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={async () => setProblem(await openFile(record.fileId!))}>
          Open the document
        </button>
      )}
      {problem && (
        <span role="alert" className="text-xs text-danger">
          {problem}
        </span>
      )}
    </div>
  );
}

function Answer({ organizationId, record, onAnswer }: { organizationId: string; record: EvidenceRecordView; onAnswer: (body: { fileId?: string; note?: string }) => Promise<boolean> }) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const done = await onAnswer({ ...(file ? { fileId: file.id } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
        setBusy(false);
        if (done) {
          setFile(null);
          setNote("");
        }
      }}
    >
      {file ? <p className="text-sm text-ink-2">Attached: {file.name}</p> : <FileUpload organizationId={organizationId} label="Attach a document" onUploaded={(f) => setFile(f)} />}
      <Field label={`A note about "${record.title}" (optional)`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
      <Button type="submit" size="sm" loading={busy} disabled={!file && !note.trim()}>
        Send to Entrust
      </Button>
    </form>
  );
}

function AddEvidence({ organizationId, onAdd }: { organizationId: string; onAdd: (body: { title: string; fileId?: string; targetType: string; targetId?: string }) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-display text-lg font-bold text-ink">Add evidence</h2>
      <p className="text-sm text-ink-2">For example a registration certificate, a bank statement, or a record of a shipment. You can use it to ask for a module exemption.</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const done = await onAdd({ title: title.trim(), targetType: "assessment_question", ...(file ? { fileId: file.id } : {}) });
          setBusy(false);
          if (done) {
            setTitle("");
            setFile(null);
          }
        }}
      >
        <Field label="What it is" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
        {file ? <p className="text-sm text-ink-2">Attached: {file.name}</p> : <FileUpload organizationId={organizationId} label="Attach the document" onUploaded={(f) => setFile(f)} />}
        <Button type="submit" loading={busy} disabled={!title.trim()}>
          Send to Entrust
        </Button>
      </form>
    </Card>
  );
}

function RequestEvidence({ onRequest }: { onRequest: (body: { title: string; prompt: string; targetType: string; targetId?: string }) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-display text-lg font-bold text-ink">Ask the business for evidence</h2>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const done = await onRequest({ title: title.trim(), prompt: prompt.trim(), targetType: "assessment_question", ...(targetId.trim() ? { targetId: targetId.trim() } : {}) });
          setBusy(false);
          if (done) {
            setTitle("");
            setPrompt("");
            setTargetId("");
          }
        }}
      >
        <Field label="What you need" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
        <Field label="Question it backs (optional)" hint="For example C1, a placement question." value={targetId} onChange={(e) => setTargetId(e.target.value)} maxLength={100} />
        <Field label="What to send, in the business's words" value={prompt} onChange={(e) => setPrompt(e.target.value)} required maxLength={5000} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <Button type="submit" variant="secondary" loading={busy} disabled={!title.trim() || !prompt.trim()}>
            Ask for it
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Review({ onReview }: { onReview: (body: { status: string; comment?: string; confidence?: string }) => Promise<boolean> }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (status: string) => {
    setBusy(true);
    await onReview({ status, ...(comment.trim() ? { comment: comment.trim() } : {}), ...(status === "accepted" ? { confidence: "reviewed" } : {}) });
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Comment (needed to send back or not accept)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} className="min-w-64 flex-1" />
      <Button type="button" size="sm" disabled={busy} onClick={() => void decide("accepted")}>
        Accept
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={busy || !comment.trim()} onClick={() => void decide("resubmission_required")}>
        Send back
      </Button>
      <Button type="button" size="sm" variant="danger" disabled={busy || !comment.trim()} onClick={() => void decide("rejected")}>
        Don&apos;t accept
      </Button>
    </div>
  );
}
