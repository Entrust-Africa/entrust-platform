"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-12 items-center bg-amber px-6 text-sm font-semibold text-ink hover:brightness-110">
      Print or save as PDF
    </button>
  );
}
