import { and, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
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
  /** Set for a message that repeats, so the same thing is told to a person once. */
  dedupeKey?: string | undefined;
}

/** Tells each person, in the platform and by email as they prefer. Returns how many were told. Never throws. */
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
      const preference = preferences.find((p) => p.userId === person.id);
      const wantsInApp = preference?.inApp ?? true;
      const wantsEmail = preference?.email ?? true;
      if (!wantsInApp && !wantsEmail) continue;

      let emailStatus: "queued" | "skipped" | "failed" = "skipped";
      if (wantsEmail && person.email) {
        try {
          const url = input.path && appUrl() ? `${appUrl()}${input.path}` : undefined;
          await enqueue(
            JOB_NAMES.SEND_EMAIL,
            {
              to: person.email,
              subject: input.title,
              template: "trade-notice",
              props: { heading: input.title, greeting: `Hello ${person.name || "there"},`, paragraphs: [input.body], details: [], ...(url ? { action: { label: "Open in TRADE", url } } : {}) },
            },
            input.dedupeKey ? { singletonKey: `notice-${person.id}-${input.dedupeKey}` } : undefined,
          );
          emailStatus = "queued";
        } catch (error) {
          emailStatus = "failed";
          console.warn("[trade:notifications] Could not queue the email:", error);
        }
      }
      if (!wantsInApp) continue;
      const inserted = await db
        .insert(schema.notification)
        .values({ userId: person.id, organizationId: input.organizationId ?? null, kind: input.kind, title: input.title, body: input.body, path: input.path ?? null, dedupeKey: input.dedupeKey ?? null, emailStatus })
        .onConflictDoNothing()
        .returning({ id: schema.notification.id });
      if (inserted.length > 0) told++;
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
  const where = input.unreadOnly ? and(eq(schema.notification.userId, ctx.principal.userId), isNull(schema.notification.readAt)) : eq(schema.notification.userId, ctx.principal.userId);
  const [rows, [unread]] = await Promise.all([
    ctx.db.select().from(schema.notification).where(where).orderBy(desc(schema.notification.createdAt)).limit(input.limit ?? 30),
    ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.notification).where(and(eq(schema.notification.userId, ctx.principal.userId), isNull(schema.notification.readAt))),
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

/**
 * Overdue action items and learning left unfinished. Run on a schedule; each reminder is sent once (an action item) or once a
 * week (learning), however often this runs. Returns how many people were told.
 */
export async function sendDueReminders(db: Executor, now = new Date()): Promise<{ overdueActions: number; incompleteLearning: number }> {
  let overdueActions = 0;
  let incompleteLearning = 0;

  const today = now.toISOString().slice(0, 10);
  const overdue = await db
    .select()
    .from(schema.actionItem)
    .where(and(lt(schema.actionItem.dueDate, today), notInArray(schema.actionItem.status, ["completed", "closed_without_completion", "cancelled"])));
  for (const item of overdue) {
    overdueActions += await notify(db, {
      userIds: await organizationMemberIds(db, item.organizationId),
      kind: "overdue_action",
      title: "An action item is overdue",
      body: `"${item.description.slice(0, 140)}" was due on ${item.dueDate}.`,
      path: "/action-plan",
      organizationId: item.organizationId,
      dedupeKey: `overdue:${item.id}`,
    });
  }

  const cutoff = new Date(now.getTime() - STALE_LEARNING_DAYS * 86_400_000);
  const week = `${now.getUTCFullYear()}-${Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / (7 * 86_400_000))}`;
  const stale = await db
    .select({ enrollmentId: schema.moduleProgress.enrollmentId, moduleId: schema.moduleProgress.moduleId, organizationId: schema.enrollment.organizationId })
    .from(schema.moduleProgress)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.moduleProgress.enrollmentId))
    .where(and(inArray(schema.moduleProgress.status, ["in_progress", "needs_revision"]), lt(schema.moduleProgress.updatedAt, cutoff), eq(schema.enrollment.status, "active")));
  for (const row of stale) {
    incompleteLearning += await notify(db, {
      userIds: await organizationMemberIds(db, row.organizationId),
      kind: "learning_incomplete",
      title: `${row.moduleId} is waiting for you`,
      body: `You started ${row.moduleId} but haven't done anything on it for a while. Pick it up where you left off.`,
      path: `/modules/${row.moduleId}`,
      organizationId: row.organizationId,
      dedupeKey: `incomplete:${row.enrollmentId}:${row.moduleId}:${week}`,
    });
  }
  return { overdueActions, incompleteLearning };
}
