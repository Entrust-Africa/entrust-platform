"use client";

import * as React from "react";
import {
  Button,
  Card,
  CaseHeader,
  EvidenceItem,
  Field,
  FlagBanner,
  GateSummaryCard,
  Patchwork,
  PhaseStepper,
  StatusBadge,
  StepRow,
  cn,
  PHASES,
  CASE_STATUSES,
  TASK_STATUSES,
  EVIDENCE_STATUSES,
  STEP_STATUSES,
} from "@entrust/ui";

const swatches: { group: string; items: { name: string; className: string; value: string }[] }[] = [
  {
    group: "Brand",
    items: [
      { name: "brand-500", className: "bg-brand-500", value: "#19954f · the mark" },
      { name: "brand-600", className: "bg-brand-600", value: "#157642 · buttons" },
      { name: "brand-900", className: "bg-brand-900", value: "deep green" },
      { name: "night", className: "bg-night", value: "dark panels" },
      { name: "product", className: "bg-product", value: "CLEAR accent" },
    ],
  },
  {
    group: "Neutrals",
    items: [
      { name: "ink", className: "bg-ink", value: "#161b26 · text" },
      { name: "ink-3", className: "bg-ink-3", value: "muted text" },
      { name: "line", className: "bg-line", value: "borders" },
      { name: "canvas", className: "bg-canvas", value: "page" },
      { name: "surface", className: "bg-surface", value: "cards" },
    ],
  },
  {
    group: "Status",
    items: [
      { name: "ok", className: "bg-ok", value: "approved" },
      { name: "info", className: "bg-info", value: "in review" },
      { name: "warn", className: "bg-warn", value: "awaiting, changes" },
      { name: "danger", className: "bg-danger", value: "blocked, rejected" },
      { name: "idle", className: "bg-idle", value: "not started" },
    ],
  },
];

function Section({
  id,
  title,
  note,
  children,
}: {
  id?: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-line py-10">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-ink-2">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  const [selectedPhase, setSelectedPhase] = React.useState<number>(3);

  // 7 phases with sample progression states
  const phaseList = PHASES.map((p) => {
    let state: "done" | "current" | "upcoming" | "locked" = "upcoming";
    if (p.n < selectedPhase) state = "done";
    else if (p.n === selectedPhase) state = "current";
    else if (p.n >= 6) state = "locked";
    return {
      n: p.n,
      title: p.title,
      steps: `Steps ${p.steps}`,
      state,
    };
  });

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="bg-night text-on-night">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-10">
          <p className="font-display text-xs font-bold tracking-[0.18em] text-on-night-muted uppercase">
            Entrust design system · Workflow Components (#20)
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-display">
            Workflow components for case screens.
          </h1>
          <p className="mt-4 max-w-2xl text-on-night-muted">
            Presentational, typed components living in <code className="text-white font-mono">packages/ui</code>:
            Phase stepper, Step row, Evidence item, Gate summary card, Case header, and Flag banner,
            featuring empty, loading, and error states.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="on-night" size="lg" onClick={() => window.scrollTo({ top: 600, behavior: "smooth" })}>
              Explore components ↓
            </Button>
          </div>
        </div>
        <Patchwork />
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 space-y-4">
        {/* ========================================================= */}
        {/* 1. Case Header */}
        {/* ========================================================= */}
        <Section
          id="case-header"
          title="1. Case Header"
          note="Reference code, exporter → buyer trade relationship, product, commercial terms, and status badge."
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Live Case Header</p>
              <CaseHeader
                reference="CLR-ET-2026-000145"
                exporterName="ZEBU Coffee Exporters"
                buyerName="Artisan Coffee Roasters USA"
                product="Green Coffee (Specialty Grade 1 Washed)"
                terms="FOB Djibouti · 10% Advance, 90% CAD · US$60,873.43"
                status={CASE_STATUSES.open}
                actionSlot={
                  <Button variant="secondary" size="sm">
                    Download dossier
                  </Button>
                }
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <CaseHeader loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <CaseHeader error="Failed to fetch case header details. Please refresh." />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* 2. Phase Stepper */}
        {/* ========================================================= */}
        <Section
          id="phase-stepper"
          title="2. Phase Stepper"
          note="7 export phases with done, current, upcoming, and locked states. Interactive: click any phase to update."
        >
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-3">
                  Interactive Stepper (Active: Phase {selectedPhase})
                </p>
                <span className="text-xs text-brand-600 font-medium">Click a phase to change state</span>
              </div>
              <PhaseStepper
                phases={phaseList}
                currentPhase={selectedPhase}
                onSelectPhase={(n) => setSelectedPhase(n)}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <PhaseStepper loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <PhaseStepper
                error="Unable to load phase sequence from engine."
                onRetry={() => setSelectedPhase(3)}
              />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* 3. Step Row */}
        {/* ========================================================= */}
        <Section
          id="step-row"
          title="3. Step Row"
          note="Compliance step items showing step code, title, owner, task status, due dates, blocked reasons, and action slots."
        >
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Step States</p>

            {/* In Progress */}
            <StepRow
              stepCode="STEP-046"
              name="Submit export permit application to commercial bank"
              owner="Bank, recorded by SME"
              taskStatus={TASK_STATUSES.in_progress}
              dueDate="28 Oct 2026"
              actionSlot={<Button size="sm">Record submission</Button>}
            />

            {/* Blocked */}
            <StepRow
              stepCode="STEP-049"
              name="National Bank of Ethiopia FX registration"
              owner="SME"
              taskStatus={TASK_STATUSES.blocked}
              blockedReason="Blocked: Awaiting commercial bank verification of deposit prior to permit clearance."
              actionSlot={
                <Button variant="secondary" size="sm">
                  Resolve
                </Button>
              }
            />

            {/* Overdue */}
            <StepRow
              stepCode="STEP-033"
              name="Destination phytosanitary import permit pre-check"
              owner="Entrust"
              taskStatus={TASK_STATUSES.awaiting_sme}
              dueDate="24 Oct 2026"
              isOverdue
              actionSlot={<Button size="sm">Submit now</Button>}
            />

            {/* Completed */}
            <StepRow
              stepCode="STEP-004"
              name="Commercial contract execution and buyer terms verification"
              owner="SME"
              taskStatus={STEP_STATUSES.completed}
              dueDate="20 Oct 2026"
            />

            {/* Not Applicable */}
            <StepRow
              stepCode="STEP-062"
              name="Roasted coffee moisture migration certificate"
              owner="Entrust"
              taskStatus={STEP_STATUSES.not_applicable}
              notApplicableReason="Applies only to roasted or ground coffee consignments. Consignment is raw green coffee."
            />

            <div className="pt-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <StepRow loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <StepRow error="Could not retrieve step definition." />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* 4. Evidence Item */}
        {/* ========================================================= */}
        <Section
          id="evidence-item"
          title="4. Evidence Item"
          note="Document upload slots showing document type, verification status, file downloads, reviewer feedback, and action slots."
        >
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Evidence States</p>

            {/* Approved File */}
            <EvidenceItem
              documentType="Commercial Invoice (Signed & Stamped)"
              status={EVIDENCE_STATUSES.approved}
              file={{
                name: "commercial-invoice-inv-2026-004.pdf",
                sizeBytes: 1540000,
                url: "#",
                uploadedAt: "22 Oct 2026 at 14:15",
              }}
            />

            {/* Under Review */}
            <EvidenceItem
              documentType="Export Permit (Form NBE-EP)"
              status={EVIDENCE_STATUSES.under_review}
              file={{
                name: "permit-application-scan.pdf",
                sizeBytes: 2840000,
                url: "#",
                uploadedAt: "Today at 09:30",
              }}
            />

            {/* Changes Required with Reviewer Note */}
            <EvidenceItem
              documentType="Phytosanitary Certificate (ECTA)"
              status={EVIDENCE_STATUSES.changes_required}
              file={{
                name: "phytosanitary-cert-draft.pdf",
                sizeBytes: 980000,
                url: "#",
                uploadedAt: "Yesterday at 17:00",
              }}
              reviewerNote="The consignment net weight on line 4 (18,400 kg) does not reconcile with the bill of lading manifest (19,200 kg). Please request an amended certificate from the authority."
              actionSlot={<Button size="sm">Upload replacement</Button>}
            />

            {/* Not Provided */}
            <EvidenceItem
              documentType="Certificate of Origin (Chamber of Commerce)"
              status={EVIDENCE_STATUSES.not_provided}
              actionSlot={<Button size="sm">Upload evidence</Button>}
            />

            <div className="pt-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <EvidenceItem loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <EvidenceItem error="Failed to verify evidence file integrity." />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* 5. Gate Summary Card */}
        {/* ========================================================= */}
        <Section
          id="gate-summary"
          title="5. Gate Summary Card"
          note="Milestone gate tracker calculating completed steps, listing remaining blockers, and providing sign-off slots."
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">In Progress Gate with Remaining Items</p>
              <GateSummaryCard
                phaseNumber={3}
                phaseTitle="Destination admissibility & regulatory licensing"
                gateStatus="open"
                completedSteps={14}
                totalSteps={18}
                remainingItems={[
                  { title: "Submit export permit application to commercial bank (STEP-046)" },
                  { title: "National Bank of Ethiopia FX approval (STEP-049)" },
                  { title: "Upload amended Phytosanitary Certificate" },
                ]}
                signOffSlot={
                  <Button variant="secondary" size="sm" disabled>
                    Sign off phase
                  </Button>
                }
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Ready to Sign Off Gate</p>
              <GateSummaryCard
                phaseNumber={2}
                phaseTitle="Buyer contracting & commercial terms"
                gateStatus="ready"
                completedSteps={17}
                totalSteps={17}
                signOffSlot={<Button size="sm">Sign off Milestone Gate 2</Button>}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Locked / Signed Off Gate</p>
              <GateSummaryCard
                phaseNumber={1}
                phaseTitle="Exporter onboarding & product identity"
                gateStatus="locked"
                completedSteps={18}
                totalSteps={18}
                lockedDetails={{
                  signedBy: "Minase Fikadu (Entrust Facilitator)",
                  signedAt: "22 Oct 2026, 16:30 EAT",
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <GateSummaryCard loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <GateSummaryCard error="Failed to calculate gate closure eligibility." />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* 6. Flag Banner */}
        {/* ========================================================= */}
        <Section
          id="flag-banner"
          title="6. Flag Banner"
          note="Failure rule flags and compliance alerts categorized by severity (critical, high, medium) and status."
        >
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Flag Severities & States</p>

            {/* Critical Severity */}
            <FlagBanner
              code="FL-02"
              title="Destination port regulatory trade sanction"
              severity="critical"
              status="open"
              description="Consignment delivery destination is subject to mandatory regulatory trade sanctions under Council Regulation (EU) 2026/89. Case processing cannot proceed until resolved."
              actionSlot={
                <Button variant="secondary" size="sm">
                  Resolve exception
                </Button>
              }
            />

            {/* High Severity */}
            <FlagBanner
              code="STEP-024"
              title="Declared contract price falls below National Coffee MEP"
              severity="high"
              status="open"
              description="Declared FOB unit value ($2.85/lb) is below Ethiopian Coffee & Tea Authority minimum export price threshold ($3.10/lb) for Grade 1 Washed Yirgacheffe."
              actionSlot={
                <Button variant="secondary" size="sm">
                  Record MEP justification
                </Button>
              }
            />

            {/* Medium Severity */}
            <FlagBanner
              code="FL-07"
              title="FX repatriation settlement deadline within 14 days"
              severity="medium"
              status="open"
              description="National Bank of Ethiopia requires repatriation receipt reconciliation within 28 days of bill of lading issuance."
            />

            {/* Resolved Flag */}
            <FlagBanner
              code="FL-05"
              title="Alternative port routing clearance exception"
              severity="high"
              status="resolved"
              description="Exception approved by Entrust Facilitator on 23 Oct 2026. Routing via Berbera accepted."
            />

            {/* Waived Flag */}
            <FlagBanner
              code="FL-01"
              title="Preliminary moisture certificate waiver"
              severity="medium"
              status="waived"
              description="Waived: Sourcing verified under direct cooperative traceability protocol."
            />

            <div className="pt-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Loading State (Skeleton)</p>
              <FlagBanner loading />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Error State</p>
              <FlagBanner error="Failed to retrieve compliance flags for this case." />
            </div>
          </div>
        </Section>

        {/* ========================================================= */}
        {/* Foundations: Colours & Typography (Preserved) */}
        {/* ========================================================= */}
        <Section title="Design Foundations · Colour" note="Every colour is a named token in packages/ui/src/styles.css.">
          <div className="grid gap-8 md:grid-cols-3">
            {swatches.map((g) => (
              <div key={g.group}>
                <h3 className="text-sm font-semibold text-ink-2">{g.group}</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {g.items.map((s) => (
                    <li key={s.name} className="flex items-center gap-3">
                      <span className={cn("size-9 shrink-0 rounded-md ring-1 ring-line ring-inset", s.className)} />
                      <span className="min-w-0 text-sm">
                        <span className="font-mono text-xs">{s.name}</span>
                        <span className="block text-ink-3">{s.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
