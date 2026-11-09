import { describe, expect, it } from "vitest";
import { ACTION_MILESTONES, ACTION_REVIEW_QUESTIONS, isActionOverdue, milestoneForDueDate, milestoneProgress } from "../src/action-plan";

describe("the 90-day action plan", () => {
  const today = "2026-12-01";

  it("flags a late action unless it's closed", () => {
    expect(isActionOverdue({ status: "in_progress", dueDate: "2026-11-30" }, today)).toBe(true);
    expect(isActionOverdue({ status: "blocked", dueDate: "2026-11-30" }, today)).toBe(true);
    expect(isActionOverdue({ status: "in_progress", dueDate: "2026-12-01" }, today)).toBe(false);
    expect(isActionOverdue({ status: "in_progress", dueDate: null }, today)).toBe(false);
    for (const status of ["completed", "closed_without_completion", "cancelled"]) {
      expect(isActionOverdue({ status, dueDate: "2026-11-30" }, today), status).toBe(false);
    }
  });

  it("shows progress for each milestone, leaving cancelled actions out", () => {
    const items = [
      { milestone: 30, status: "completed", dueDate: "2026-11-20" },
      { milestone: 30, status: "in_progress", dueDate: "2026-11-20" },
      { milestone: 30, status: "cancelled", dueDate: "2026-11-20" },
      { milestone: 60, status: "not_started", dueDate: "2027-01-10" },
    ];
    expect(milestoneProgress(items, today)).toEqual([
      { day: 30, total: 2, completed: 1, overdue: 1 },
      { day: 60, total: 1, completed: 0, overdue: 0 },
      { day: 90, total: 0, completed: 0, overdue: 0 },
    ]);
  });

  it("places a due date in its milestone", () => {
    expect(milestoneForDueDate("2026-12-31", today)).toBe(30);
    expect(milestoneForDueDate("2027-01-01", today)).toBe(60);
    expect(milestoneForDueDate("2027-01-30", today)).toBe(60);
    expect(milestoneForDueDate("2027-01-31", today)).toBe(90);
    expect(milestoneForDueDate(null, today)).toBe(90);
  });

  it("asks M12's questions at each review", () => {
    for (const day of ACTION_MILESTONES) expect(ACTION_REVIEW_QUESTIONS[day].length).toBeGreaterThan(0);
    expect(ACTION_REVIEW_QUESTIONS[90].at(-1)?.text).toBe("What should the next 90-day plan address?");
  });
});
