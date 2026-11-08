import { describe, expect, it } from "vitest";
import {
  checkModuleCompletionCriteria,
  checkProgramCompletion,
  generateCertificateCode,
} from "../src/completion";

describe("completion engine", () => {
  describe("checkModuleCompletionCriteria", () => {
    it("returns complete when admin override is present", () => {
      const res = checkModuleCompletionCriteria({
        lessonsCount: 5,
        completedLessonsCount: 1,
        knowledgeCheckPassed: false,
        practicalDeliverablePassed: false,
        isExempt: false,
        isM01: false,
        planAcknowledged: false,
        adminOverride: true,
      });
      expect(res.complete).toBe(true);
      expect(res.missingCriteria).toHaveLength(0);
    });

    it("returns complete when module is exempted", () => {
      const res = checkModuleCompletionCriteria({
        lessonsCount: 5,
        completedLessonsCount: 0,
        knowledgeCheckPassed: false,
        practicalDeliverablePassed: false,
        isExempt: true,
        isM01: false,
        planAcknowledged: false,
      });
      expect(res.complete).toBe(true);
      expect(res.missingCriteria).toHaveLength(0);
    });

    it("requires all lessons, knowledge check, and deliverable for standard module", () => {
      const partial = checkModuleCompletionCriteria({
        lessonsCount: 4,
        completedLessonsCount: 3,
        knowledgeCheckPassed: true,
        practicalDeliverablePassed: false,
        isExempt: false,
        isM01: false,
        planAcknowledged: false,
      });
      expect(partial.complete).toBe(false);
      expect(partial.missingCriteria).toContain("Lessons: 3 of 4 completed");
      expect(partial.missingCriteria).toContain("Practical deliverable not passed by assessor");

      const allDone = checkModuleCompletionCriteria({
        lessonsCount: 4,
        completedLessonsCount: 4,
        knowledgeCheckPassed: true,
        practicalDeliverablePassed: true,
        isExempt: false,
        isM01: false,
        planAcknowledged: false,
      });
      expect(allDone.complete).toBe(true);
      expect(allDone.missingCriteria).toHaveLength(0);
    });

    it("requires the individual learning plan only where the module's content has one", () => {
      const rest = { lessonsCount: 1, completedLessonsCount: 1, knowledgeCheckPassed: true, practicalDeliverablePassed: true, isExempt: false, isM01: false, planAcknowledged: false };
      expect(checkModuleCompletionCriteria(rest).complete).toBe(true);
      expect(checkModuleCompletionCriteria({ ...rest, individualPlanSubmitted: true }).complete).toBe(true);
      expect(checkModuleCompletionCriteria({ ...rest, individualPlanSubmitted: false })).toEqual({ complete: false, missingCriteria: ["Individual learning plan not submitted"] });
    });

    it("requires plan acknowledgement specifically for M01", () => {
      const unack = checkModuleCompletionCriteria({
        lessonsCount: 3,
        completedLessonsCount: 3,
        knowledgeCheckPassed: true,
        practicalDeliverablePassed: true,
        isExempt: false,
        isM01: true,
        planAcknowledged: false,
      });
      expect(unack.complete).toBe(false);
      expect(unack.missingCriteria).toContain("Learning plan must be acknowledged");

      const ack = checkModuleCompletionCriteria({
        lessonsCount: 3,
        completedLessonsCount: 3,
        knowledgeCheckPassed: true,
        practicalDeliverablePassed: true,
        isExempt: false,
        isM01: true,
        planAcknowledged: true,
      });
      expect(ack.complete).toBe(true);
    });
  });

  describe("checkProgramCompletion", () => {
    it("returns false if assigned modules list is empty", () => {
      expect(checkProgramCompletion({ assignedModules: [], passedOrExemptModuleIds: [] })).toBe(false);
    });

    it("returns true only when every assigned module is passed or exempt", () => {
      const assigned = ["M01", "M02", "M03", "M11", "M12"];
      expect(checkProgramCompletion({ assignedModules: assigned, passedOrExemptModuleIds: ["M01", "M02"] })).toBe(false);
      expect(
        checkProgramCompletion({
          assignedModules: assigned,
          passedOrExemptModuleIds: ["M01", "M02", "M03", "M11", "M12"],
        }),
      ).toBe(true);
      expect(
        checkProgramCompletion({
          assignedModules: assigned,
          passedOrExemptModuleIds: ["M01", "M02", "M03", "M04", "M11", "M12"],
        }),
      ).toBe(true);
    });
  });

  describe("generateCertificateCode", () => {
    it("generates a unique valid format code", () => {
      const code = generateCertificateCode(2026);
      expect(code).toMatch(/^TRADE-2026-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      const another = generateCertificateCode(2026);
      expect(code).not.toEqual(another);
    });
  });
});
