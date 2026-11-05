"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { Button, Card } from "@entrust/ui";
import { textArea } from "@/components/form-runner/styles";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import { formatDateTime, type SummitClarification } from "@/lib/summit";

/** A request from Entrust for more information, with a box to answer it while it is open. */
export function ClarificationPanel({ applicationId, clarification }: { applicationId: string; clarification: SummitClarification }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    setPending(true);
    setError(undefined);
    try {
      await ok(
        browserApi().v1.summit.applications[":id"].clarifications[":clarificationId"].respond.$post({
          param: { id: applicationId, clarificationId: clarification.id },
          json: { response: response.trim() },
        }),
      );
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={clarification.open ? "border-warn/40" : undefined}>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm text-ink-3">From Entrust, {formatDateTime(clarification.requestedAt)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-base text-ink">{clarification.message}</p>
          </div>
        </div>

        {clarification.response !== null && (
          <div className="rounded-md bg-surface-2 p-3">
            <p className="text-sm text-ink-3">Your answer{clarification.respondedAt ? `, ${formatDateTime(clarification.respondedAt)}` : ""}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-base text-ink">{clarification.response}</p>
          </div>
        )}

        {clarification.open && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label htmlFor={`reply-${clarification.id}`} className="block text-base font-semibold text-ink">
              Your answer
            </label>
            <textarea
              id={`reply-${clarification.id}`}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              required
              maxLength={4000}
              rows={5}
              className={textArea(Boolean(error))}
            />
            <p className="text-sm text-ink-3">You can also add documents below if we asked for them.</p>
            {error && (
              <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending} disabled={response.trim() === ""}>
              Send my answer
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
