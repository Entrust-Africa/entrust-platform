import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { afriConnectBuyersUrl } from "@entrust/auth/africonnect";
import { getMe, serverApi } from "@/lib/api";
import { PHASES } from "@/lib/statuses";
import { Drawer } from "./drawer";
import { EvidenceTab } from "./evidence";
import { CaseHeader } from "./header";
import { OverviewTab } from "./overview";
import { DeadlinesTab, DetailsTab, FlagsTab, RequirementsTab } from "./panels";
import { StepPanel } from "./step-panel";
import { StepsTab } from "./steps";
import { TABS, caseHref, type Tab, type View } from "./view";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared by the metadata and the page, so the case is fetched once per request.
const loadCase = cache(async (id: string) => {
  if (!UUID.test(id)) notFound();
  const res = await (await serverApi()).v1.clear.cases[":id"].$get({ param: { id } });
  if (res.status === 401) redirect("/sign-in");
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`The case didn't load (${res.status}).`);
  return res.json();
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadCase(id);
  return { title: detail.reference };
}

type Search = Record<string, string | string[] | undefined>;

/** From this phase on the goods are shipped or about to be: time to line up the next buyer. */
const FINAL_STAGES_FROM = 6;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [detail, me] = await Promise.all([loadCase(id), getMe()]);
  // Exporters are pointed to AfriConnect once a case reaches its last stretch; Entrust staff have no use for it.
  const buyers =
    !me?.staffRole && detail.status !== "cancelled" && (detail.status === "closed" || detail.currentPhase >= FINAL_STAGES_FROM)
      ? { href: afriConnectBuyersUrl(), closed: detail.status === "closed" }
      : undefined;

  const tabParam = one(search.tab);
  const tab: Tab = TABS.find((t) => t.id === tabParam)?.id ?? "overview";
  const phaseParam = Number(one(search.phase));
  const phase = tab === "steps" && PHASES.some((p) => p.n === phaseParam) ? phaseParam : undefined;
  const view: View = { tab, phase, show: one(search.show), req: one(search.req) };
  const step = detail.workflow.steps.find((s) => s.id === one(search.step));
  if (step) view.step = step.id;

  return (
    <>
      <CaseHeader detail={detail} view={view} />
      <div className="mt-6">
        {tab === "overview" && <OverviewTab detail={detail} view={view} buyers={buyers} />}
        {tab === "steps" && <StepsTab detail={detail} view={view} phase={phase ?? detail.currentPhase} />}
        {tab === "evidence" && <EvidenceTab detail={detail} view={view} />}
        {tab === "flags" && <FlagsTab detail={detail} view={view} />}
        {tab === "details" && <DetailsTab detail={detail} />}
        {tab === "deadlines" && <DeadlinesTab detail={detail} view={view} />}
        {tab === "requirements" && <RequirementsTab detail={detail} view={view} />}
      </div>
      {step && (
        <Drawer key={step.id} closeHref={caseHref(detail.id, { ...view, step: undefined })} label={`${step.id} ${step.name}`}>
          <StepPanel detail={detail} step={step} view={view} />
        </Drawer>
      )}
    </>
  );
}
