"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { textInput } from "@/components/form-runner/styles";
import { browserApi, ok } from "@/lib/summit-api";
import { BENEFIT_AREAS, COMPARISON_ROWS, KIND_LABELS, KIND_PLURALS, PRODUCT_STATUS_LOOK, centsToInput, toCents, usd, type AdminProduct, type EditionDetail } from "@/lib/commerce";
import { AreaBox, Feedback, Labeled, TextBox, useRun } from "./ui";

const api = () => browserApi().v1.summit.commerce;
const lines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter(Boolean);
const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// ---- Starting and switching editions ----

export function NewEditionForm({ editions, hasEditions }: { editions: { id: string; name: string }[]; hasEditions: boolean }) {
  const { run, busy, error, notice } = useRun();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [from, setFrom] = useState("standard");
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold text-ink">{hasEditions ? "Start a new edition" : "Start the first edition"}</h2>
      <p className="text-sm text-ink-2">
        {hasEditions
          ? "Copy an earlier edition's prices, benefits and settings, or start again from the standard ADTIS catalogue. Nothing about bookings or registrations is copied."
          : "This sets up ADTIS 2027 with the standard catalogue: the exhibition packages, sponsorship levels, delegate categories and additional opportunities, at the prices in the website instructions. You can change everything afterwards."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextBox id="e-name" label="Name" value={name} onChange={(v) => { setName(v); if (!slug) setSlug(slugOf(v)); }} placeholder="Africa Diaspora Trade & Investment Summit 2027" />
        <TextBox id="e-slug" label="Address" hint="Lower-case letters, numbers and hyphens." value={slug} onChange={setSlug} placeholder="adtis-2027" />
      </div>
      <Labeled label="Start from" htmlFor="e-from">
        <select id="e-from" value={from} onChange={(e) => setFrom(e.target.value)} className={textInput(false)}>
          <option value="standard">The standard ADTIS catalogue</option>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              A copy of {e.name}
            </option>
          ))}
        </select>
      </Labeled>
      <Button loading={busy === "create"} disabled={!name.trim() || !slug.trim()} onClick={() => run("create", () => ok(api().editions.$post({ json: { name: name.trim(), slug: slug.trim(), from: from as never } })), "Edition created.")}>
        Create the edition
      </Button>
      <Feedback error={error} notice={notice} />
    </Card>
  );
}

export function MakeCurrentButton({ id }: { id: string }) {
  const { run, busy, error } = useRun();
  return (
    <span>
      <Button size="sm" variant="secondary" loading={busy === "current"} onClick={() => run("current", () => ok(api().editions[":id"].$patch({ param: { id }, json: { isCurrent: true } })))}>
        Make current
      </Button>
      <Feedback error={error} />
    </span>
  );
}

// ---- The edition's settings ----

interface Method {
  id: string;
  label: string;
  instructions: string;
}

export function EditionForm({ edition, periods }: { edition: EditionDetail; periods: { id: string; name: string }[] }) {
  const { run, busy, error, notice, setError } = useRun();
  const [f, setF] = useState({
    name: edition.name,
    venue: edition.venue,
    datesNote: edition.datesNote,
    days: String(edition.days),
    attendance: edition.expectedAttendance === null ? "" : String(edition.expectedAttendance),
    smes: edition.selectedSmes === null ? "" : String(edition.selectedSmes),
    taxNote: edition.taxNote,
    tax: edition.pricesIncludeTax === null ? "unknown" : edition.pricesIncludeTax ? "included" : "excluded",
    free: String(edition.complimentaryPerSme),
    period: edition.applicationPeriodId ?? "",
    zones: edition.exhibitionZones.join("\n"),
  });
  const [methods, setMethods] = useState<Method[]>(edition.paymentMethods.map((m) => ({ ...m })));
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const int = (text: string): number | null => (text.trim() === "" ? null : Number.isInteger(Number(text)) ? Number(text) : NaN);

  async function save() {
    const days = Number(f.days);
    const attendance = int(f.attendance);
    const smes = int(f.smes);
    const free = Number(f.free);
    if (!Number.isInteger(days) || [attendance, smes].some((n) => Number.isNaN(n)) || !Number.isInteger(free)) return setError("Days, attendance, selected SMEs and free places must be whole numbers.");
    const cleaned = methods.map((m) => ({ id: m.id.trim() || slugOf(m.label), label: m.label.trim(), instructions: m.instructions.trim() }));
    if (cleaned.some((m) => !m.label || !m.instructions)) return setError("Each payment method needs a name and its instructions.");
    await run(
      "save",
      () =>
        ok(
          api().editions[":id"].$patch({
            param: { id: edition.id },
            json: {
              name: f.name.trim(),
              venue: f.venue.trim(),
              datesNote: f.datesNote.trim(),
              days,
              expectedAttendance: attendance,
              selectedSmes: smes,
              taxNote: f.taxNote.trim(),
              pricesIncludeTax: f.tax === "unknown" ? null : f.tax === "included",
              complimentaryPerSme: free,
              applicationPeriodId: f.period || null,
              exhibitionZones: lines(f.zones),
              paymentMethods: cleaned,
            },
          }),
        ),
      "Settings saved.",
    );
  }

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <h2 className="font-display text-xl font-bold text-ink">Edition settings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextBox id="s-name" label="Name" value={f.name} onChange={set("name")} />
        <TextBox id="s-venue" label="Venue" value={f.venue} onChange={set("venue")} />
        <TextBox id="s-dates" label="Dates, as shown on the website" hint="Exact dates are not announced yet, so this is words." value={f.datesNote} onChange={set("datesNote")} />
        <TextBox id="s-days" label="Days" value={f.days} onChange={set("days")} />
        <TextBox id="s-attendance" label="Expected attendance" value={f.attendance} onChange={set("attendance")} />
        <TextBox id="s-smes" label="Selected SMEs" value={f.smes} onChange={set("smes")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Do the prices include taxes?" htmlFor="s-tax" hint="Shown on every price page. Leave it unconfirmed until the team has decided.">
          <select id="s-tax" value={f.tax} onChange={(e) => set("tax")(e.target.value)} className={textInput(false)}>
            <option value="unknown">Not confirmed yet</option>
            <option value="included">Prices include taxes</option>
            <option value="excluded">Prices exclude taxes</option>
          </select>
        </Labeled>
        <AreaBox id="s-taxnote" label="Tax note shown with the prices" value={f.taxNote} onChange={set("taxNote")} rows={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Assessment period for free SME places" htmlFor="s-period" hint="Selected SMEs of this period register free, and get directory profiles.">
          <select id="s-period" value={f.period} onChange={(e) => set("period")(e.target.value)} className={textInput(false)}>
            <option value="">None chosen</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        <TextBox id="s-free" label="Free delegate places per selected SME" value={f.free} onChange={set("free")} />
        <AreaBox id="s-zones" label="Exhibition zones" hint="One per line, such as Hall A. Exhibitors can ask for one, and you give them one." value={f.zones} onChange={set("zones")} rows={3} />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold tracking-wide text-ink-2 uppercase">Payment methods</h3>
          <p className="text-sm text-ink-3">What approved exhibitors, sponsors and delegates are told about how to pay. Until you add one, they are told the team will send instructions.</p>
        </div>
        {methods.map((m, i) => (
          <div key={i} className="space-y-3 rounded-md border border-line p-3">
            <TextBox id={`m-label-${i}`} label="Name" placeholder="Bank transfer" value={m.label} onChange={(v) => setMethods(methods.map((x, j) => (j === i ? { ...x, label: v, id: x.id || slugOf(v) } : x)))} />
            <AreaBox id={`m-ins-${i}`} label="Instructions" hint="Account name, number, bank, reference to quote, or a payment link." value={m.instructions} onChange={(v) => setMethods(methods.map((x, j) => (j === i ? { ...x, instructions: v } : x)))} rows={3} />
            <Button variant="ghost" size="sm" onClick={() => setMethods(methods.filter((_, j) => j !== i))}>
              Remove this method
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setMethods([...methods, { id: "", label: "", instructions: "" }])}>
          Add a payment method
        </Button>
      </div>

      <Feedback error={error} notice={notice} />
      <Button onClick={save} loading={busy === "save"}>
        Save settings
      </Button>
    </Card>
  );
}

// ---- Products ----

export function ProductEditor({ edition, product, onDone }: { edition: EditionDetail; product?: AdminProduct; onDone: () => void }) {
  const { run, busy, error, notice, setError } = useRun();
  const [kind, setKind] = useState(product?.kind ?? "exhibition_package");
  const [f, setF] = useState({
    slug: product?.slug ?? "",
    name: product?.name ?? "",
    summary: product?.summary ?? "",
    price: product ? centsToInput(product.priceCents) : "",
    capacity: product?.capacity === null || product === undefined ? "" : String(product.capacity),
    status: product?.status ?? "draft",
    order: String(product?.sortOrder ?? 0),
    features: (product?.features ?? []).join("\n"),
    soldOut: product?.markedSoldOut ?? false,
  });
  const [benefits, setBenefits] = useState<Record<string, string>>({ ...(product?.benefits ?? {}) });
  const [attrs, setAttrs] = useState<Record<string, string>>({ ...(product?.attributes ?? {}) });
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));

  async function save() {
    const priceCents = toCents(f.price);
    if (priceCents === null) return setError("Type the price in dollars, like 500 or 62.50. Use 0 for complimentary.");
    const capacity = f.capacity.trim() === "" ? null : Number(f.capacity);
    const order = Number(f.order);
    if ((capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) || !Number.isInteger(order)) return setError("The capacity and the order must be whole numbers. Leave the capacity empty for no limit.");
    const cleanBenefits = Object.fromEntries(Object.entries(benefits).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const base = {
      name: f.name.trim(),
      summary: f.summary.trim(),
      priceCents,
      features: lines(f.features),
      capacity,
      status: f.status as never,
      sortOrder: order,
      benefits: cleanBenefits as never,
      attributes: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v.trim()])),
    };
    const done = await run(
      "save",
      () =>
        product
          ? ok(api().products[":id"].$patch({ param: { id: product.id }, json: { ...base, markedSoldOut: f.soldOut } }))
          : ok(api().editions[":id"].products.$post({ param: { id: edition.id }, json: { ...base, kind: kind as never, slug: f.slug.trim() || slugOf(f.name) } })),
      "Saved.",
    );
    if (done && !product) onDone();
  }

  return (
    <Card className="space-y-4 border-2 border-brand-600/30 p-4 sm:p-5">
      <h3 className="font-display text-lg font-bold text-ink">{product ? `Edit ${product.name}` : "Add a product"}</h3>
      {!product && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="What kind is it?" htmlFor="pr-kind">
            <select id="pr-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={textInput(false)}>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Labeled>
          <TextBox id="pr-slug" label="Address" hint="Lower-case letters, numbers and hyphens. Leave empty to use the name." value={f.slug} onChange={set("slug")} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextBox id="pr-name" label="Name" value={f.name} onChange={set("name")} />
        <TextBox id="pr-price" label="Price (USD)" hint="0 is complimentary." value={f.price} onChange={set("price")} />
        <TextBox id="pr-capacity" label="Number available" hint="Booths or passes. Empty means no limit has been set." value={f.capacity} onChange={set("capacity")} />
        <Labeled label="Status" htmlFor="pr-status" hint="Only published products are shown and can be applied for.">
          <select id="pr-status" value={f.status} onChange={(e) => set("status")(e.target.value as typeof f.status)} className={textInput(false)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </Labeled>
        <TextBox id="pr-order" label="Order on the page" hint="Lower numbers come first." value={f.order} onChange={set("order")} />
        {product && (
          <Labeled label="Sold out" htmlFor="pr-sold">
            <label className="flex min-h-12 items-center gap-3 rounded-md border border-line-strong bg-surface px-3 text-base">
              <input id="pr-sold" type="checkbox" checked={f.soldOut} onChange={(e) => set("soldOut")(e.target.checked)} className="size-5" />
              Mark as sold out whatever the number available
            </label>
          </Labeled>
        )}
      </div>
      <AreaBox id="pr-summary" label="Short description" value={f.summary} onChange={set("summary")} rows={2} />
      {(kind === "exhibition_package" || kind === "delegate_category" || kind === "opportunity") && (
        <AreaBox id="pr-features" label={kind === "exhibition_package" ? "What the package includes" : "Benefits"} hint="One per line." value={f.features} onChange={set("features")} rows={6} />
      )}
      {kind === "exhibition_package" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold tracking-wide text-ink-2 uppercase">Side-by-side comparison</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {COMPARISON_ROWS.map(([id, label]) => (
              <TextBox key={id} id={`attr-${id}`} label={label} value={attrs[id] ?? ""} onChange={(v) => setAttrs({ ...attrs, [id]: v })} />
            ))}
          </div>
        </div>
      )}
      {kind === "sponsorship_level" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold tracking-wide text-ink-2 uppercase">Benefits by area</h4>
          <p className="text-sm text-ink-3">Each level has its own text. Leave an area empty if the level does not include it.</p>
          {BENEFIT_AREAS.map(([id, label]) => (
            <AreaBox key={id} id={`benefit-${id}`} label={label} value={benefits[id] ?? ""} onChange={(v) => setBenefits({ ...benefits, [id]: v })} rows={2} />
          ))}
        </div>
      )}
      <Feedback error={error} notice={notice} />
      <div className="flex gap-2">
        <Button onClick={save} loading={busy === "save"}>
          {product ? "Save product" : "Add product"}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Close
        </Button>
      </div>
      {product && <p className="text-xs text-ink-3">A price change applies from now on. Bookings and registrations already made keep the price they were made at.</p>}
    </Card>
  );
}

/** The catalogue: every product of the edition by kind, with a way to change or add one. */
export function Catalogue({ edition, canEdit }: { edition: EditionDetail; canEdit: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const kinds = Object.keys(KIND_LABELS);
  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setEditing(editing === "new" ? null : "new")}>
            Add a product
          </Button>
        </div>
      )}
      {editing === "new" && <ProductEditor edition={edition} onDone={() => setEditing(null)} />}
      {kinds.map((kind) => {
        const items = edition.products.filter((p) => p.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} className="space-y-3">
            <h3 className="font-display text-lg font-bold text-ink">{KIND_PLURALS[kind]}</h3>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-surface-2 text-xs font-bold tracking-wide text-ink-2 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Price</th>
                    <th className="px-3 py-2.5">Available</th>
                    <th className="px-3 py-2.5">Taken</th>
                    <th className="px-3 py-2.5">Status</th>
                    {canEdit && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((p) => (
                    <tr key={p.id} className="align-top">
                      <th scope="row" className="px-3 py-2.5 font-semibold text-ink">
                        {p.name}
                        {p.availability.soldOut && <span className="ml-2 rounded-sm bg-danger-50 px-1.5 py-0.5 text-xs font-semibold text-danger">Sold out</span>}
                      </th>
                      <td className="px-3 py-2.5">{p.priceCents === 0 ? "Complimentary" : usd(p.priceCents)}</td>
                      <td className="px-3 py-2.5">{p.capacity ?? "No limit set"}</td>
                      <td className="px-3 py-2.5">{p.taken}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={PRODUCT_STATUS_LOOK[p.status]?.tone ?? "idle"}>{PRODUCT_STATUS_LOOK[p.status]?.label ?? p.status}</StatusBadge>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-right">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                            {editing === p.id ? "Close" : "Edit"}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.map((p) => (editing === p.id ? <ProductEditor key={p.id} edition={edition} product={p} onDone={() => setEditing(null)} /> : null))}
          </section>
        );
      })}
    </div>
  );
}

