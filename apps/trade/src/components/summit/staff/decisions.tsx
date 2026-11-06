"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { formatDateTime } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import { DECISIONS, OPPORTUNITIES, RECOMMENDATIONS, labelOf, type StaffAccess, type Workspace } from "@/lib/summit-staff";
import { Outcome, Select, TextArea, useAction } from "./use-action";

const IN_ASSESSMENT = ["under_assessment", "under_verification"];

/**
 * What can be done next with an application, depending on where it is: move it between assessment and verification,
 * complete the assessment, make the recommendation, review it (administrators) or decide it (the committee).
 */
export function NextSteps({ applicationId, status, workspace, access, canEdit }: { applicationId: string; status: string; workspace: Workspace; access: StaffAccess; canEdit: boolean }) {
  return (
    <section aria-labelledby="next" className="space-y-4">
      <h2 id="next" className="font-display text-xl font-bold text-ink">
        Next steps
      </h2>
      {workspace.recommendation && <RecommendationCard recommendation={workspace.recommendation} />}
      {workspace.reviews.length > 0 && <Reviews reviews={workspace.reviews} />}
      {canEdit && IN_ASSESSMENT.includes(status) && <Stage applicationId={applicationId} status={status} />}
      {canEdit && workspace.state !== "completed" && IN_ASSESSMENT.includes(status) && <Complete applicationId={applicationId} workspace={workspace} />}
      {canEdit && workspace.state === "completed" && !workspace.recommendation && status === "assessment_completed" && <Recommend applicationId={applicationId} />}
      {access.allApplications && status === "recommended" && <Review applicationId={applicationId} />}
      {access.committee && status === "committee_review" && <Decide applicationId={applicationId} />}
    </section>
  );
}

function RecommendationCard({ recommendation }: { recommendation: NonNullable<Workspace["recommendation"]> }) {
  return (
    <Card className="space-y-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">The officer's recommendation</h3>
        <StatusBadge tone="product">{recommendation.label}</StatusBadge>
      </div>
      {recommendation.suitableOpportunity && <p className="text-sm text-ink-2">Best suited to: {labelOf(OPPORTUNITIES, recommendation.suitableOpportunity)}</p>}
      <p className="whitespace-pre-wrap text-sm text-ink-2">{recommendation.rationale}</p>
      <p className="text-xs text-ink-3">
        {recommendation.by?.name ?? "An officer"} · {formatDateTime(recommendation.at)}
      </p>
    </Card>
  );
}

function Reviews({ reviews }: { reviews: Workspace["reviews"] }) {
  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-sm font-semibold text-ink">Quality review</h3>
      <ul className="space-y-2 text-sm">
        {reviews.map((r) => (
          <li key={r.at} className="space-y-0.5">
            <StatusBadge tone={r.decision === "approved" ? "ok" : "warn"}>{r.decision === "approved" ? "Approved" : "Sent back"}</StatusBadge>
            {r.reason && <p className="text-ink-2">{r.reason}</p>}
            <p className="text-xs text-ink-3">
              {r.by?.name ?? "An administrator"} · {formatDateTime(r.at)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Stage({ applicationId, status }: { applicationId: string; status: string }) {
  const move = useAction();
  const to = status === "under_assessment" ? "under_verification" : "under_assessment";
  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-sm font-semibold text-ink">{status === "under_assessment" ? "Assessing" : "Verifying claims"}</h3>
      <p className="text-sm text-ink-2">Move the application between scoring and checking the claims whenever you need to.</p>
      <Button size="sm" variant="secondary" loading={move.busy} onClick={() => move.run(() => ok(browserApi().v1.summit.applications[":id"].stage.$post({ param: { id: applicationId }, json: { to } })), "Moved.")}>
        {to === "under_verification" ? "Move to verification" : "Back to assessment"}
      </Button>
      <Outcome error={move.error} done={move.done} />
    </Card>
  );
}

function Complete({ applicationId, workspace }: { applicationId: string; workspace: Workspace }) {
  const complete = useAction();
  const open = [
    ...(workspace.score.complete ? [] : ["Score every criterion."]),
    ...workspace.noteProblems.map((p) => p.message),
  ];
  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-sm font-semibold text-ink">Complete the assessment</h3>
      {open.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
          {open.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Scores and notes are in. Completing locks the scores; after that you write the recommendation.</p>
      )}
      <Button size="sm" loading={complete.busy} disabled={open.length > 0} onClick={() => complete.run(() => ok(browserApi().v1.summit.applications[":id"].assessment.complete.$post({ param: { id: applicationId } })), "Assessment completed.")}>
        Complete the assessment
      </Button>
      <Outcome error={complete.error} done={complete.done} />
    </Card>
  );
}

function Recommend({ applicationId }: { applicationId: string }) {
  const save = useAction();
  const [recommendation, setRecommendation] = useState<string>(RECOMMENDATIONS[0].id);
  const [opportunity, setOpportunity] = useState<string>("");
  const [rationale, setRationale] = useState("");
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-ink">Your recommendation</h3>
      <Select label="Recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} options={RECOMMENDATIONS} />
      <Select label="Best suited to" value={opportunity} onChange={(e) => setOpportunity(e.target.value)} options={[{ id: "", label: "No view" }, ...OPPORTUNITIES]} />
      <TextArea label="Why" value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={4000} hint="The committee reads this beside the score." />
      <Button
        size="sm"
        loading={save.busy}
        disabled={!rationale.trim()}
        onClick={() =>
          save.run(
            () =>
              ok(
                browserApi().v1.summit.applications[":id"].recommendation.$post({
                  param: { id: applicationId },
                  json: { recommendation, rationale, ...(opportunity ? { suitableOpportunity: opportunity } : {}) },
                }),
              ),
            "Recommendation sent for review.",
          )
        }
      >
        Send the recommendation
      </Button>
      <Outcome error={save.error} done={save.done} />
    </Card>
  );
}

function Review({ applicationId }: { applicationId: string }) {
  const review = useAction();
  const [reason, setReason] = useState("");
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-ink">Quality review</h3>
      <p className="text-sm text-ink-2">Approving puts the application in front of the committee. Sending it back gives it to the officer to fix, with your reason.</p>
      <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} hint="Required when sending it back." />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={review.busy} onClick={() => review.run(() => ok(browserApi().v1.summit.applications[":id"].review.$post({ param: { id: applicationId }, json: { decision: "approve", ...(reason.trim() ? { reason } : {}) } })), "Sent to the committee.")}>
          Approve for the committee
        </Button>
        <Button size="sm" variant="secondary" loading={review.busy} disabled={!reason.trim()} onClick={() => review.run(() => ok(browserApi().v1.summit.applications[":id"].review.$post({ param: { id: applicationId }, json: { decision: "return", reason } })), "Sent back to the officer.")}>
          Send back to the officer
        </Button>
      </div>
      <Outcome error={review.error} done={review.done} />
    </Card>
  );
}

/** The committee's decision on one application, with its reason. It can be replaced until the final list is approved. */
export function Decide({ applicationId }: { applicationId: string }) {
  const decide = useAction();
  const [decision, setDecision] = useState<string>("selected");
  const [reason, setReason] = useState("");
  return (
    <Card className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-ink">The committee's decision</h3>
      <Select label="Decision" value={decision} onChange={(e) => setDecision(e.target.value)} options={DECISIONS} />
      <TextArea label="Why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={4000} hint="Kept with the decision. The applicant never sees it, or the score." />
      <Button size="sm" loading={decide.busy} disabled={!reason.trim()} onClick={() => decide.run(() => ok(browserApi().v1.summit.applications[":id"].decision.$post({ param: { id: applicationId }, json: { decision, reason } })), "Decision recorded.")}>
        Record the decision
      </Button>
      <Outcome error={decide.error} done={decide.done} />
    </Card>
  );
}
