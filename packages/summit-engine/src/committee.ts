import { YES, NO, effectiveAnswers } from "@entrust/forms";
import type { Answers, Money } from "@entrust/forms";
import type { ApplicationTemplate } from "./application/types";
import type { ScoreResult } from "./scoring";
import type { ApplicationStatus, CategoryId } from "./types";

// What the selection committee compares applicants on (#80). Nothing here reads a database.

/** The statuses the committee works with: from the start of its review to its decision. */
export const COMMITTEE_STATUSES = ["committee_review", "selected", "waitlisted", "not_selected"] as const satisfies readonly ApplicationStatus[];

/**
 * The categories that say how ready an applicant is for the Summit: financial and operational readiness (E) and
 * participation readiness (G). The specification asks for a readiness filter without defining one, so this is the
 * share of those categories' points an applicant earned.
 */
export const READINESS_CATEGORIES: readonly CategoryId[] = ["E", "G"];

/** Readiness as a percentage with one decimal, or null until both categories are scored. */
export function readinessPercent(result: ScoreResult): number | null {
  const categories = result.categories.filter((c) => READINESS_CATEGORIES.includes(c.id) && c.applicable);
  if (categories.length === 0 || categories.some((c) => c.points === undefined)) return null;
  const earned = categories.reduce((sum, c) => sum + (c.points as number), 0);
  const possible = categories.reduce((sum, c) => sum + c.maxPoints, 0);
  return Math.round((earned / possible) * 1000) / 10;
}

/**
 * Each applicant's place when ordered by score, highest first. Applicants with the same score share a place and the
 * next place is skipped (1, 2, 2, 4). An applicant without a score has no place.
 */
export function rankByScore<T extends string>(entries: readonly { id: T; total: number | null }[]): Map<T, number> {
  const scored = entries.filter((e): e is { id: T; total: number } => e.total !== null).sort((a, b) => b.total - a.total);
  const ranks = new Map<T, number>();
  scored.forEach((entry, index) => {
    const before = scored[index - 1];
    ranks.set(entry.id, before && before.total === entry.total ? (ranks.get(before.id) as number) : index + 1);
  });
  return ranks;
}

/** What an application says about the business, for filtering and comparing. Null where it wasn't answered. */
export interface ApplicantProfile {
  sector: string | null;
  womanOwned: boolean | null;
  youthOwned: boolean | null;
  annualRevenue: Money | null;
  employees: number | null;
  commercialAsk: string | null;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const yesNo = (value: unknown): boolean | null => (value === YES ? true : value === NO ? false : null);
const money = (value: unknown): Money | null =>
  typeof value === "object" && value !== null && "amount" in value && "currency" in value ? (value as Money) : null;

/** The answers the committee reads. A question the form hides doesn't count, even if it once held an answer. */
export function applicantProfile(template: ApplicationTemplate, answers: Answers): ApplicantProfile {
  const given = effectiveAnswers(template, answers);
  const { profile } = template.inputs;
  const employees = given[profile.employees];
  return {
    sector: text(given[profile.sector]),
    womanOwned: yesNo(given[profile.womanOwned]),
    youthOwned: yesNo(given[profile.youthOwned]),
    annualRevenue: money(given[profile.revenue]),
    employees: typeof employees === "number" ? employees : null,
    commercialAsk: text(given[profile.commercialAsk]),
  };
}
