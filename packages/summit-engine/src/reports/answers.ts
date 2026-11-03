import { NO, YES, effectiveAnswers, isNotKnown } from "@entrust/forms";
import type { Answer, Answers, FormQuestion } from "@entrust/forms";
import type { ApplicationTemplate, ReportInputs } from "../application/types";

/**
 * What a report can ask of an application: the questions of `ReportInputs`, and the ones eligibility and the
 * committee already name. A version of the form that doesn't ask one leaves the answer empty.
 */
export type ReportQuestion = keyof ReportInputs | "registration" | "operating" | "sector" | "commercialAsk" | "revenue" | "seekingInvestment";

/** An application's answers as the reports read them. A question the form hides doesn't count, even if it once held an answer. */
export interface ReportAnswers {
  /** The answer in words: an option's label, Yes or No, or a figure with its currency. Null when there is none. */
  text(name: ReportQuestion): string | null;
  /** The labels of a multiple choice, or the entries of a list. */
  list(name: ReportQuestion): string[];
  /** The values of the options a multiple choice picked. */
  picked(name: ReportQuestion): string[];
  yesNo(name: ReportQuestion): boolean | null;
  amount(name: ReportQuestion): number | null;
  currency(name: ReportQuestion): string | null;
}

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** A figure with its currency, such as "USD 250,000". */
export const formatMoney = (amount: number, currency: string): string => `${currency} ${NUMBER.format(amount)}`;

const isMoney = (answer: Answer): answer is { amount: number; currency: string } =>
  typeof answer === "object" && answer !== null && !Array.isArray(answer) && "amount" in answer && "currency" in answer;

export function reportAnswers(template: ApplicationTemplate, answers: Answers): ReportAnswers {
  const given = effectiveAnswers(template, answers);
  const { inputs } = template;
  const ids: Partial<Record<ReportQuestion, string>> = {
    ...inputs.report,
    registration: inputs.registration.question,
    operating: inputs.operating.question,
    sector: inputs.profile.sector,
    commercialAsk: inputs.profile.commercialAsk,
    revenue: inputs.profile.revenue,
    seekingInvestment: inputs.seekingInvestment,
  };
  const questions = new Map<string, FormQuestion>(template.questions.map((q) => [q.id, q]));

  const find = (name: ReportQuestion): { question: FormQuestion | undefined; answer: Answer | undefined } => {
    const id = ids[name];
    const answer = id === undefined ? undefined : given[id];
    return { question: id === undefined ? undefined : questions.get(id), answer: answer === undefined || isNotKnown(answer) ? undefined : answer };
  };
  const labelOf = (question: FormQuestion | undefined, value: string): string => question?.options?.find((o) => o.value === value)?.label ?? value;
  const entries = (name: ReportQuestion): string[] => {
    const { question, answer } = find(name);
    if (Array.isArray(answer)) return answer.map((v) => (question?.type === "multiple_choice" ? labelOf(question, v) : v).trim()).filter(Boolean);
    return typeof answer === "string" && answer.trim() ? [question?.type === "single_choice" ? labelOf(question, answer) : answer.trim()] : [];
  };

  return {
    text(name) {
      const { question, answer } = find(name);
      if (answer === undefined) return null;
      if (typeof answer === "number") return String(answer);
      if (isMoney(answer)) return formatMoney(answer.amount, answer.currency);
      if (Array.isArray(answer)) return entries(name).join("; ") || null;
      if (typeof answer !== "string") return null;
      if (question?.type === "yes_no") return answer === YES ? "Yes" : answer === NO ? "No" : null;
      if (question?.type === "single_choice") return labelOf(question, answer);
      return answer.trim() || null;
    },
    list: entries,
    picked(name) {
      const { answer } = find(name);
      return Array.isArray(answer) ? [...answer] : [];
    },
    yesNo(name) {
      const { answer } = find(name);
      return answer === YES ? true : answer === NO ? false : null;
    },
    amount(name) {
      const { answer } = find(name);
      return answer !== undefined && isMoney(answer) ? answer.amount : null;
    },
    currency(name) {
      const { answer } = find(name);
      return answer !== undefined && isMoney(answer) ? answer.currency : null;
    },
  };
}
