"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";
import { textInput } from "@/components/form-runner/styles";
import { browserApi, ok } from "@/lib/summit-api";
import { PROFILE_LOOK, when, type ProfileDetail } from "@/lib/commerce";
import { AreaBox, Feedback, Labeled, Pill, TextBox, useRun } from "./ui";

const lines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter(Boolean);
const orNull = (text: string): string | null => text.trim() || null;

/**
 * A directory profile as staff edit it. Everything here is what the public will read, and nothing else is on the public page.
 * The business's approval is recorded here; changing the text clears it, unless the change is a small correction.
 */
export function ProfileEditor({ profile }: { profile: ProfileDetail }) {
  const { run, busy, error, notice } = useRun();
  const [f, setF] = useState({
    displayName: profile.displayName,
    country: profile.country,
    city: profile.city ?? "",
    sector: profile.sector,
    summary: profile.summary,
    products: profile.productsServices.join("\n"),
    capacity: profile.productionCapacity ?? "",
    readiness: profile.exportReadiness ?? "",
    markets: profile.targetMarkets.join("\n"),
    seeksInvestment: profile.seeksInvestment,
    investment: profile.investmentRequirements ?? "",
    verification: profile.verification,
    website: profile.website ?? "",
    contactName: profile.contactName ?? "",
    contactPosition: profile.contactPosition ?? "",
    contactEmail: profile.contactEmail ?? "",
    contactPhone: profile.contactPhone ?? "",
  });
  const [approvalNote, setApprovalNote] = useState(profile.approvalNote ?? "");
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const api = browserApi().v1.summit.commerce.directory.profiles[":id"];
  const param = { id: profile.id };
  const published = profile.status === "published";
  const approved = profile.businessApprovedAt !== null;

  const content = () => ({
    displayName: f.displayName.trim(),
    country: f.country.trim().toUpperCase(),
    city: orNull(f.city),
    sector: f.sector.trim(),
    summary: f.summary.trim(),
    productsServices: lines(f.products),
    productionCapacity: orNull(f.capacity),
    exportReadiness: orNull(f.readiness),
    targetMarkets: lines(f.markets),
    seeksInvestment: f.seeksInvestment,
    investmentRequirements: orNull(f.investment),
    verification: f.verification,
    website: orNull(f.website),
    contactName: orNull(f.contactName),
    contactPosition: orNull(f.contactPosition),
    contactEmail: orNull(f.contactEmail),
    contactPhone: orNull(f.contactPhone),
  });

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-ink">What the public will read</h2>
          <Pill look={PROFILE_LOOK[profile.status]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextBox id="p-name" label="Business name" value={f.displayName} onChange={set("displayName")} />
          <TextBox id="p-country" label="Country (two-letter code)" value={f.country} onChange={set("country")} />
          <TextBox id="p-city" label="City or region" value={f.city} onChange={set("city")} />
          <TextBox id="p-sector" label="Industry" value={f.sector} onChange={set("sector")} />
        </div>
        <AreaBox id="p-summary" label="About the business" hint="At least 20 characters. This is shown in full on its page." value={f.summary} onChange={set("summary")} rows={5} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AreaBox id="p-products" label="Products and services" hint="One per line." value={f.products} onChange={set("products")} rows={4} />
          <AreaBox id="p-markets" label="Target export markets" hint="One per line." value={f.markets} onChange={set("markets")} rows={4} />
          <TextBox id="p-capacity" label="Production capacity" value={f.capacity} onChange={set("capacity")} />
          <TextBox id="p-readiness" label="Export readiness" value={f.readiness} onChange={set("readiness")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Seeking investment?" htmlFor="p-invest">
            <label className="flex min-h-12 items-center gap-3 rounded-md border border-line-strong bg-surface px-3 text-base">
              <input id="p-invest" type="checkbox" checked={f.seeksInvestment} onChange={(e) => set("seeksInvestment")(e.target.checked)} className="size-5" />
              The business is looking for investment
            </label>
          </Labeled>
          <TextBox id="p-investment" label="Investment requirements" hint="Shown when the business seeks investment." value={f.investment} onChange={set("investment")} />
          <Labeled label="Verification shown on the page" htmlFor="p-verification">
            <select id="p-verification" value={f.verification} onChange={(e) => set("verification")(e.target.value as typeof f.verification)} className={textInput(false)}>
              <option value="pending">Verification in progress</option>
              <option value="verified">Business registration verified</option>
            </select>
          </Labeled>
          <TextBox id="p-website" label="Website" hint="Starts with https://" value={f.website} onChange={set("website")} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold tracking-wide text-ink-2 uppercase">Contact shown on the page</h3>
          <p className="text-sm text-ink-3">Leave the email and telephone empty to keep them private: visitors then reach the business through the B2B enquiry form.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextBox id="p-cname" label="Contact name" value={f.contactName} onChange={set("contactName")} />
            <TextBox id="p-cposition" label="Position" value={f.contactPosition} onChange={set("contactPosition")} />
            <TextBox id="p-cemail" label="Public email" type="email" value={f.contactEmail} onChange={set("contactEmail")} />
            <TextBox id="p-cphone" label="Public telephone" value={f.contactPhone} onChange={set("contactPhone")} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("save", () => ok(api.$patch({ param, json: content() })), approved || published ? "Saved. The business's approval was cleared and the profile is a draft again." : "Saved.")} loading={busy === "save"}>
            Save changes
          </Button>
          {(approved || published) && (
            <Button variant="secondary" onClick={() => run("minor", () => ok(api.$patch({ param, json: { ...content(), minorCorrection: true } })), "Saved as a small correction. The approval stands.")} loading={busy === "minor"}>
              Save as a small correction
            </Button>
          )}
        </div>
        {(approved || published) && <p className="text-xs text-ink-3">Changing the text clears the business's approval and takes the profile off the site, because they approved a different text. A small correction (a typo) keeps both.</p>}
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-display text-xl font-bold text-ink">Approval and publishing</h2>
        {profile.problems.length > 0 && (
          <div className="rounded-md bg-warn-50 px-3 py-2 text-sm text-warn">
            <p className="font-semibold">Still needed before it can be approved and published:</p>
            <ul className="mt-1 list-disc pl-5">
              {profile.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {approved ? (
          <p className="text-sm text-ok">
            The business approved this profile{profile.businessApprovedBy ? ` (recorded by ${profile.businessApprovedBy.name}, ${when(profile.businessApprovedAt)})` : ""}.
            {profile.approvalNote ? ` ${profile.approvalNote}` : ""}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Show the business the profile as it will appear. When they agree, record how they approved it.</p>
            <TextBox id="p-approval" label="How the business approved it" hint="For example: approved by Amina Bekele by email on 12 January." value={approvalNote} onChange={setApprovalNote} />
            <Button variant="secondary" disabled={profile.problems.length > 0} loading={busy === "approve"} onClick={() => run("approve", () => ok(api.$patch({ param, json: { businessApproved: true, ...(approvalNote.trim() ? { approvalNote: approvalNote.trim() } : {}) } })), "Approval recorded.")}>
              Record the business's approval
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {published ? (
            <Button variant="secondary" loading={busy === "unpublish"} onClick={() => run("unpublish", () => ok(api.unpublish.$post({ param })), "Taken off the site.")}>
              Take off the site
            </Button>
          ) : (
            <Button disabled={!approved || profile.problems.length > 0} loading={busy === "publish"} onClick={() => run("publish", () => ok(api.publish.$post({ param })), "Published.")}>
              Publish on the site
            </Button>
          )}
          {approved && !published && (
            <Button variant="ghost" loading={busy === "withdraw"} onClick={() => run("withdraw", () => ok(api.$patch({ param, json: { businessApproved: false } })), "Approval withdrawn.")}>
              Withdraw the approval
            </Button>
          )}
        </div>
        <p className="text-sm text-ink-2">
          Public address:{" "}
          <span className="font-semibold break-all text-ink">{profile.url}</span>
        </p>
      </Card>
      <Feedback error={error} notice={notice} />
    </div>
  );
}
