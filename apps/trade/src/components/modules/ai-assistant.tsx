"use client";

import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@entrust/ui";
import { Markdown } from "@/components/markdown";
import { tradeFetch } from "@/lib/trade-client";

const INPUT = "mt-1 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink sm:text-sm";

interface Props {
  moduleId: string;
  promptId: string;
  organizationId: string | undefined;
}

/** Runs one of a module's prompts on the SME's product, market and buyer. Only those three go to the provider. */
export function AiAssistant({ moduleId, promptId, organizationId }: Props) {
  const [product, setProduct] = useState("");
  const [market, setMarket] = useState("");
  const [buyer, setBuyer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await tradeFetch<{ text: string }>("POST", `/modules/${moduleId}/ai-prompts/${promptId}/run`, {
      ...(organizationId ? { organizationId } : {}),
      product: product.trim(),
      market: market.trim(),
      ...(buyer.trim() ? { buyer: buyer.trim() } : {}),
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "The assistant couldn't answer just now. Please try again.");
      return;
    }
    setText(result.data.text);
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div className="space-y-3 rounded-md border border-line p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Sparkles aria-hidden className="size-4 text-brand-600" /> Ask the assistant
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block min-w-0 text-sm font-medium text-ink">
          Your product
          <input value={product} maxLength={200} onChange={(e) => setProduct(e.target.value)} className={INPUT} />
        </label>
        <label className="block min-w-0 text-sm font-medium text-ink">
          Target market
          <input value={market} maxLength={200} onChange={(e) => setMarket(e.target.value)} className={INPUT} />
        </label>
        <label className="block min-w-0 text-sm font-medium text-ink">
          Buyer (optional)
          <input value={buyer} maxLength={200} onChange={(e) => setBuyer(e.target.value)} className={INPUT} />
        </label>
      </div>
      <p className="text-xs text-ink-3">Only these details are sent. Don't include financial figures or anything confidential.</p>
      <Button onClick={() => void ask()} disabled={busy || !product.trim() || !market.trim()}>
        {busy ? "Thinking…" : "Get a suggestion"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {text && (
        <div className="space-y-2 rounded-md bg-canvas p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">AI suggestion. Check the result before you use it.</span>
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              <Copy aria-hidden className="size-3" /> {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="text-sm text-ink">
            <Markdown source={text} />
          </div>
          <p className="text-xs text-ink-3">It only becomes part of your worksheet if you copy it in, and then it counts as self-reported.</p>
        </div>
      )}
    </div>
  );
}
