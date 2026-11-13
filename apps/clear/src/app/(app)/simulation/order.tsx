import type { ReactNode } from "react";
import { Card, StatusBadge } from "@entrust/ui";
import { askById } from "@/lib/simulation/run";
import type { OpenItem } from "@/lib/simulation/types";
import { CardHeading, Eyebrow } from "../cases/[id]/parts";
import { money, simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { ViewLink, type View } from "./view";

/** The order tab: the purchase order as the buyer sent it, and what it leaves open. */
export function OrderTab({ sim, view }: { sim: Simulation; view: View }) {
  const { order } = sim.scenario;
  const answerTo = (askId: string) => askById(sim.scenario, askId)?.options.find((o) => o.id === sim.run.answers[askId]);
  const hsCode = answerTo("hs-code");
  const handover = answerTo("handover");

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <Card>
        <CardHeading title={`Purchase order ${order.number}`} />
        <div className="flex flex-col gap-5 px-4 pb-5 sm:px-5">
          <p className="text-sm text-ink-3">
            Dated {simDate(order.date)} · {order.currency} · a simulated document, not valid for trade
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Group title="Buyer">
              <p className="font-semibold">{order.buyer.company}</p>
              <p>{order.buyer.address}</p>
              <p className="text-ink-3">
                {order.buyer.contact} · {order.buyer.email}
              </p>
            </Group>
            <Group title="Seller">
              <p className="font-semibold">{order.seller.company}</p>
              <p>{order.seller.address}</p>
              <p className="text-ink-3">
                {order.seller.contact} · {order.seller.email}
              </p>
            </Group>
          </div>

          <Group title="Goods">
            <Rows
              rows={[
                ["Product", `${order.product.name}, ${order.product.form.toLowerCase()}, ${order.product.roast.toLowerCase()}`],
                ["Packaging", order.product.packaging],
                ["Quantity", `${order.product.quantity} (${order.product.netWeight} net)`],
                ["Price", `${money(order.value.unitPrice, order.currency)} a bag, ${money(order.value.total, order.currency)} in total`],
                ["Intended use", order.product.intendedUse],
              ]}
            />
            <Changed label="HS code" orderSays={order.product.hsCode} recorded={hsCode?.recorded} />
          </Group>

          <Group title="Delivery terms">
            <Changed
              label={`${order.delivery.incoterm} (${order.delivery.incotermsVersion})`}
              orderSays={`${order.delivery.namedPlace}. ${order.delivery.note}`}
              recorded={handover?.recorded}
            />
          </Group>

          <List title="Payment terms" items={order.paymentTerms} />
          <List title="Packaging and marking" items={order.packagingAndMarking} />
          <List title="Quality requirements" items={order.qualityRequirements} />

          <Group title="Schedule">
            <Rows rows={order.schedule.map((s) => [s.label, s.value])} />
          </Group>

          <Group title="Documents the order asks for">
            <ul className="overflow-hidden rounded-lg border border-line">
              {order.requiredDocuments.map((doc) => {
                const onFile = doc.evidence.length > 0 && doc.evidence.every((type) => sim.run.evidence.some((e) => e.type === type));
                const notNeeded = !doc.evidence.length && doc.openItem !== undefined && sim.run.settled.includes(doc.openItem);
                return (
                  <li key={doc.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-3 py-2.5 first:border-t-0">
                    <span className="min-w-0">{doc.label}</span>
                    <StatusBadge tone={onFile ? "ok" : "idle"}>{onFile ? "On file" : notNeeded ? "None needed" : "Not yet"}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </Group>
        </div>
      </Card>

      <Card>
        <CardHeading title="What the order leaves open" />
        <p className="px-4 pb-3 text-sm text-ink-2 sm:px-5">
          CLEAR does not fill these in. Two stop the run until you answer. The rest are confirmed with the buyer or the bank at the step that
          needs them.
        </p>
        <ul>
          {sim.scenario.openItems.map((item) => (
            <OpenItemRow key={item.id} item={item} sim={sim} view={view} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function OpenItemRow({ item, sim, view }: { item: OpenItem; sim: Simulation; view: View }) {
  const ask = item.askId ? askById(sim.scenario, item.askId) : undefined;
  const answered = ask?.options.find((o) => o.id === sim.run.answers[ask.id]);
  const asked = ask ? sim.run.asked.includes(ask.id) : false;
  const settled = sim.run.settled.includes(item.id);
  const status = ask
    ? answered
      ? ({ label: "Answered", tone: "ok" } as const)
      : asked
        ? ({ label: "Awaiting SME", tone: "warn" } as const)
        : ({ label: "Stops the run", tone: "idle" } as const)
    : settled
      ? ({ label: "Settled", tone: "ok" } as const)
      : ({ label: "Open", tone: "idle" } as const);

  return (
    <li className="border-t border-line px-4 py-3.5 text-sm sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="font-sans text-sm font-bold">{item.label}</h3>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      <p className="mt-1 text-ink-3">The order says: “{item.orderSays}”</p>
      {answered && (
        <p className="mt-1.5">
          <span className="font-semibold">{answered.recorded ?? answered.label}.</span>
        </p>
      )}
      {settled && item.settled && <p className="mt-1.5">{item.settled}</p>}
      <p className="mt-1.5">
        <ViewLink
          to={{ ...view, step: item.stepId }}
          mode="push"
          className="inline-flex min-h-6 items-center font-semibold text-brand-600 underline-offset-4 hover:underline"
        >
          {ask ? "Asked at" : "Settled at"} <span className="ml-1 font-mono text-xs">{item.stepId}</span>
        </ViewLink>
      </p>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="text-sm">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-2 flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: (readonly [string, string])[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-1 gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-ink-3">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <Group title={title}>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Group>
  );
}

/** A term the order left open: its own words, and what is on record once the question is answered. */
function Changed({ label, orderSays, recorded }: { label: string; orderSays: string; recorded?: string }) {
  return (
    <div className={recorded ? "mt-2 rounded-lg bg-ok-50 p-3 ring-1 ring-ok/25 ring-inset" : "mt-2 rounded-lg bg-warn-50 p-3 ring-1 ring-warn/30 ring-inset"}>
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <StatusBadge tone={recorded ? "ok" : "warn"}>{recorded ? "On record" : "Left open"}</StatusBadge>
      </p>
      {recorded && <p className="mt-1 font-semibold">{recorded}</p>}
      <p className="mt-1 text-ink-2">The order says: “{orderSays}”</p>
    </div>
  );
}
