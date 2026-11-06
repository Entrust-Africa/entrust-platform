"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormDefinition } from "@entrust/forms";
import { FormRunner, type AnswerPatch } from "@/components/form-runner";
import { KINDS } from "@/components/assessment/kinds";
import { tradeFetch } from "@/lib/trade-client";

const REMEMBERED = "entrust-onboarding-token";

/** Fills in a public diagnostic: saves through the API by the draft's private token as the person goes, and submits. */
export function PublicDiagnosticRunner({
  token,
  definition,
  answers,
  variables,
}: {
  token: string;
  definition: FormDefinition;
  answers: Record<string, unknown>;
  variables: Record<string, string>;
}) {
  const router = useRouter();

  // Remember the draft in this browser, so the start page can offer to carry on.
  useEffect(() => {
    localStorage.setItem(REMEMBERED, token);
  }, [token]);

  async function save(patch: AnswerPatch) {
    const result = await tradeFetch("PUT", `/public/diagnostic/${token}/responses`, { answers: patch });
    if (!result.ok) throw new Error(result.error ?? "Couldn't save your answers.");
  }

  async function submit() {
    const result = await tradeFetch("POST", `/public/diagnostic/${token}/submit`);
    if (!result.ok) throw new Error(result.error ?? "Couldn't submit. Try again.");
    // The draft is done, so the start page has nothing to carry on.
    localStorage.removeItem(REMEMBERED);
    router.refresh();
  }

  return (
    <FormRunner
      key={token}
      definition={definition}
      answers={answers as never}
      onSave={save}
      onSubmit={submit}
      variables={variables}
      submit={{
        ...KINDS.diagnostic.submit,
        confirmBody: "You won't be able to change your answers after this. You will see which learning path you start on, and we will email you to say we have it.",
      }}
    />
  );
}
