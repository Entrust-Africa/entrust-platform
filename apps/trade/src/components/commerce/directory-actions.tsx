"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import { Feedback, TextBox, useRun } from "./ui";

/** Makes draft profiles for the selected SMEs that have none. */
export function PrefillButton({ missing }: { missing: number }) {
  const { run, busy, error, notice } = useRun();
  return (
    <div className="space-y-2">
      <Button
        onClick={() =>
          run(
            "prefill",
            async () => {
              const r = await ok(browserApi().v1.summit.commerce.directory.profiles.prefill.$post({ json: {} }));
              if (r.created === 0) throw new Error("There were no selected SMEs without a profile.");
              return r;
            },
            "Drafts made.",
          )
        }
        loading={busy === "prefill"}
      >
        {missing > 0 ? `Make drafts for ${missing} selected SME${missing === 1 ? "" : "s"}` : "Check for selected SMEs without a profile"}
      </Button>
      <Feedback error={error} notice={notice} />
    </div>
  );
}

/** Marks a B2B enquiry as followed up, with a note of what was done. */
export function HandledButton({ id }: { id: string }) {
  const { run, busy, error } = useRun();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Mark followed up
      </Button>
    );
  }
  return (
    <div className="w-64 space-y-2">
      <TextBox id={`h-${id}`} label="What was done" value={note} onChange={setNote} />
      <Button size="sm" loading={busy === "handled"} onClick={() => run("handled", () => ok(browserApi().v1.summit.commerce.directory.enquiries[":id"].handled.$post({ param: { id }, json: note.trim() ? { note: note.trim() } : {} })))}>
        Save
      </Button>
      <Feedback error={error} />
    </div>
  );
}
