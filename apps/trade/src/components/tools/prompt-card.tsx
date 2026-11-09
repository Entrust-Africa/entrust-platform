"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";

export function PromptCard({ title, prompt, verification }: { title: string; prompt: string; verification: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy prompt"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap break-words rounded-md bg-canvas p-3 text-sm text-ink">{prompt}</p>
      {verification.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-3">Before you use the answer</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {verification.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
