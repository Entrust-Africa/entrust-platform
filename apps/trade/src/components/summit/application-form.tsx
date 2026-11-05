"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import type { FormSection } from "@entrust/forms";
import { FormRunner, type AnswerPatch, type SubmitCopy } from "@/components/form-runner";
import { browserApi, ok } from "@/lib/summit-api";
import { DOCUMENT_LABELS, asDefinition, type SummitApplication, type SummitFormView } from "@/lib/summit";
import { DocumentsPanel } from "./documents-panel";

const SUBMIT: SubmitCopy = {
  button: "Send my application",
  confirmTitle: "Send your application?",
  confirmBody:
    "We will check it against the requirements straight away. After you send it you cannot change your answers, unless we ask you for more. Is everything right?",
  confirmButton: "Yes, send it",
};

/** The section that holds the document uploads. */
const isDocumentsSection = (section: FormSection) => section.id === "S8" || /supporting documents/i.test(section.title);

export interface ApplicationFormProps {
  initial: SummitApplication;
  form: SummitFormView;
  initialSection: string | undefined;
}

/** The Summit application as a form: the shared runner, wired to the Summit's answers, documents and submit. */
export function ApplicationForm({ initial, form, initialSection }: ApplicationFormProps) {
  const router = useRouter();
  const [application, setApplication] = useState(initial);
  const definition = useMemo(() => asDefinition(form), [form]);
  const id = initial.id;

  async function save(patch: AnswerPatch) {
    const next = await ok(browserApi().v1.summit.applications[":id"].answers.$patch({ param: { id }, json: { answers: patch as never } }));
    setApplication(next);
  }

  async function submit() {
    await ok(browserApi().v1.summit.applications[":id"].submit.$post({ param: { id } }));
    router.push(`/summit/applications/${id}?submitted=1`);
  }

  const readOnly = !application.editable;
  const documentsStep = definition.sections.find(isDocumentsSection);
  const missing = application.requiredDocuments.filter((kind) => !application.documents.some((d) => d.kind === kind));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/summit/applications/${id}`}
          className="inline-flex h-11 items-center gap-2 rounded-md pr-2 text-base font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to your application
        </Link>
        <p className="font-mono text-sm text-ink-3">{application.number}</p>
      </div>

      {readOnly && (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2" role="status">
          <Lock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>You can't change your answers now. You can still read them here.</p>
        </div>
      )}

      <FormRunner
        key={id}
        definition={definition}
        answers={initial.answers as never}
        onSave={save}
        onSubmit={application.editable ? submit : undefined}
        readOnly={readOnly}
        initialSectionId={initialSection}
        onSectionChange={(step) => window.history.replaceState(null, "", `?section=${encodeURIComponent(step)}`)}
        renderAttachments={(section) =>
          isDocumentsSection(section) ? <DocumentsPanel application={application} onChange={setApplication} /> : null
        }
        reviewTop={
          documentsStep && application.requiredDocuments.length > 0 && missing.length > 0 ? (
            <div className="rounded-lg border border-warn/30 bg-warn-50 p-4 text-base text-ink" role="status">
              <p className="font-semibold">Some documents are still missing.</p>
              <p className="mt-1">
                You can send your application without them, but we will ask you to add them first: {missing.map((k) => DOCUMENT_LABELS[k].toLowerCase()).join(", ")}. Add them in the step called "
                {documentsStep.title}".
              </p>
            </div>
          ) : null
        }
        submit={SUBMIT}
      />
    </div>
  );
}
