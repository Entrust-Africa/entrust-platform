import { and, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES, type EnqueueInput, type SendEmailJobData } from "@entrust/jobs";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

// Notifications (FRD section 8): a message in the platform and, unless the person turned it off for that kind, an email through
// the email queue. A notification is never what a decision rests on, and a problem with it must not undo the work that caused
// it, so sending is best-effort: it logs and carries on.

export type NotificationKind = (typeof schema.NOTIFICATION_KINDS)[number];

/** What each kind is called on the preferences screen, in the words a person would use. */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  diagnostic_completed: "My diagnostic was completed",
  module_assigned: "A learning plan or module was assigned to me",
  learning_incomplete: "Learning activities are waiting to be finished",
  assessment_result: "An assessment result is ready",
  session_reminder: "A cohort session is coming up",
  output_review: "A practical output needs review (staff)",
  overdue_action: "An action item is overdue",
  referral_status: "A partner referral changed",
  admin_alert: "Something needs an administrator's attention (staff)",
};

const appUrl = () => (process.env.TRADE_APP_URL ?? "").trim().replace(/\/+$/, "");

export interface NotifyInput {
  userIds: readonly string[];
  kind: NotificationKind;
  title: string;
  body: string;
  /** A path in the TRADE app, such as /modules/M04. */
  path?: string | undefined;
  organizationId?: string | null | undefined;
  /** Set for a message that repeats, so the same thing is told to a person once, in the platform and by email. */
  dedupeKey?: string | undefined;
  /** An email in its own template instead of the plain notice, such as a session reminder. Given each person's name. */
  email?: ((person: { name: string | null }) => CustomEmail) | undefined;
}

/** The templates a notification can send instead of the plain notice. */
type CustomEmail = Pick<Extract<SendEmailJobData, { template: "trade-session-reminder" }>, "template" | "props">;

/**
 * Tells each person, in the platform and by email as they prefer. Returns how many were told. Never throws.
 *
 * The row goes in first and the email only follows when the row is new. With a dedupe key the row is what stops a
 * repeat: an email queued first would go out again every time, however the in-app message was kept to one. A person who
 * wants email only still gets a row, kept out of their list, for the same reason.
 */
export async function notify(db: Executor, input: NotifyInput): Promise<number> {
  try {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return 0;
    const [users, preferences] = await Promise.all([
      db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email }).from(schema.user).where(inArray(schema.user.id, userIds)),
      db.select().from(schema.notificationPreference).where(and(inArray(schema.notificationPreference.userId, userIds), eq(schema.notificationPreference.kind, input.kind))),
    ]);
    let told = 0;
    for (const person of users) {
      try {
        const preference = preferences.find((p) => p.userId === person.id);
        const wantsInApp = preference?.inApp ?? true;
        const wantsEmail = (preference?.email ?? true) && Boolean(person.email);
        if (!wantsInApp && !wantsEmail) continue;

        const [row] = await db
          .insert(schema.notification)
          .values({
            userId: person.id,
            organizationId: input.organizationId ?? null,
            kind: input.kind,
            title: input.title,
            body: input.body,
            path: input.path ?? null,
            dedupeKey: input.dedupeKey ?? null,
            inApp: wantsInApp,
            emailStatus: "skipped",
          })
          .onConflictDoNothing()
          .returning({ id: schema.notification.id });
        // Told before: nothing goes out again.
        if (!row) continue;
        told++;
        if (!wantsEmail) continue;

        let emailStatus: "queued" | "failed" = "queued";
        try {
          const url = input.path && appUrl() ? `${appUrl()}${input.path}` : undefined;
          const custom = input.email?.({ name: person.name });
          await enqueue(
            JOB_NAMES.SEND_EMAIL,
            (custom
              ? { to: person.email, subject: input.title, template: custom.template, props: custom.props }
              : {
                  to: person.email,
                  subject: input.title,
                  template: "trade-notice",
                  props: { heading: input.title, greeting: `Hello ${person.name || "there"},`, paragraphs: [input.body], details: [], ...(url ? { action: { label: "Open in TRADE", url } } : {}) },
                }) as EnqueueInput<typeof JOB_NAMES.SEND_EMAIL>,
          );
        } catch (error) {
          emailStatus = "failed";
          console.warn("[trade:notifications] Could not queue the email:", error);
        }
        await db.update(schema.notification).set({ emailStatus }).where(eq(schema.notification.id, row.id));
      } catch (error) {
        // One person's problem doesn't stop the others being told.
        console.warn("[trade:notifications] Could not notify a person:", error);
      }
    }
    return told;
  } catch (error) {
    console.warn("[trade:notifications] Could not notify:", error);
    return 0;
  }
}

/** Everyone who works for an SME organisation. */
export async function organizationMemberIds(db: Executor, organizationId: string): Promise<string[]> {
  const rows = await db.select({ userId: schema.member.userId }).from(schema.member).where(eq(schema.member.organizationId, organizationId));
  return rows.map((r) => r.userId);
}

/** The staff assigned to a cohort. */
export async function cohortStaffIds(db: Executor, cohortId: string): Promise<string[]> {
  const rows = await db.select({ userId: schema.cohortStaff.userId }).from(schema.cohortStaff).where(eq(schema.cohortStaff.cohortId, cohortId));
  return rows.map((r) => r.userId);
}

/** The staff assigned to the cohort an enrolment is in. */
export async function staffForEnrollment(db: Executor, enrollmentId: string): Promise<string[]> {
  const [row] = await db.select({ cohortId: schema.enrollment.cohortId }).from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId));
  return row ? cohortStaffIds(db, row.cohortId) : [];
}

// ---- What a person sees ----

const view = (n: typeof schema.notification.$inferSelect) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, path: n.path, read: n.readAt !== null, createdAt: n.createdAt.toISOString() });

export async function listNotifications(ctx: Ctx, input: { unreadOnly?: boolean | undefined; limit?: number | undefined }) {
  // A row kept only to stop a repeat email isn't a message in the platform.
  const mine = and(eq(schema.notification.userId, ctx.principal.userId), eq(schema.notification.inApp, true));
  const where = input.unreadOnly ? and(mine, isNull(schema.notification.readAt)) : mine;
  const [rows, [unread]] = await Promise.all([
    ctx.db.select().from(schema.notification).where(where).orderBy(desc(schema.notification.createdAt)).limit(input.limit ?? 30),
    ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.notification).where(and(mine, isNull(schema.notification.readAt))),
  ]);
  return { unread: unread?.n ?? 0, items: rows.map(view) };
}

export async function markRead(ctx: Ctx, input: { ids?: string[] | undefined; all?: boolean | undefined }) {
  if (!input.all && !input.ids?.length) throw new ServiceError("invalid", "Say which notifications, or set `all`.");
  const own = eq(schema.notification.userId, ctx.principal.userId);
  await ctx.db
    .update(schema.notification)
    .set({ readAt: ctx.now })
    .where(and(own, isNull(schema.notification.readAt), input.all ? undefined : inArray(schema.notification.id, input.ids!)));
  return listNotifications(ctx, { limit: 1 }).then((r) => ({ unread: r.unread }));
}

export async function getPreferences(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.notificationPreference).where(eq(schema.notificationPreference.userId, ctx.principal.userId));
  return {
    items: schema.NOTIFICATION_KINDS.map((kind) => {
      const row = rows.find((r) => r.kind === kind);
      return { kind, label: NOTIFICATION_LABELS[kind], email: row?.email ?? true, inApp: row?.inApp ?? true };
    }),
  };
}

export async function setPreference(ctx: Ctx, input: { kind: NotificationKind; email: boolean; inApp: boolean }) {
  await ctx.db
    .insert(schema.notificationPreference)
    .values({ userId: ctx.principal.userId, kind: input.kind, email: input.email, inApp: input.inApp })
    .onConflictDoUpdate({ target: [schema.notificationPreference.userId, schema.notificationPreference.kind], set: { email: input.email, inApp: input.inApp } });
  return getPreferences(ctx);
}

// ---- Reminders ----

/** A learner who hasn't touched a module they started for this long is reminded, at most once a week. */
const STALE_LEARNING_DAYS = 14;

/** Enrolments that still take reminders. A business that withdrew or finished isn't chased. */
const REMINDED_ENROLMENT_STATUSES = ["invited", "registered", "active", "paused"] as const;

/** Weeks since 1970, so the weekly key doesn't start again on 1 January and send two reminders in a week. */
const weekNumber = (now: Date) => Math.floor(now.getTime() / (7 * 86_400_000));

/**
 * Overdue action items and learning left unfinished. Run on a schedule; each reminder is sent once (an action item) or once a
 * week (learning), however often this runs. A problem with one reminder is logged and the rest still go. Returns how many
 * people were told.
 */
export async function sendDueReminders(db: Executor, now = new Date()): Promise<{ overdueActions: number; incompleteLearning: number; failed: number }> {
  let overdueActions = 0;
  let incompleteLearning = 0;
  let failed = 0;

  const today = now.toISOString().slice(0, 10);
  const stillEnrolled = sql`exists (select 1 from ${schema.enrollment} where ${schema.enrollment.organizationId} = ${schema.actionItem.organizationId} and ${inArray(schema.enrollment.status, [...REMINDED_ENROLMENT_STATUSES])})`;
  const overdue = await db
    .select()
    .from(schema.actionItem)
    .where(and(lt(schema.actionItem.dueDate, today), notInArray(schema.actionItem.status, ["completed", "closed_without_completion", "cancelled"]), stillEnrolled));
  for (const item of overdue) {
    try {
      overdueActions += await notify(db, {
        userIds: await organizationMemberIds(db, item.organizationId),
        kind: "overdue_action",
        title: "An action item is overdue",
        body: `"${item.description.slice(0, 140)}" was due on ${item.dueDate}.`,
        path: "/action-plan",
        organizationId: item.organizationId,
        dedupeKey: `overdue:${item.id}`,
      });
    } catch (error) {
      failed++;
      console.warn(`[trade:reminders] Could not remind about action item ${item.id}:`, error);
    }
  }

  const cutoff = new Date(now.getTime() - STALE_LEARNING_DAYS * 86_400_000);
  const week = weekNumber(now);
  const stale = await db
    .select({ enrollmentId: schema.moduleProgress.enrollmentId, moduleId: schema.moduleProgress.moduleId, organizationId: schema.enrollment.organizationId })
    .from(schema.moduleProgress)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.moduleProgress.enrollmentId))
    .where(and(inArray(schema.moduleProgress.status, ["in_progress", "needs_revision"]), lt(schema.moduleProgress.updatedAt, cutoff), eq(schema.enrollment.status, "active")));
  for (const row of stale) {
    try {
      incompleteLearning += await notify(db, {
        userIds: await organizationMemberIds(db, row.organizationId),
        kind: "learning_incomplete",
        title: `${row.moduleId} is waiting for you`,
        body: `You started ${row.moduleId} but haven't done anything on it for a while. Pick it up where you left off.`,
        path: `/modules/${row.moduleId}`,
        organizationId: row.organizationId,
        dedupeKey: `incomplete:${row.enrollmentId}:${row.moduleId}:w${week}`,
      });
    } catch (error) {
      failed++;
      console.warn(`[trade:reminders] Could not remind about ${row.moduleId} on enrolment ${row.enrollmentId}:`, error);
    }
  }
  return { overdueActions, incompleteLearning, failed };
}
