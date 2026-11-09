// The 90-day action plan an SME works from after M12 (FR-11). It outlives the training: a business keeps tracking it after its
// certificate is issued, so it belongs to the organisation rather than to an enrolment.

export const ACTION_STATUSES = ["not_started", "in_progress", "completed", "delayed", "blocked", "revised", "closed_without_completion", "cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ["high", "medium", "low"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_MILESTONES = [30, 60, 90] as const;
export type ActionMilestone = (typeof ACTION_MILESTONES)[number];

/** An action in one of these is finished with, so it can't be late. */
const CLOSED: readonly ActionStatus[] = ["completed", "closed_without_completion", "cancelled"];

export function isActionOverdue(item: { status: string; dueDate: string | null }, today: string): boolean {
  return item.dueDate !== null && item.dueDate < today && !CLOSED.includes(item.status as ActionStatus);
}

export interface MilestoneProgress {
  day: ActionMilestone;
  total: number;
  completed: number;
  overdue: number;
}

export function milestoneProgress(items: readonly { milestone: number; status: string; dueDate: string | null }[], today: string): MilestoneProgress[] {
  return ACTION_MILESTONES.map((day) => {
    const here = items.filter((i) => i.milestone === day && i.status !== "cancelled");
    return {
      day,
      total: here.length,
      completed: here.filter((i) => i.status === "completed").length,
      overdue: here.filter((i) => isActionOverdue(i, today)).length,
    };
  });
}

/** Which milestone a due date falls in, counted from the day the plan was brought in. */
export function milestoneForDueDate(dueDate: string | null, from: string): ActionMilestone {
  if (!dueDate) return 90;
  const days = (Date.parse(dueDate) - Date.parse(from)) / 86_400_000;
  return days <= 30 ? 30 : days <= 60 ? 60 : 90;
}

/** M12's follow-up questions for each review. */
export const ACTION_REVIEW_QUESTIONS: Readonly<Record<ActionMilestone, readonly { id: string; text: string }[]>> = {
  30: [
    { id: "owners", text: "Have action owners been assigned?" },
    { id: "started", text: "Which actions have started?" },
    { id: "completed", text: "Which actions have been completed?" },
    { id: "delays", text: "Are there any delays?" },
    { id: "resources", text: "Are the required resources available?" },
    { id: "adjust", text: "Does the plan need adjustment?" },
  ],
  60: [
    { id: "milestones", text: "Which milestones have been achieved?" },
    { id: "changes", text: "What measurable changes have occurred?" },
    { id: "opportunities", text: "Are buyer or transaction opportunities progressing?" },
    { id: "gaps", text: "Have financial, production or operational gaps improved?" },
    { id: "obstacles", text: "What obstacles require management attention?" },
    { id: "partners", text: "Are external partners or service providers needed?" },
  ],
  90: [
    { id: "completed", text: "Which actions were completed?" },
    { id: "outcomes", text: "Which commercial outcomes were achieved?" },
    { id: "unresolved", text: "What remains unresolved?" },
    { id: "readiness", text: "What changed in the SME's business readiness?" },
    { id: "opportunities", text: "What new opportunities have emerged?" },
    { id: "next", text: "What should the next 90-day plan address?" },
  ],
};
