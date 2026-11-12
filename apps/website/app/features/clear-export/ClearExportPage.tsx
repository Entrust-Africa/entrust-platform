import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ForestPanel } from "../platforms/ForestPanel";
import { PlatformHero } from "../platforms/PlatformHero";
import { ShareTable, type ShareRow } from "../platforms/ShareTable";
import { SignInCard } from "../platforms/SignInCard";
import { PLATFORM_ACCOUNT, PLATFORM_THEME } from "../platforms/theme";

const theme = PLATFORM_THEME.clear;
const account = PLATFORM_ACCOUNT.clear;

const PHASES: [string, string, string, number][] = [
  ["Exporter onboarding and product identity", "001–018", "Product identity locked", 18],
  ["Buyer contracting and commercial terms", "019–035", "Commercial readiness locked", 17],
  ["Destination admissibility and regulatory licensing", "036–054", "Regulatory and market pathway approved", 19],
  ["Commodity sourcing, processing and quality control", "055–072", "Cargo packed and quality certified", 18],
  ["Logistics, container equipment and customs clearance", "073–091", "Cargo cleared and released for export", 19],
  ["Destination pre-arrival and post-shipment logistics", "092–108", "Cargo shipped and delivered", 17],
  ["Banking presentation, FX repatriation and case closure", "109–125", "Payment reconciled and case closed", 17],
];

const PHASE_ROWS: ShareRow[] = PHASES.map(([name, value, detail, weight], i) => ({
  n: i + 1,
  name,
  value,
  detail,
  weight,
  mobileValue: `Steps ${value}`,
}));

const ROUTES = [
  { name: "Ethiopia to the EU", goods: "Avocado, coffee" },
  { name: "Ethiopia to the US", goods: "Green coffee, spices, processed food" },
  { name: "Ethiopia to the GCC", goods: "Avocado" },
  { name: "Ethiopia to Türkiye", goods: "Spices" },
];

const FEATURES = [
  { title: "Evidence attached to each step", text: "Upload permits and documents against the step that needs them." },
  { title: "Checks before a case moves on", text: "The GATE engine evaluates the case before its status can change." },
  { title: "Entrust alongside you", text: "A facilitator and a reviewer from Entrust work with your team." },
  { title: "A full audit trail", text: "Every change to a case is recorded." },
];

export default function ClearExportPage() {
  return (
    <>
      <PlatformHero
        theme={theme}
        eyebrow="CLEAR Export"
        title="Your export cases, step by step."
        lead="Track every permit, document and deadline from first order to the final foreign exchange settlement."
      >
        <SignInCard
          name="CLEAR"
          signInHref={account.signIn}
          secondary={{ label: "Create an account", href: account.signIn }}
          forgot={{ label: "Forgot your password?", href: account.forgotPassword }}
        />
      </PlatformHero>

      {/* The 7 phases */}
      <section id="phases" className="shell mt-20 flex flex-col gap-8 md:mt-24">
        <Reveal className="flex max-w-[760px] flex-col gap-4">
          <SplitWords text="125 steps. Seven phases. One case." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            Every export case follows the same route, from exporter onboarding through to payment reconciled and case
            closed. Each phase ends at a milestone you can see.
          </p>
        </Reveal>
        <ShareTable
          rows={PHASE_ROWS}
          theme={theme}
          headings={{ item: "Phase", value: "Steps", detail: "Milestone" }}
          barLabel="Steps in each phase"
          mobile="inline"
          barStart="deep"
        />
      </section>

      {/* Trade routes */}
      <section id="routes" className="shell mt-20 grid gap-8 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <Reveal className="flex flex-col gap-6">
          <SplitWords text="Rules for the route you’re shipping on." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            Requirements change with product and destination. CLEAR applies a rule pack for your route, so a case only
            asks for what that shipment needs.
          </p>
        </Reveal>
        <Stagger role="list" gap={0.08} className="grid border-b border-line-strong sm:grid-cols-2 sm:gap-x-6 sm:border-b-0">
          {ROUTES.map((r) => (
            <StaggerItem
              key={r.name}
              role="listitem"
              className="group relative border-t border-line-strong py-4"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 -top-px h-0.5 origin-left scale-x-0 transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-x-100"
                style={{ backgroundColor: theme.accent }}
              />
              <div className="transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-1.5">
                <h3 className="text-xl font-semibold leading-7 text-ink">{r.name}</h3>
                <p className="text-base leading-6 text-muted">{r.goods}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <ForestPanel
        title="Start your first case."
        body="CLEAR Export is built for Ethiopian SMEs. Create an account and open a case for your next shipment."
        actions={[{ label: "Create an account", href: account.signIn, external: true }]}
        items={FEATURES}
        listSide="left"
        accent={theme.accent}
      />
    </>
  );
}
