import { Button, Card, Field, Patchwork, StatusBadge, cn } from "@entrust/ui";
import { EVIDENCE_STATUSES, PHASES, TASK_STATUSES } from "@/lib/statuses";

export const metadata = { title: "Design system" };

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

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-sm text-ink-2">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  const currentPhase = 3;
  return (
    <div className="min-h-dvh">
      <header className="bg-night text-on-night">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-10">
          <p className="font-display text-xs font-bold tracking-[0.18em] text-on-night-muted uppercase">
            Entrust design system · draft 0.1
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-display">
            One look for every Entrust platform.
          </h1>
          <p className="mt-4 max-w-2xl text-on-night-muted">
            Entrust&apos;s green, Montserrat and Open Sans, with the dark sign-in panel from the Zemen
            Bank reference and the pan-African colour band from the Chamber of Commerce reference.
            CLEAR adds its own teal accent.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="on-night" size="lg">
              Primary on dark
            </Button>
            <Button size="lg">Start a case</Button>
          </div>
        </div>
        <Patchwork />
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <Section title="Colour" note="Every colour is a named token in packages/ui/src/styles.css. The colour band is decorative and never carries meaning.">
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

        <Section title="Type" note="Montserrat for headings, Open Sans for reading, a monospace face for references and codes. Noto Sans Ethiopic covers Amharic.">
          <div className="flex flex-col gap-5">
            <p className="font-display text-display font-extrabold">Display 44</p>
            <p className="font-display text-3xl font-bold">Page heading 30</p>
            <p className="font-display text-xl font-bold">Section heading 20</p>
            <p className="max-w-prose text-base leading-relaxed text-ink-2">
              Body 16. The NBE export permit is valid for 30 days. Proceeds must reach the bank
              within 90 days of the permit date.
            </p>
            <p className="font-sans text-base">ኢትዮጵያ · ቡና ወደ ውጭ መላክ</p>
            <p className="font-mono text-sm">CLR-ET-2026-000145 · HS 0901.11 · STEP-024</p>
          </div>
        </Section>

        <Section title="Buttons" note="Sentence-case labels in the app. Hover, focus and press are live; try them with the mouse and the Tab key.">
          <div className="flex flex-col gap-4">
            {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
              <div key={v} className="flex flex-wrap items-center gap-3">
                <span className="w-24 font-mono text-xs text-ink-3">{v}</span>
                <Button variant={v}>Approve evidence</Button>
                <Button variant={v} disabled>
                  Disabled
                </Button>
                <Button variant={v} loading>
                  Saving
                </Button>
                <Button variant={v} size="sm">
                  Small
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Fields">
          <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
            <Field label="Buyer name" placeholder="As on the purchase order" />
            <Field label="Contract value (USD)" hint="Matches the pro-forma invoice." inputMode="decimal" />
            <Field label="Incoterm named place" defaultValue="FOB Addis Ababa" error="FOB needs a sea port. Use FCA Addis Ababa or FOB Djibouti." />
            <Field label="NBE permit number" disabled defaultValue="Issued by the bank" />
          </div>
        </Section>

        <Section title="Statuses" note="The task and evidence dictionaries from the Operational Control Matrix. The label always states the status; colour only supports it.">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-2">Task</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.values(TASK_STATUSES).map((s) => (
                  <StatusBadge key={s.label} tone={s.tone}>
                    {s.label}
                  </StatusBadge>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-2">Evidence</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.values(EVIDENCE_STATUSES).map((s) => (
                  <StatusBadge key={s.label} tone={s.tone}>
                    {s.label}
                  </StatusBadge>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Case card" note="How a case will read on the case list. Example data only.">
          <Card className="max-w-3xl overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-3">CLR-ET-2026-000145 · Example</p>
                <h3 className="mt-1 font-display text-lg font-bold">ZEBU Coffee → Artisan Coffee USA</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Green coffee · FOB Djibouti · 10% advance, 90% CAD · US$60,873.43
                </p>
              </div>
              <StatusBadge tone="warn">Awaiting bank</StatusBadge>
            </div>
            <ol className="grid grid-cols-7 gap-1 px-6" aria-label="Phases">
              {PHASES.map((p) => (
                <li
                  key={p.n}
                  title={`Phase ${p.n}: ${p.title}`}
                  className={cn(
                    "h-1.5 rounded-full",
                    p.n < currentPhase ? "bg-ok" : p.n === currentPhase ? "bg-product" : "bg-line",
                  )}
                />
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-6 py-4 mt-5">
              <p className="min-w-0 text-sm">
                <span className="font-semibold">Phase 3 · next:</span> submit the export permit
                application to the bank (STEP-046)
              </p>
              <Button size="sm">Open case</Button>
            </div>
          </Card>
        </Section>

        <Section title="Phases" note="The seven phases Entrust confirmed. Each ends in a milestone gate.">
          <ol className="flex max-w-3xl flex-col">
            {PHASES.map((p) => {
              const state = p.n < currentPhase ? "done" : p.n === currentPhase ? "current" : "upcoming";
              return (
                <li key={p.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
                        state === "done" && "bg-ok text-white",
                        state === "current" && "bg-product-600 text-white",
                        state === "upcoming" && "bg-surface text-ink-3 ring-1 ring-line-strong ring-inset",
                      )}
                    >
                      {p.n}
                    </span>
                    {p.n < PHASES.length && <span className="w-px grow bg-line-strong" />}
                  </div>
                  <div className="min-w-0 pb-6">
                    <p className="font-semibold">{p.title}</p>
                    <p className="font-mono text-xs text-ink-3">Steps {p.steps}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      </main>
    </div>
  );
}
