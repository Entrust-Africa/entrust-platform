import { and, asc, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { ClarificationView } from "../schemas/summit";
import type { Executor } from "./db";

// Reading requests for more information, apart from the actions that make and answer them, so the application
// view and the officer's workspace can both show them.

export async function openClarification(db: Executor, applicationId: string) {
  const [open] = await db
    .select()
    .from(schema.clarificationRequest)
    .where(and(eq(schema.clarificationRequest.applicationId, applicationId), isNull(schema.clarificationRequest.respondedAt)));
  return open;
}

/** The requests for an application, oldest first. An applicant sees what was asked and what they answered, and not who asked. */
export async function listClarifications(db: Executor, applicationId: string, forApplicant: boolean): Promise<ClarificationView[]> {
  const rows = await db
    .select({
      id: schema.clarificationRequest.id,
      message: schema.clarificationRequest.message,
      requestedAt: schema.clarificationRequest.requestedAt,
      notifiedAt: schema.clarificationRequest.notifiedAt,
      response: schema.clarificationRequest.response,
      respondedAt: schema.clarificationRequest.respondedAt,
      userId: schema.user.id,
      userName: schema.user.name,
    })
    .from(schema.clarificationRequest)
    .leftJoin(schema.user, eq(schema.user.id, schema.clarificationRequest.requestedBy))
    .where(eq(schema.clarificationRequest.applicationId, applicationId))
    .orderBy(asc(schema.clarificationRequest.requestedAt));
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    requestedAt: r.requestedAt.toISOString(),
    requestedBy: !forApplicant && r.userId && r.userName ? { id: r.userId, name: r.userName } : null,
    notifiedAt: !forApplicant ? (r.notifiedAt?.toISOString() ?? null) : null,
    response: r.response,
    respondedAt: r.respondedAt?.toISOString() ?? null,
    open: r.respondedAt === null,
  }));
}
