import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { CONSENT_WORDING_VERSION, SUMMIT_PROFILE_WORDING } from "@entrust/trade-engine";
import type { SharingView } from "../schemas/summit";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { findApplication, type ApplicationRow } from "./summit-access";
import { recordSummitChange } from "./summit-status";

// Sharing the Summit profile outside Entrust (#80). The profile is Entrust's own working document. A copy for a buyer, an
// investor or a partner is made only while the business's owner has agreed to it, and stops being made the moment they take
// the agreement back. The agreement is a row of `trade.sponsor_consent` (the model #70 built: one live row per business and kind,
// the wording kept with it), made with the Entrust organisation, since Entrust is the one who shares.

const KIND = "summit_profile" as const;

const entrustOrganizationId = (): string => {
  const id = process.env.ENTRUST_ORG_ID;
  if (!id) throw new ServiceError("precondition_failed", "Sharing isn't set up: this system doesn't know which organisation is Entrust.");
  return id;
};

/** The live agreement for an application's business, or null. */
export async function liveSharing(db: Executor, row: Pick<ApplicationRow, "organizationId">) {
  const [consent] = await db
    .select()
    .from(schema.sponsorConsent)
    .where(and(eq(schema.sponsorConsent.smeOrganizationId, row.organizationId), eq(schema.sponsorConsent.kind, KIND), isNull(schema.sponsorConsent.withdrawnAt)))
    .limit(1);
  return consent ?? null;
}

const view = (consent: Awaited<ReturnType<typeof liveSharing>>, canChange: boolean): SharingView => ({
  shared: consent !== null,
  grantedAt: consent?.grantedAt.toISOString() ?? null,
  canChange,
  wording: SUMMIT_PROFILE_WORDING,
  wordingVersion: CONSENT_WORDING_VERSION,
});

/** Whether the business has agreed to share its profile outside Entrust. The applicant's owner and Entrust staff can ask. */
export async function getSharing(ctx: Ctx, id: string): Promise<SharingView> {
  const { row, access } = await findApplication(ctx.db, ctx.principal, id);
  const owner = access.applicant && ctx.principal.smeRoles.get(row.organizationId) === "owner";
  return view(await liveSharing(ctx.db, row), owner && row.status === "selected");
}

/**
 * The owner of the business agrees to share its profile outside Entrust, or takes the agreement back. It is only for a
 * business the committee has selected, and only its owner can decide. Every change is audited with the words agreed to.
 */
export async function setSharing(ctx: Ctx, id: string, share: boolean): Promise<SharingView> {
  return ctx.db.transaction(async (tx) => {
    const { row, access } = await findApplication(tx, ctx.principal, id, { lock: true });
    if (!access.applicant) throw new ServiceError("forbidden", "Only the business that applied can decide whether its profile is shared.");
    if (ctx.principal.smeRoles.get(row.organizationId) !== "owner") throw new ServiceError("forbidden", "Only the owner of the organisation can decide what is shared.");
    if (row.status !== "selected") throw new ServiceError("invalid_transition", "A profile is made once the committee has selected the business.");

    const current = await liveSharing(tx, row);
    if (share && !current) {
      const [created] = await tx
        .insert(schema.sponsorConsent)
        .values({
          sponsorOrganizationId: entrustOrganizationId(),
          smeOrganizationId: row.organizationId,
          kind: KIND,
          grantedByUserId: ctx.principal.userId,
          grantedAt: ctx.now,
          wordingVersion: CONSENT_WORDING_VERSION,
          wording: SUMMIT_PROFILE_WORDING,
        })
        .returning();
      await recordSummitChange(tx, ctx.principal.userId, {
        action: "summit.sharing.granted",
        entityType: "summit_application",
        entityId: id,
        organizationId: row.organizationId,
        after: { consentId: created?.id, wordingVersion: CONSENT_WORDING_VERSION },
      });
      return view(created ?? null, true);
    }
    if (!share && current) {
      await tx.update(schema.sponsorConsent).set({ withdrawnAt: ctx.now, withdrawnByUserId: ctx.principal.userId }).where(eq(schema.sponsorConsent.id, current.id));
      await recordSummitChange(tx, ctx.principal.userId, {
        action: "summit.sharing.withdrawn",
        entityType: "summit_application",
        entityId: id,
        organizationId: row.organizationId,
        before: { consentId: current.id },
      });
      return view(null, true);
    }
    return view(current, true);
  });
}
