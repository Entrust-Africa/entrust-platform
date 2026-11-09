import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

// A second step for Entrust staff (architecture spec sections 17 and 21). Staff sign in with AfriConnect or Google, so the
// second step is an authenticator app: TOTP, RFC 6238, with the secret stored encrypted. A session counts as verified once
// a code (or a recovery code) has been accepted on it, and stops counting when the session ends.

const STEP_SECONDS = 30;
const DIGITS = 6;
/** One step either side of now, for clocks that differ a little. */
const WINDOW = 1;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 10;
const RECOVERY_CODES = 8;
const ISSUER = "Entrust TRADE";

/** Whether staff must pass the second step. Off unless STAFF_MFA_REQUIRED=true, so it can be switched on once staff have time to set it up. */
export const mfaRequired = (): boolean => process.env.STAFF_MFA_REQUIRED === "true";

// ---- TOTP ----

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/[\s=-]/g, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Not a base32 string.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The code for one 30-second step. */
export function totpAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const binary = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const stepAt = (now: Date): number => Math.floor(now.getTime() / 1000 / STEP_SECONDS);

/** The step a code belongs to, within the window, or null. */
export function matchingStep(secret: Buffer, code: string, now: Date): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = stepAt(now);
  for (let step = current - WINDOW; step <= current + WINDOW; step++) {
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

// ---- Keeping the secret ----

function encryptionKey(): Buffer {
  const source = process.env.MFA_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!source) throw new ServiceError("invalid", "Two-step sign-in has no encryption key configured.");
  return createHash("sha256").update(`staff-mfa:${source}`).digest();
}

export function encryptSecret(secret: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(stored: string): Buffer {
  const [iv, tag, body] = stored.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !body) throw new ServiceError("invalid", "The stored secret is unreadable.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

const hashRecovery = (code: string): string => createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex");

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODES }, () => {
    const raw = randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

// ---- What the API does ----

export interface MfaStatus {
  required: boolean;
  enrolled: boolean;
  verified: boolean;
}

export async function mfaStatus(db: Executor, userId: string, sessionId: string): Promise<MfaStatus> {
  const [row] = await db.select({ confirmedAt: schema.staffMfa.confirmedAt }).from(schema.staffMfa).where(eq(schema.staffMfa.userId, userId));
  const [verified] = await db
    .select({ sessionId: schema.staffMfaSession.sessionId })
    .from(schema.staffMfaSession)
    .where(and(eq(schema.staffMfaSession.sessionId, sessionId), eq(schema.staffMfaSession.userId, userId)));
  return { required: mfaRequired(), enrolled: Boolean(row?.confirmedAt), verified: Boolean(verified) };
}

/** Starts setup (or restarts it before it was confirmed). Refuses once a secret is confirmed: that changes only after a reset. */
export async function beginEnrolment(db: Executor, userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }> {
  const [existing] = await db.select().from(schema.staffMfa).where(eq(schema.staffMfa.userId, userId));
  if (existing?.confirmedAt) throw new ServiceError("conflict", "Two-step sign-in is already set up. Ask an administrator to reset it.");
  const secret = randomBytes(20);
  const secretEncrypted = encryptSecret(secret);
  if (existing) await db.update(schema.staffMfa).set({ secretEncrypted, failedAttempts: 0, lockedUntil: null }).where(eq(schema.staffMfa.userId, userId));
  else await db.insert(schema.staffMfa).values({ userId, secretEncrypted });
  const base32 = base32Encode(secret);
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return { secret: base32, otpauthUrl: `otpauth://totp/${label}?secret=${base32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}` };
}

async function markVerified(db: Executor, userId: string, sessionId: string): Promise<void> {
  await db.insert(schema.staffMfaSession).values({ sessionId, userId }).onConflictDoNothing();
}

/** Counts a wrong code, and locks the account for a while after too many. */
async function recordFailure(db: Executor, row: typeof schema.staffMfa.$inferSelect, now: Date): Promise<never> {
  const failedAttempts = row.failedAttempts + 1;
  const locked = failedAttempts >= MAX_FAILURES;
  await db
    .update(schema.staffMfa)
    .set({ failedAttempts: locked ? 0 : failedAttempts, lockedUntil: locked ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : row.lockedUntil })
    .where(eq(schema.staffMfa.userId, row.userId));
  throw new ServiceError("invalid", locked ? `Too many wrong codes. Try again in ${LOCK_MINUTES} minutes.` : "That code isn't right.");
}

function assertNotLocked(row: typeof schema.staffMfa.$inferSelect, now: Date): void {
  if (row.lockedUntil && row.lockedUntil > now) throw new ServiceError("invalid", "Too many wrong codes. Try again in a few minutes.");
}

/** Confirms setup with the first code, marks the session verified and returns the recovery codes, shown once. */
export async function confirmEnrolment(db: Executor, userId: string, sessionId: string, code: string, now = new Date()): Promise<{ recoveryCodes: string[] }> {
  const [row] = await db.select().from(schema.staffMfa).where(eq(schema.staffMfa.userId, userId));
  if (!row) throw new ServiceError("invalid", "Start setting up two-step sign-in first.");
  if (row.confirmedAt) throw new ServiceError("conflict", "Two-step sign-in is already set up.");
  assertNotLocked(row, now);
  const step = matchingStep(decryptSecret(row.secretEncrypted), code, now);
  if (step === null) return recordFailure(db, row, now);
  const recoveryCodes = newRecoveryCodes();
  await db
    .update(schema.staffMfa)
    .set({ confirmedAt: now, lastStep: step, failedAttempts: 0, lockedUntil: null, recoveryHashes: recoveryCodes.map(hashRecovery) })
    .where(eq(schema.staffMfa.userId, userId));
  await markVerified(db, userId, sessionId);
  return { recoveryCodes };
}

/** Passes the second step on this session with an authenticator code or a recovery code. */
export async function verifySession(db: Executor, userId: string, sessionId: string, input: { code?: string | undefined; recoveryCode?: string | undefined }, now = new Date()): Promise<void> {
  const [row] = await db.select().from(schema.staffMfa).where(eq(schema.staffMfa.userId, userId));
  if (!row?.confirmedAt) throw new ServiceError("invalid", "Two-step sign-in isn't set up yet.");
  assertNotLocked(row, now);

  if (input.recoveryCode) {
    const hash = hashRecovery(input.recoveryCode);
    if (!row.recoveryHashes.includes(hash)) return recordFailure(db, row, now);
    await db
      .update(schema.staffMfa)
      .set({ recoveryHashes: row.recoveryHashes.filter((h) => h !== hash), failedAttempts: 0, lockedUntil: null })
      .where(eq(schema.staffMfa.userId, userId));
    await markVerified(db, userId, sessionId);
    return;
  }

  const step = input.code ? matchingStep(decryptSecret(row.secretEncrypted), input.code, now) : null;
  // A code that was already used is refused, so watching someone type it gives nothing.
  if (step === null || (row.lastStep !== null && step <= row.lastStep)) return recordFailure(db, row, now);
  await db.update(schema.staffMfa).set({ lastStep: step, failedAttempts: 0, lockedUntil: null }).where(eq(schema.staffMfa.userId, userId));
  await markVerified(db, userId, sessionId);
}

/** An administrator clears someone's setup so they can set it up again, for a lost phone and lost recovery codes. Their sessions must verify again. */
export async function resetMfa(db: Executor, userId: string): Promise<void> {
  await db.delete(schema.staffMfaSession).where(eq(schema.staffMfaSession.userId, userId));
  await db.delete(schema.staffMfa).where(eq(schema.staffMfa.userId, userId));
}
