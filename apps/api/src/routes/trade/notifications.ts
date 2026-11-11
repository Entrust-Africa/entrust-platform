import { createRoute, z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { ServiceError } from "../../services/errors";
import { getPreferences, listNotifications, markRead, sendDueReminders, setPreference } from "../../services/trade-notifications";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE notifications"];
const router = clearRouter("trade");
const ok = (description: string, schema: z.ZodType) => ({ description, content: json(schema) });

const Notification = z.object({ id: z.string(), kind: z.enum(schema.NOTIFICATION_KINDS), title: z.string(), body: z.string(), path: z.string().nullable(), read: z.boolean(), createdAt: z.string() }).openapi("TradeNotification");
const Preferences = z.object({ items: z.array(z.object({ kind: z.enum(schema.NOTIFICATION_KINDS), label: z.string(), email: z.boolean(), inApp: z.boolean() })) }).openapi("TradeNotificationPreferences");

const list = createRoute({
  method: "get",
  path: "/notifications",
  tags,
  summary: "The signed-in person's notifications, newest first",
  request: { query: z.object({ unreadOnly: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }) },
  responses: { 200: ok("Notifications", z.object({ unread: z.number(), items: z.array(Notification) })), ...listErrors },
});
const read = createRoute({
  method: "post",
  path: "/notifications/read",
  tags,
  summary: "Mark notifications as read",
  request: { body: { content: json(z.object({ ids: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() })), required: true } },
  responses: { 200: ok("What is still unread", z.object({ unread: z.number() })), ...writeErrors },
});
const prefs = createRoute({ method: "get", path: "/notification-preferences", tags, summary: "Which notifications the person gets, in the platform and by email", responses: { 200: ok("Preferences", Preferences), ...listErrors } });
const setPrefs = createRoute({
  method: "put",
  path: "/notification-preferences",
  tags,
  summary: "Choose how one kind of notification reaches the person",
  request: { body: { content: json(z.object({ kind: z.enum(schema.NOTIFICATION_KINDS), email: z.boolean(), inApp: z.boolean() })), required: true } },
  responses: { 200: ok("Preferences", Preferences), ...writeErrors },
});
const reminders = createRoute({
  method: "post",
  path: "/notifications/send-reminders",
  tags,
  summary: "Send the overdue-action and unfinished-learning reminders now",
  description: "Administrators only. Meant to be called on a schedule; each reminder goes out once however often this runs.",
  responses: { 200: ok("How many people were told", z.object({ overdueActions: z.number(), incompleteLearning: z.number(), failed: z.number() })), ...writeErrors },
});

export const tradeNotifications = router
  .openapi(list, async (c) => c.json(await listNotifications(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(read, async (c) => c.json(await markRead(await contextFor(c.get("user")), c.req.valid("json")), 200))
  .openapi(prefs, async (c) => c.json(await getPreferences(await contextFor(c.get("user"))), 200))
  .openapi(setPrefs, async (c) => c.json(await setPreference(await contextFor(c.get("user")), c.req.valid("json")), 200))
  .openapi(reminders, async (c) => {
    const ctx = await contextFor(c.get("user"));
    if (ctx.principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only an administrator can send reminders.");
    return c.json(await sendDueReminders(ctx.db, ctx.now), 200);
  });
