"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@entrust/ui";
import { textInput } from "@/components/form-runner/styles";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import { when, type DelegateDetail } from "@/lib/commerce";
import { Feedback } from "./ui";

/**
 * The desk at the door. A QR scanner types what the code holds into the box and presses Enter, like a keyboard; a person can
 * type the DEL- reference instead. The result is large and says plainly whether to let the person in.
 */
export function CheckInDesk() {
  const [code, setCode] = useState("");
  const [delegate, setDelegate] = useState<DelegateDetail | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState<"find" | "checkin" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function find() {
    if (!code.trim()) return;
    setBusy("find");
    setError(undefined);
    setDone(undefined);
    setDelegate(null);
    try {
      setDelegate(await ok(browserApi().v1.summit.commerce["check-in"].lookup.$get({ query: { code: code.trim() } })));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function checkIn() {
    if (!delegate) return;
    setBusy("checkin");
    setError(undefined);
    try {
      const next = await ok(browserApi().v1.summit.commerce.delegates[":id"]["check-in"].$post({ param: { id: delegate.id } }));
      setDelegate(next);
      setDone(`${next.fullName} is checked in.`);
      setCode("");
      input.current?.focus();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const state = delegate?.badge.state;
  return (
    <div className="space-y-5">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void find();
        }}
      >
        <label htmlFor="scan" className="sr-only">
          Scan a badge or type its reference
        </label>
        <input
          id="scan"
          ref={input}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Scan the QR code, or type DEL-00042"
          autoComplete="off"
          className={textInput(false)}
        />
        <Button type="submit" size="lg" loading={busy === "find"}>
          Find
        </Button>
      </form>
      <Feedback error={error} notice={done} />
      {delegate && (
        <Card className={`space-y-4 border-2 p-5 ${state === "valid" ? "border-ok" : state === "already_checked_in" ? "border-info" : "border-danger"}`}>
          <p className={`text-sm font-bold tracking-wide uppercase ${state === "valid" ? "text-ok" : state === "already_checked_in" ? "text-info" : "text-danger"}`}>
            {state === "valid" ? "Valid badge" : state === "already_checked_in" ? "Already checked in" : "Do not admit yet"}
          </p>
          <div>
            <p className="font-display text-3xl font-bold text-ink">{delegate.fullName}</p>
            <p className="text-lg text-ink-2">
              {delegate.organisation} · {delegate.country}
            </p>
            <p className="text-base text-ink-2">
              {delegate.categoryName} · {delegate.number}
            </p>
          </div>
          {state === "not_valid" && <p className="text-base font-semibold text-danger">{delegate.badge.problems.join(" ")}</p>}
          {state === "already_checked_in" && delegate.checkedInAt && <p className="text-base text-ink-2">Arrived {when(delegate.checkedInAt)}.</p>}
          <div className="flex flex-wrap gap-2">
            {state === "valid" && (
              <Button size="lg" onClick={checkIn} loading={busy === "checkin"}>
                Check in
              </Button>
            )}
            <Link href={`/summit/commerce/delegates/${delegate.id}`} className="inline-flex h-12 items-center rounded-md border border-line-strong px-5 text-base font-semibold text-ink hover:bg-surface-2">
              Open registration
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
