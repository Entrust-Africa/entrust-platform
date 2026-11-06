"use client";

import { Button } from "@entrust/ui";

/** Opens the browser's print dialog. The report's own print styles hide the menus and keep each block on one page. */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
