import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { PLATFORM_URLS } from "../../lib/site";
import { CountUp } from "../platforms/CountUp";
import { ForestPanel } from "../platforms/ForestPanel";
import { PlatformHero } from "../platforms/PlatformHero";
import { ShareTable, type ShareRow } from "../platforms/ShareTable";
import { SignInCard } from "../platforms/SignInCard";
import { PLATFORM_ACCOUNT, PLATFORM_THEME } from "../platforms/theme";

const theme = PLATFORM_THEME.mizan;
const account = PLATFORM_ACCOUNT.mizan;

const PILLARS: [string, number, string][] = [
  ["Financial performance and resilience", 45, "Profitability, liquidity, cash generation and leverage"],
  ["Management and operational capacity", 20, "Management capability, systems and continuity"],
  ["Market and commercial readiness", 15, "Revenue quality, market position and pipeline"],
  ["Governance and financial discipline", 20, "Compliance, financial reporting and internal controls"],
];

const PILLAR_ROWS: ShareRow[] = PILLARS.map(([name, points, detail], i) => ({
  n: i + 1,
  name,
  value: String(points),
  weight: points,
  detail,
  mobileValue: `${points} points`,
}));

const LEVELS = [
  { level: 5, from: 80, text: "Ready to approach lenders: strong readiness across all pillars." },
  { level: 4, from: 65, text: "Ready to approach lenders, after addressing the specific gaps in the improvement plan." },
  { level: 3, from: 50, text: "Not yet ready: close the high-priority gaps before approaching lenders." },
  { level: 2, from: 35, text: "Not yet ready: significant gaps in several areas need to be addressed first." },
  { level: 1, from: 0, text: "Not yet ready: foundational gaps across most areas." },
];

const RULES = [
  { title: "Missing evidence is never marked down", text: "It is left out of the score, not counted as poor performance." },
  { title: "One strong area can’t hide a weak one", text: "A pillar that falls too low caps the readiness level." },
  {
    title: "A second person approves every assessment",
    text: "Never the assessor, and never someone who trained or advised the SME.",
  },
  {
    title: "An evidence grade beside the score",
    text: "Grades A to E show how well the evidence backs the score. They never change it.",
  },
];

const METHODOLOGY =
  "Methodology MIZAN-Core v0.2-interim. Weights and levels are not yet independently validated.";

export default function MizanPage() {
  return (
    <>
      <PlatformHero
        theme={theme}
        eyebrow="MIZAN"
        title="Africa’s SME Financial Readiness Standard."
        lead="MIZAN assesses how ready a business is to approach lenders, and gives the SME a report and an improvement plan of its own."
      >
        <SignInCard
          name="MIZAN"
          signInHref={account.signIn}
          secondary={{ label: "Have an invitation?", href: account.signIn }}
          forgot={{ label: "Forgot your password?", href: account.forgotPassword }}
        />
      </PlatformHero>

      {/* How the score works */}
      <section id="how-it-works" className="shell mt-20 flex flex-col gap-8 md:mt-24">
        <Reveal className="flex max-w-[760px] flex-col gap-4">
          <SplitWords text="100 points. Four pillars." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            Every business is scored against the same four pillars. Each one is built from dimensions that look at
            evidence, such as bank records, tax filings and financial statements.
          </p>
        </Reveal>
        <ShareTable
          rows={PILLAR_ROWS}
          theme={theme}
          headings={{ item: "Pillar", value: "Points", detail: "What it looks at" }}
          barLabel="Points for each pillar"
          mobile="header"
          barStart="accent"
        />
      </section>

      {/* Readiness levels */}
      <section className="shell mt-20 grid gap-8 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <Reveal className="flex flex-col gap-4">
          <SplitWords text="A level a lender can read." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            The score places a business on one of five readiness levels. Levels 4 and 5 mean the business is ready to
            approach lenders. Below that, the improvement plan says what to close first.
          </p>
          <p className="hidden text-sm leading-[22px] text-subtle lg:block">{METHODOLOGY}</p>
        </Reveal>
        <Stagger role="list" gap={0.08} className="border-b border-line">
          {LEVELS.map((l, i) => (
            <StaggerItem
              key={l.level}
              role="listitem"
              className={`group grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-t py-4 md:grid-cols-[150px_70px_minmax(0,1fr)] ${
                i === 0 ? "border-line-strong" : "border-line"
              }`}
            >
              <h3 className="text-xl font-semibold leading-7 text-ink transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-1">
                Level {l.level}
              </h3>
              <span className="text-right text-base font-semibold leading-7 md:text-left" style={{ color: theme.ink }}>
                <span className="sr-only">Score </span>
                <CountUp to={l.from} suffix="+" />
              </span>
              <p className="col-span-2 text-base leading-6 text-muted transition-colors duration-300 group-hover:text-ink md:col-span-1">
                {l.text}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="text-sm leading-[22px] text-subtle lg:hidden">{METHODOLOGY}</p>
      </section>

      <ForestPanel
        title="Your report, once it’s approved."
        body="Entrust Africa assesses your business and a second reviewer approves it. Your report and improvement plan then appear in MIZAN."
        actions={[
          { label: "Sign in to MIZAN", href: PLATFORM_URLS.mizan, external: true },
          { label: "Go to TRADE", href: "/trade" },
        ]}
        items={RULES}
        listSide="left"
        accent={theme.accent}
      />
    </>
  );
}
