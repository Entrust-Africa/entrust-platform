"use client";

import { useRouter } from "next/navigation";
import type { FormDefinition } from "@entrust/forms";
import { FormRunner, type AnswerPatch } from "@/components/form-runner";
import { tradeFetch } from "@/lib/trade-client";
import { KINDS, diagnosticAllowsNotKnown, type AssessmentKind } from "./kinds";

/** Fills in a draft diagnostic or placement assessment: saves through the API as the person goes, and submits. */
export function AssessmentRunner({
  assessmentId,
  kind,
  definition,
  answers,
  variables,
  documents,
}: {
  assessmentId: string;
  kind: AssessmentKind;
  definition: FormDefinition;
  answers: Record<string, unknown>;
  variables: Record<string, string>;
  documents: Record<string, boolean>;
}) {
  const router = useRouter();

  async function save(patch: AnswerPatch) {
    const result = await tradeFetch("PUT", `/assessments/${assessmentId}/responses`, { answers: patch });
    if (!result.ok) throw new Error(result.error ?? "Couldn't save your answers.");
  }

  async function setDocuments(questionId: string, available: boolean) {
    const result = await tradeFetch("PUT", `/assessments/${assessmentId}/responses`, { documents: { [questionId]: available } });
    if (!result.ok) throw new Error(result.error ?? "Couldn't save that.");
  }

  async function submit() {
    const result = await tradeFetch("POST", `/assessments/${assessmentId}/submit`);
    if (!result.ok) throw new Error(result.error ?? "Couldn't submit. Try again.");
    // The page now shows the result instead of the form.
    router.refresh();
  }

  return (
    <FormRunner
      key={assessmentId}
      definition={definition}
      answers={answers as never}
      onSave={save}
      onSubmit={submit}
      variables={variables}
      documents={documents}
      onDocumentsChange={setDocuments}
      submit={KINDS[kind].submit}
      // A placement question can be "I don't know" or "does not apply"; only the capability questions have that choice.
      {...(kind === "placement" ? { allowNotKnown: (q) => q.allowNotApplicable === true } : { allowNotKnown: diagnosticAllowsNotKnown, wide: true })}
    />
  );
}
