import type { ReactNode } from "react";
import type { Answer, Answers, FormDefinition, FormQuestion, FormSection } from "@entrust/forms";

/** Answers to add or change, by question ID. A null clears one. */
export type AnswerPatch = Record<string, Answer | null>;

/**
 * FormRunner shows one section of a form at a time, with progress, a review page and autosave. It knows nothing
 * about the Summit: give it any `FormDefinition` from `@entrust/forms`.
 *
 * Props:
 * - `definition`: the form to show. Its `showIf` conditions are worked out in the browser, so a question appears or
 *   disappears the moment an answer changes.
 * - `answers`: the answers saved so far. The runner copies them once and keeps its own copy as the person types, so
 *   give the component a `key` when you want it to start over (for example the ID of the thing being answered).
 * - `onSave(patch)`: called a moment after the person stops typing, with only the answers that changed and are valid
 *   (a null clears an answer). Reject to show "Couldn't save"; the runner keeps the patch and offers a retry.
 * - `onSubmit`: when given, the review page offers a send button. It is called after every change is saved and the
 *   person has confirmed. Reject with an Error to show its message. When it resolves, the caller moves on.
 * - `readOnly`: show the answers, change nothing, never save or offer to send.
 * - `renderAttachments(section)`: extra content after a section's questions, such as file uploads. Return null for a
 *   section that has none. A section with no shown questions still appears if this returns something.
 *
 * Optional: `allowNotKnown` (which questions offer "I don't know"; default every question except a "must be yes"
 * one), `variables` (values for {names} in question text), `initialSectionId` and `onSectionChange` (so a page can
 * keep the section in its address), `reviewTop` (content above the review list), `submit` (the words on the send
 * button and its confirmation) and `today` (YYYY-MM-DD, for dates that can't be in the future).
 */
export interface FormRunnerProps {
  definition: FormDefinition;
  answers: Answers;
  onSave: (patch: AnswerPatch) => Promise<void>;
  onSubmit?: () => Promise<void>;
  readOnly?: boolean;
  renderAttachments?: (section: FormSection) => ReactNode;

  allowNotKnown?: (question: FormQuestion) => boolean;
  /**
   * For a question with `evidenceBased` set: whether the person says documents are available, by question ID, and how
   * to tell the server when they change it. Without `onDocumentsChange` no such control is shown.
   */
  documents?: Readonly<Record<string, boolean>>;
  onDocumentsChange?: (questionId: string, available: boolean) => Promise<void>;
  variables?: Readonly<Record<string, string>>;
  initialSectionId?: string;
  onSectionChange?: (step: string) => void;
  reviewTop?: ReactNode;
  submit?: SubmitCopy;
  today?: string;
}

export interface SubmitCopy {
  button: string;
  confirmTitle: string;
  confirmBody: string;
  confirmButton: string;
}

export const REVIEW_STEP = "review";
