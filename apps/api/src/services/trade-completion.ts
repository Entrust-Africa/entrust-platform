import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findTradeRules, type ModuleId } from "@entrust/trade-rules";
import {
  checkModuleCompletionCriteria,
  checkProgramCompletion,
  generateCertificateCode,
} from "@entrust/trade-engine";
import type {
  AdminOverrideModuleInput,
  CertificateView,
  ExitAssessmentReportView,
  PublicCertificateView,
} from "../schemas/trade";
import type { Ctx, Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { resolveTradeModuleContent } from "./trade-modules";
import { accessTo, recordTradeChange } from "./trade-shared";
import { isLearningPlan, moduleContentWorksheets } from "./trade-worksheet-definitions";

/**
 * Checks module completion criteria and if complete, marks module progress passed.
 * Furthermore, checks if all assigned modules in the active learning plan are complete;
 * if so, marks the learning plan & enrollment completed and automatically issues a certificate (#71).
 */
export async function evaluateAndSyncModuleCompletion(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentId: string,
  moduleId: ModuleId,
): Promise<{ modulePassed: boolean; programCompleted: boolean; certificateId?: string }> {
  // 1. Fetch enrollment, cohort, program, and organization
  const [enrollmentRow] = await tx
    .select({
      enrollment: schema.enrollment,
      cohort: schema.cohort,
      program: schema.program,
      org: schema.organization,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .innerJoin(schema.program, eq(schema.cohort.programId, schema.program.id))
    .innerJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollmentRow) return { modulePassed: false, programCompleted: false };
  // Completion paths that land together (a lesson tick and a score, say) take turns on the enrolment, so only one of them
  // can find the programme newly complete and issue its certificate. A no-op outside a transaction.
  await tx.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId)).for("update");

  // 2. Fetch module progress
  const [modProgress] = await tx
    .select()
    .from(schema.moduleProgress)
    .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

  // If already passed and not admin-overridden freshly, check program completion directly
  const alreadyPassed = modProgress?.status === "passed";

  // Check exemption
  const [exemption] = await tx
    .select()
    .from(schema.moduleExemption)
    .where(
      and(
        eq(schema.moduleExemption.enrollmentId, enrollmentId),
        eq(schema.moduleExemption.moduleId, moduleId),
        eq(schema.moduleExemption.status, "approved")
      )
    );

  const isExempt = !!exemption || modProgress?.status === "exempted";

  // The module is judged on the version the learner was pinned to when they started it, never one they name later.
  // Only lessons that are in the content count, so a made-up lesson ID can't stand in for a real one.
  const pinned = modProgress?.contentVersion ?? (await currentLearnerVersion(tx, moduleId));
  const content = pinned ? await resolveTradeModuleContent(tx, moduleId, "staff", pinned) : undefined;
  const lessonIds = content?.lessons.map((l) => l.id) ?? [];
  const lessonsCount = lessonIds.length;
  const recorded = (modProgress?.lessonProgress as { completedLessons?: unknown } | null)?.completedLessons;
  const completedLessons = Array.isArray(recorded) ? lessonIds.filter((id) => recorded.includes(id)).length : 0;

  // The knowledge check is passed at the content's own pass mark, on the pinned version.
  const passMark = content?.knowledgeCheck.passMark ?? 100;
  const kcScore = modProgress?.knowledgeCheckScore ? Number(modProgress.knowledgeCheckScore) : 0;
  let knowledgeCheckPassed = content !== undefined && kcScore >= passMark;
  if (!knowledgeCheckPassed && pinned) {
    const [passedAttempt] = await tx
      .select()
      .from(schema.knowledgeCheckAttempt)
      .where(
        and(
          eq(schema.knowledgeCheckAttempt.enrollmentId, enrollmentId),
          eq(schema.knowledgeCheckAttempt.moduleId, moduleId),
          eq(schema.knowledgeCheckAttempt.contentVersion, pinned),
          eq(schema.knowledgeCheckAttempt.passed, true)
        )
      )
      .limit(1);
    if (passedAttempt) knowledgeCheckPassed = true;
  }

  // Check practical deliverable passed
  // The newest submission decides. An earlier pass doesn't stand once newer work has failed or is still being assessed.
  const [latestSub] = await tx
    .select({ status: schema.moduleSubmission.status })
    .from(schema.moduleSubmission)
    .where(and(eq(schema.moduleSubmission.enrollmentId, enrollmentId), eq(schema.moduleSubmission.moduleId, moduleId)))
    .orderBy(desc(schema.moduleSubmission.version))
    .limit(1);
  const practicalDeliverablePassed = latestSub?.status === "passed";

  // Check plan acknowledgement (if M01)
  const [activePlan] = await tx
    .select()
    .from(schema.learningPlan)
    .where(
      and(
        eq(schema.learningPlan.enrollmentId, enrollmentId),
        // A generated plan needs no human review, so the learner works from it as it is.
        inArray(schema.learningPlan.status, ["generated", "approved", "active", "completed"])
      )
    )
    .orderBy(desc(schema.learningPlan.createdAt))
    .limit(1);

  const planAcknowledged = activePlan?.acknowledgedAt !== null && activePlan?.acknowledgedAt !== undefined;

  // A module on Entrust's common standard ends with an individual learning plan.
  const individualPlan = moduleContentWorksheets(moduleId).find(isLearningPlan);
  let individualPlanSubmitted: boolean | undefined;
  if (individualPlan) {
    const [submitted] = await tx
      .select({ id: schema.worksheetVersion.id })
      .from(schema.worksheetVersion)
      .where(
        and(
          eq(schema.worksheetVersion.enrollmentId, enrollmentId),
          eq(schema.worksheetVersion.worksheetId, individualPlan.id),
          eq(schema.worksheetVersion.status, "submitted")
        )
      )
      .limit(1);
    individualPlanSubmitted = !!submitted;
  }

  // A module offered as a test-out (a strong placement score) still has to be shown: passing its knowledge check on its own
  // is the test. A high score alone never exempts (the rules' TEST_OUT_OFFERED).
  const [assignment] = activePlan
    ? await tx
        .select({ status: schema.moduleAssignment.status })
        .from(schema.moduleAssignment)
        .where(and(eq(schema.moduleAssignment.planId, activePlan.id), eq(schema.moduleAssignment.moduleId, moduleId)))
        .limit(1)
    : [];
  const testedOut = assignment?.status === "optional" && knowledgeCheckPassed;

  const criteria = checkModuleCompletionCriteria({
    lessonsCount,
    completedLessonsCount: completedLessons,
    knowledgeCheckPassed,
    practicalDeliverablePassed,
    isExempt,
    isM01: moduleId === "M01",
    planAcknowledged,
    ...(individualPlanSubmitted === undefined ? {} : { individualPlanSubmitted }),
    adminOverride: !!modProgress?.adminOverrideAt || testedOut,
  });

  let modulePassed = alreadyPassed;
  // An exempted module counts as it is: it isn't marked passed, because nothing was assessed.
  if (criteria.complete && !alreadyPassed && modProgress?.status !== "exempted") {
    await tx
      .update(schema.moduleProgress)
      .set({
        status: "passed",
        completedAt: ctx.now,
        updatedAt: ctx.now,
      })
      .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

    await recordTradeChange(tx, ctx.principal.userId, {
      action: testedOut && !modProgress?.adminOverrideAt ? "trade.module.tested_out" : "trade.module.completed",
      organizationId: enrollmentRow.enrollment.organizationId,
      entityId: modProgress?.id ?? `${enrollmentId}:${moduleId}`,
      after: { moduleId, status: "passed", completedAt: ctx.now.toISOString(), ...(testedOut ? { testedOut: true } : {}) },
    });
    modulePassed = true;
  }

  // 3. Check Program Completion
  const { programCompleted, certificateId } = await syncProgramme(tx, ctx, enrollmentRow, activePlan, modulePassed ? moduleId : null);

  return { modulePassed, programCompleted, certificateId };
}

type EnrollmentContext = {
  enrollment: typeof schema.enrollment.$inferSelect;
  cohort: typeof schema.cohort.$inferSelect;
  program: typeof schema.program.$inferSelect;
  org: typeof schema.organization.$inferSelect;
};
type PlanRow = typeof schema.learningPlan.$inferSelect;

/**
 * The programme is complete when every non-optional module in the plan is passed or exempted. Then the plan and the
 * enrolment complete and the certificate is issued, once.
 */
async function syncProgramme(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentRow: EnrollmentContext,
  activePlan: PlanRow | undefined,
  justPassed: ModuleId | null,
): Promise<{ programCompleted: boolean; certificateId?: string }> {
  const enrollmentId = enrollmentRow.enrollment.id;
  let programCompleted = false;
  let certificateId: string | undefined;

  // A withdrawn business doesn't graduate, even if the last score comes in after it left.
  if (activePlan && enrollmentRow.enrollment.status !== "withdrawn") {
    const assigned = await tx
      .select({ moduleId: schema.moduleAssignment.moduleId, status: schema.moduleAssignment.status })
      .from(schema.moduleAssignment)
      .where(eq(schema.moduleAssignment.planId, activePlan.id));

    // Every module in the plan counts, a test-out offer too: it's done by testing out (its knowledge check), not by the
    // score that offered it. A plan already completed is the exception: before 11 Nov 2026 (#218) a test-out offer
    // didn't count, and a re-check (a score override, an exemption) must not reopen a finished programme and withdraw
    // its certificate under a rule it wasn't held to. Plans completed since then have every offer passed anyway.
    const counted = activePlan.status === "completed" ? assigned.filter((a) => a.status !== "optional") : assigned;
    const assignedModuleIds = counted.map((a) => a.moduleId);

    // Get all passed or exempted modules for this enrollment
    const allProgress = await tx
      .select({
        moduleId: schema.moduleProgress.moduleId,
        status: schema.moduleProgress.status,
      })
      .from(schema.moduleProgress)
      .where(eq(schema.moduleProgress.enrollmentId, enrollmentId));

    const allExemptions = await tx
      .select({ moduleId: schema.moduleExemption.moduleId })
      .from(schema.moduleExemption)
      .where(
        and(
          eq(schema.moduleExemption.enrollmentId, enrollmentId),
          eq(schema.moduleExemption.status, "approved")
        )
      );

    const completedOrExemptSet = new Set<string>([
      ...allProgress.filter((p) => p.status === "passed" || p.status === "exempted").map((p) => p.moduleId),
      ...allExemptions.map((e) => e.moduleId),
    ]);

    // If current module just passed in this evaluation, add it:
    if (justPassed) {
      completedOrExemptSet.add(justPassed);
    }

    const isProgComplete = checkProgramCompletion({
      assignedModules: assignedModuleIds,
      passedOrExemptModuleIds: [...completedOrExemptSet],
    });

    if (isProgComplete) {
      programCompleted = true;

      // Update plan to completed
      if (activePlan.status !== "completed") {
        await tx
          .update(schema.learningPlan)
          .set({ status: "completed", updatedAt: ctx.now })
          .where(eq(schema.learningPlan.id, activePlan.id));
      }

      // Update enrollment to completed
      if (enrollmentRow.enrollment.status !== "completed") {
        await tx
          .update(schema.enrollment)
          .set({ status: "completed", completedAt: ctx.now, updatedAt: ctx.now })
          .where(eq(schema.enrollment.id, enrollmentId));

        await recordTradeChange(tx, ctx.principal.userId, {
          action: "trade.program.completed",
          organizationId: enrollmentRow.enrollment.organizationId,
          entityId: enrollmentId,
          after: { completedAt: ctx.now.toISOString() },
        });
      }

      // Check if certificate already issued
      const [existingCert] = await tx
        .select()
        .from(schema.certificate)
        // A revoked certificate doesn't count: passing again earns a new one.
        .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
        .limit(1);

      // A certificate revoked on a finished enrolment stays revoked. Nothing the learner does brings it back: staff reopen
      // a module by changing its score, which makes the enrolment active again, and passing that earns a new one.
      const [revokedWhileFinished] =
        !existingCert && enrollmentRow.enrollment.status === "completed"
          ? await tx.select({ id: schema.certificate.id }).from(schema.certificate).where(eq(schema.certificate.enrollmentId, enrollmentId)).limit(1)
          : [];

      if (!existingCert && !revokedWhileFinished) {
        // Fetch recipient name (SME owner or organization name)
        const [owner] = await tx
          .select({ name: schema.user.name })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(
            and(
              eq(schema.member.organizationId, enrollmentRow.enrollment.organizationId),
              eq(schema.member.role, "owner")
            )
          )
          .limit(1);

        const recipientName = owner?.name?.trim() || enrollmentRow.org.name;
        const certCode = generateCertificateCode(ctx.now.getUTCFullYear());

        // The partial unique index on a live certificate per enrolment is the backstop: a second one is never inserted.
        const [createdCert] = await tx
          .insert(schema.certificate)
          .values({
            enrollmentId,
            code: certCode,
            recipientName,
            recipientOrganizationName: enrollmentRow.org.name,
            programName: enrollmentRow.program.name,
            cohortName: enrollmentRow.cohort.name,
            pathway: activePlan.pathway,
            issuedAt: ctx.now,
          })
          .onConflictDoNothing()
          .returning();

        if (createdCert) {
          certificateId = createdCert.id;
          await recordTradeChange(tx, ctx.principal.userId, {
            action: "trade.certificate.issued",
            organizationId: enrollmentRow.enrollment.organizationId,
            entityId: createdCert.id,
            after: {
              code: certCode,
              recipientName,
              programName: enrollmentRow.program.name,
              cohortName: enrollmentRow.cohort.name,
            },
          });
        }
      } else if (existingCert) {
        certificateId = existingCert.id;
      }
    }
  }

  return certificateId ? { programCompleted, certificateId } : { programCompleted };
}

/** The enrolment with its cohort, programme and business, and the plan the learner works from. */
async function loadEnrollmentContext(tx: Executor, enrollmentId: string): Promise<{ row: EnrollmentContext | undefined; plan: PlanRow | undefined }> {
  const [row] = await tx
    .select({ enrollment: schema.enrollment, cohort: schema.cohort, program: schema.program, org: schema.organization })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .innerJoin(schema.program, eq(schema.cohort.programId, schema.program.id))
    .innerJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.enrollment.id, enrollmentId));
  if (!row) return { row: undefined, plan: undefined };
  const [plan] = await tx
    .select()
    .from(schema.learningPlan)
    .where(and(eq(schema.learningPlan.enrollmentId, enrollmentId), inArray(schema.learningPlan.status, ["generated", "approved", "active", "completed"])))
    .orderBy(desc(schema.learningPlan.createdAt))
    .limit(1);
  return { row, plan };
}

/**
 * Re-checks the whole programme after a change that isn't about one module's work, such as a plan change: it completes
 * if every module is now done, and is reopened if it was finished and no longer is.
 */
export async function resyncProgramme(tx: Executor, ctx: Pick<Ctx, "principal" | "now">, enrollmentId: string, reason: string): Promise<{ programCompleted: boolean }> {
  await tx.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId)).for("update");
  const { row, plan } = await loadEnrollmentContext(tx, enrollmentId);
  if (!row) return { programCompleted: false };
  const { programCompleted } = await syncProgramme(tx, ctx, row, plan, null);
  if (programCompleted) return { programCompleted };
  const [live] = await tx
    .select({ id: schema.certificate.id })
    .from(schema.certificate)
    .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
    .limit(1);
  if (row.enrollment.status === "completed" || live) await reopenEnrolment(tx, ctx, enrollmentId, null, reason);
  return { programCompleted: false };
}

/** What a certificate's public check says when Entrust withdraws it. The reason staff record stays internal. */
export const PUBLIC_REVOCATION_REASON = "Entrust Africa withdrew this certificate.";

/**
 * Something the programme's completion rested on no longer stands (a score turned to a fail, a critical failure, an
 * exemption taken back), so what it earned goes too: the certificate is revoked, and a completed enrolment and plan go
 * back to active. Attendance, progress and attempts stay. `reason` is internal; the public check shows a plain sentence.
 */
export async function reopenEnrolment(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentId: string,
  moduleId: ModuleId | null,
  reason: string,
): Promise<void> {
  const [enrollment] = await tx.select().from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId));
  if (!enrollment) return;

  const revoked = await tx
    .update(schema.certificate)
    .set({ revokedAt: ctx.now, revokedByUserId: ctx.principal.userId, revocationReason: reason, publicRevocationReason: PUBLIC_REVOCATION_REASON, updatedAt: ctx.now })
    .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
    .returning();
  for (const cert of revoked) {
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.certificate.revoked",
      organizationId: enrollment.organizationId,
      entityId: cert.id,
      after: { code: cert.code, revokedAt: ctx.now.toISOString(), revokedBy: ctx.principal.userId, reason },
    });
  }

  await tx
    .update(schema.learningPlan)
    .set({ status: "active", updatedAt: ctx.now })
    .where(and(eq(schema.learningPlan.enrollmentId, enrollmentId), eq(schema.learningPlan.status, "completed")));

  if (enrollment.status === "completed") {
    await tx
      .update(schema.enrollment)
      .set({ status: "active", completedAt: null, updatedAt: ctx.now })
      .where(eq(schema.enrollment.id, enrollmentId));
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.program.reopened",
      organizationId: enrollment.organizationId,
      entityId: enrollmentId,
      after: { moduleId, reason },
    });
  }
}

/**
 * Re-checks a module and the programme after anything that can change whether they're complete: a score, an override,
 * an exemption decision, a plan change. A module that now completes the programme issues the certificate; a programme
 * that was finished, or holds a live certificate, and isn't any more is reopened.
 */
export async function resyncCompletion(
  tx: Executor,
  ctx: Pick<Ctx, "principal" | "now">,
  enrollmentId: string,
  moduleId: ModuleId,
  reason: string,
): Promise<{ programCompleted: boolean }> {
  const result = await evaluateAndSyncModuleCompletion(tx, ctx, enrollmentId, moduleId);
  if (result.programCompleted) return { programCompleted: true };
  const [enrollment] = await tx.select({ status: schema.enrollment.status }).from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId));
  const [live] = await tx
    .select({ id: schema.certificate.id })
    .from(schema.certificate)
    .where(and(eq(schema.certificate.enrollmentId, enrollmentId), isNull(schema.certificate.revokedAt)))
    .limit(1);
  if (enrollment?.status === "completed" || live) await reopenEnrolment(tx, ctx, enrollmentId, moduleId, reason);
  return { programCompleted: false };
}

/** The newest version of a module a learner can start now, which is the one a new learner is pinned to. */
export async function currentLearnerVersion(db: Executor, moduleId: ModuleId): Promise<string | null> {
  return (await resolveTradeModuleContent(db, moduleId, "learner"))?.version ?? null;
}

/**
 * Whether a module has a confirmed critical failure with no pass since. The spec's rule: no passing result while one is
 * unresolved. It's resolved by passing newer work, or by an administrator changing the score with a reason.
 */
export async function hasUnresolvedCriticalFailure(db: Executor, enrollmentId: string, moduleId: string): Promise<boolean> {
  const scored = await db
    .select({ failures: schema.rubricAssessment.confirmedCriticalFailures, passed: schema.rubricAssessment.passed })
    .from(schema.moduleSubmission)
    .innerJoin(schema.rubricAssessment, and(eq(schema.rubricAssessment.submissionId, schema.moduleSubmission.id), eq(schema.rubricAssessment.isFirstScore, true)))
    .where(and(eq(schema.moduleSubmission.enrollmentId, enrollmentId), eq(schema.moduleSubmission.moduleId, moduleId as ModuleId)))
    .orderBy(desc(schema.moduleSubmission.version));
  for (const score of scored) {
    if (score.passed) return false;
    if (score.failures.length) return true;
  }
  return false;
}

/** A critical failure takes away what would otherwise count as complete: an exemption, and an administrator's override. */
export async function clearCompletionAfterCriticalFailure(db: Executor, ctx: { principal: { userId: string }; now: Date }, organizationId: string, enrollmentId: string, moduleId: string): Promise<void> {
  const withdrawn = await db
    .update(schema.moduleExemption)
    .set({ status: "rejected", reviewComment: "Withdrawn: the module's submission has a confirmed critical failure.", reviewedAt: ctx.now, updatedAt: ctx.now })
    .where(and(eq(schema.moduleExemption.enrollmentId, enrollmentId), eq(schema.moduleExemption.moduleId, moduleId as ModuleId), inArray(schema.moduleExemption.status, ["pending", "approved"])))
    .returning({ id: schema.moduleExemption.id });
  for (const { id } of withdrawn) {
    await recordTradeChange(db, ctx.principal.userId, { action: "trade.module_exemption.withdrawn", organizationId, entityType: "trade.module_exemption", entityId: id, after: { reason: "Confirmed critical failure" } });
  }
  await db
    .update(schema.moduleProgress)
    .set({ adminOverrideByUserId: null, adminOverrideReason: null, adminOverrideAt: null, updatedAt: ctx.now })
    .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId as ModuleId)));
}

/**
 * Admin override to manually complete a module with a required reason (#71).
 */
export async function adminOverrideModuleCompletion(
  ctx: Ctx,
  body: AdminOverrideModuleInput,
): Promise<{ success: boolean; moduleId: ModuleId; enrollmentId: string }> {
  if (ctx.principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only an Entrust administrator can override module completion.");
  }

  const { enrollmentId, moduleId, reason } = body;

  return ctx.db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.id, enrollmentId));

    if (!enrollment) {
      throw new ServiceError("not_found", "Enrollment not found.");
    }

    if (await hasUnresolvedCriticalFailure(tx, enrollmentId, moduleId)) {
      throw new ServiceError("invalid", "This module has a confirmed critical failure, so it can't be completed by override. The learner resubmits, or you change the score with a reason.");
    }

    // Upsert module progress to passed with admin override
    const [existing] = await tx
      .select()
      .from(schema.moduleProgress)
      .where(and(eq(schema.moduleProgress.enrollmentId, enrollmentId), eq(schema.moduleProgress.moduleId, moduleId)));

    if (existing) {
      await tx
        .update(schema.moduleProgress)
        .set({
          status: "passed",
          adminOverrideByUserId: ctx.principal.userId,
          adminOverrideReason: reason,
          adminOverrideAt: ctx.now,
          completedAt: ctx.now,
          updatedAt: ctx.now,
        })
        .where(eq(schema.moduleProgress.id, existing.id));
    } else {
      const version = await currentLearnerVersion(tx, moduleId);
      if (!version) throw new ServiceError("invalid", `${moduleId} has no approved content yet.`);
      await tx.insert(schema.moduleProgress).values({
        enrollmentId,
        moduleId,
        contentVersion: version,
        status: "passed",
        adminOverrideByUserId: ctx.principal.userId,
        adminOverrideReason: reason,
        adminOverrideAt: ctx.now,
        completedAt: ctx.now,
      });
    }

    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.module.admin_override",
      organizationId: enrollment.organizationId,
      entityId: `${enrollmentId}:${moduleId}`,
      after: {
        moduleId,
        reason,
        overriddenBy: ctx.principal.userId,
      },
    });

    // Check program completion
    await evaluateAndSyncModuleCompletion(tx, ctx, enrollmentId, moduleId);

    return { success: true, moduleId, enrollmentId };
  });
}

/**
 * Public lookup of certificate by code. No authentication required (#71).
 */
export async function getCertificateByCodePublic(
  db: Executor,
  code: string,
): Promise<PublicCertificateView> {
  const normalized = code.trim().toUpperCase();
  const [cert] = await db
    .select()
    .from(schema.certificate)
    .where(eq(schema.certificate.code, normalized));

  if (!cert) {
    throw new ServiceError("not_found", `Certificate with code ${normalized} not found.`);
  }

  const isRevoked = cert.revokedAt !== null;

  return {
    code: cert.code,
    recipientName: cert.recipientName,
    recipientOrganizationName: cert.recipientOrganizationName,
    programName: cert.programName,
    cohortName: cert.cohortName,
    pathway: cert.pathway,
    issuedAt: cert.issuedAt.toISOString(),
    isValid: !isRevoked,
    isRevoked,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    // Anyone can look a code up, so only the reason meant for the public: staff's own words stay internal.
    revocationReason: isRevoked ? (cert.publicRevocationReason ?? PUBLIC_REVOCATION_REASON) : null,
  };
}

/**
 * Authenticated certificate retrieval for an enrollment (#71).
 */
export async function getCertificateForEnrollment(
  ctx: Ctx,
  enrollmentId: string,
): Promise<CertificateView | null> {
  const [enrollment] = await ctx.db
    .select()
    .from(schema.enrollment)
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollment) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const access = await accessTo(ctx.db, ctx.principal, enrollment.organizationId);
  if (!access) {
    throw new ServiceError("forbidden", "Access denied.");
  }

  const [cert] = await ctx.db
    .select()
    .from(schema.certificate)
    .where(eq(schema.certificate.enrollmentId, enrollmentId))
    .orderBy(desc(schema.certificate.issuedAt))
    .limit(1);

  if (!cert) return null;

  const isRevoked = cert.revokedAt !== null;

  return {
    id: cert.id,
    enrollmentId: cert.enrollmentId,
    code: cert.code,
    recipientName: cert.recipientName,
    recipientOrganizationName: cert.recipientOrganizationName,
    programName: cert.programName,
    cohortName: cert.cohortName,
    pathway: cert.pathway,
    issuedAt: cert.issuedAt.toISOString(),
    isValid: !isRevoked,
    isRevoked,
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revocationReason: cert.revocationReason ?? null,
    verificationUrl: `/verify/${cert.code}`,
  };
}

/**
 * Revoke an issued certificate with a required reason (#71).
 */
export async function revokeCertificate(
  ctx: Ctx,
  certificateId: string,
  reason: string,
  publicReason?: string,
): Promise<CertificateView> {
  if (ctx.principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only an Entrust administrator can revoke certificates.");
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) {
    throw new ServiceError("invalid", "A valid reason is required to revoke a certificate.");
  }

  return ctx.db.transaction(async (tx) => {
    const [cert] = await tx
      .select({
        cert: schema.certificate,
        enrollment: schema.enrollment,
      })
      .from(schema.certificate)
      .innerJoin(schema.enrollment, eq(schema.certificate.enrollmentId, schema.enrollment.id))
      .where(eq(schema.certificate.id, certificateId));

    if (!cert) {
      throw new ServiceError("not_found", "Certificate not found.");
    }

    if (cert.cert.revokedAt) {
      throw new ServiceError("invalid_transition", "This certificate has already been revoked.");
    }

    const [updated] = await tx
      .update(schema.certificate)
      .set({
        revokedAt: ctx.now,
        revokedByUserId: ctx.principal.userId,
        revocationReason: trimmedReason,
        publicRevocationReason: publicReason?.trim() || PUBLIC_REVOCATION_REASON,
        updatedAt: ctx.now,
      })
      .where(and(eq(schema.certificate.id, certificateId), isNull(schema.certificate.revokedAt)))
      .returning();

    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.certificate.revoked",
      organizationId: cert.enrollment.organizationId,
      entityId: certificateId,
      after: {
        code: cert.cert.code,
        revokedAt: ctx.now.toISOString(),
        revokedBy: ctx.principal.userId,
        reason: trimmedReason,
      },
    });

    return {
      id: updated!.id,
      enrollmentId: updated!.enrollmentId,
      code: updated!.code,
      recipientName: updated!.recipientName,
      recipientOrganizationName: updated!.recipientOrganizationName,
      programName: updated!.programName,
      cohortName: updated!.cohortName,
      pathway: updated!.pathway,
      issuedAt: updated!.issuedAt.toISOString(),
      isValid: false,
      isRevoked: true,
      revokedAt: updated!.revokedAt ? updated!.revokedAt.toISOString() : null,
      revocationReason: updated!.revocationReason ?? null,
      verificationUrl: `/verify/${updated!.code}`,
    };
  });
}

/**
 * Generates the comparative Capability Report comparing baseline placement assessment
 * with the exit assessment per domain (#71).
 */
export async function getExitAssessmentReport(
  ctx: Ctx,
  enrollmentId: string,
): Promise<ExitAssessmentReportView> {
  const [enrollmentRow] = await ctx.db
    .select({
      enrollment: schema.enrollment,
      cohort: schema.cohort,
      org: schema.organization,
    })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.enrollment.cohortId, schema.cohort.id))
    .innerJoin(schema.organization, eq(schema.enrollment.organizationId, schema.organization.id))
    .where(eq(schema.enrollment.id, enrollmentId));

  if (!enrollmentRow) {
    throw new ServiceError("not_found", "Enrollment not found.");
  }

  const access = await accessTo(ctx.db, ctx.principal, enrollmentRow.enrollment.organizationId);
  if (!access) {
    throw new ServiceError("forbidden", "Access denied.");
  }

  // Get placement assessment
  const [placement] = await ctx.db
    .select()
    .from(schema.tradeAssessment)
    .where(
      and(
        eq(schema.tradeAssessment.enrollmentId, enrollmentId),
        eq(schema.tradeAssessment.kind, "placement"),
        inArray(schema.tradeAssessment.status, ["scored", "review_required"])
      )
    )
    .orderBy(desc(schema.tradeAssessment.createdAt))
    .limit(1);

  // Get exit assessment
  const [exitAss] = await ctx.db
    .select()
    .from(schema.tradeAssessment)
    .where(
      and(
        eq(schema.tradeAssessment.enrollmentId, enrollmentId),
        eq(schema.tradeAssessment.kind, "exit"),
        inArray(schema.tradeAssessment.status, ["scored", "review_required"])
      )
    )
    .orderBy(desc(schema.tradeAssessment.createdAt))
    .limit(1);

  // Fetch placement scores
  const placementScores = placement
    ? await ctx.db
        .select()
        .from(schema.capabilityScore)
        .where(
          and(
            eq(schema.capabilityScore.assessmentId, placement.id),
            eq(schema.capabilityScore.kind, "domain")
          )
        )
    : [];

  // Fetch exit scores
  const exitScores = exitAss
    ? await ctx.db
        .select()
        .from(schema.capabilityScore)
        .where(
          and(
            eq(schema.capabilityScore.assessmentId, exitAss.id),
            eq(schema.capabilityScore.kind, "domain")
          )
        )
    : [];

  const rules = findTradeRules("0.1.0")!;
  const domainTitles = new Map<string, string>(rules.domains.map((d) => [d.id, d.title]));

  const placementMap = new Map(placementScores.map((s) => [s.domain, s]));
  const exitMap = new Map(exitScores.map((s) => [s.domain, s]));

  const allDomainIds = Array.from(new Set([...placementMap.keys(), ...exitMap.keys()]));

  const comparisons = allDomainIds.map((domainId) => {
    const p = placementMap.get(domainId);
    const e = exitMap.get(domainId);

    const placementScore = p?.score !== null && p?.score !== undefined ? Number(p.score) : null;
    const exitScore = e?.score !== null && e?.score !== undefined ? Number(e.score) : null;
    const deltaScore =
      exitScore !== null && placementScore !== null
        ? Number((exitScore - placementScore).toFixed(2))
        : null;

    return {
      domainId,
      domainTitle: domainTitles.get(domainId) ?? domainId,
      placementScore,
      placementBand: p?.band ?? null,
      placementBandLabel: p?.band ? p.band.charAt(0).toUpperCase() + p.band.slice(1) : null,
      exitScore,
      exitBand: e?.band ?? null,
      exitBandLabel: e?.band ? e.band.charAt(0).toUpperCase() + e.band.slice(1) : null,
      deltaScore,
    };
  });

  const formatScores = (scores: typeof placementScores) =>
    scores.map((s) => ({
      id: s.domain,
      title: domainTitles.get(s.domain) ?? s.domain,
      score: s.score !== null ? Number(s.score) : null,
      band: s.band,
      bandLabel: s.band ? s.band.charAt(0).toUpperCase() + s.band.slice(1) : null,
      coverage: Math.round(Number(s.coverage) * 100),
      points: s.points,
      maxPoints: s.maxPoints,
      evidence: s.evidenceStatus as any,
    }));

  return {
    enrollmentId,
    organizationId: enrollmentRow.enrollment.organizationId,
    organizationName: enrollmentRow.org.name,
    cohortName: enrollmentRow.cohort.name,
    placementAssessmentId: placement?.id ?? null,
    exitAssessmentId: exitAss?.id ?? null,
    placementScores: formatScores(placementScores),
    exitScores: formatScores(exitScores),
    comparisons,
  };
}
