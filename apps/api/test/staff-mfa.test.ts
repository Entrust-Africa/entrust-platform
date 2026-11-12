import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { forgetMfaCaches } from "../src/services/mfa-gate";
import { base32Decode, base32Encode, matchingStep, totpAt } from "../src/services/staff-mfa";
import { callV1, cleanup, createOrganization, signIn, signUp, type TestUser } from "./support";

// A second step for Entrust staff (#195): an authenticator app, checked by us because staff sign in through AfriConnect or Google.

const w = {} as { admin: TestUser; reviewer: TestUser; learner: TestUser; org: string };
const codeNow = (secret: string, offset = 0) => totpAt(base32Decode(secret), Math.floor(Date.now() / 30_000) + offset);

beforeAll(async () => {
  await cleanup();
  const [admin, reviewer, learner] = (await Promise.all(["mfa-admin", "mfa-reviewer", "mfa-learner"].map(signUp))) as [TestUser, TestUser, TestUser];
  Object.assign(w, { admin, reviewer, learner });
  w.org = await createOrganization("mfa-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.org;
});

beforeEach(() => {
  process.env.STAFF_MFA_REQUIRED = "true";
  forgetMfaCaches();
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  delete process.env.STAFF_MFA_REQUIRED;
  await cleanup();
});

describe("one-time codes", () => {
  it("matches RFC 6238's test code", () => {
    // The RFC's secret is the ASCII string 12345678901234567890; at 59 seconds its 8-digit code is 94287082.
    const secret = Buffer.from("12345678901234567890");
    expect(totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(matchingStep(secret, "287082", new Date(59_000))).toBe(1);
    expect(matchingStep(secret, "287083", new Date(59_000))).toBeNull();
    // One step of drift is fine; two are not.
    expect(matchingStep(secret, "287082", new Date(59_000 + 30_000))).toBe(1);
    expect(matchingStep(secret, "287082", new Date(59_000 + 90_000))).toBeNull();
  });

  it("reads and writes base32", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
  });
});

describe("the second step", () => {
  const secrets: Record<string, string> = {};
  const recovery: Record<string, string[]> = {};

  it("turns nothing away while it's switched off", async () => {
    process.env.STAFF_MFA_REQUIRED = "false";
    expect((await callV1(w.admin, "GET", "/trade/programs")).status).toBe(200);
    expect((await callV1(w.admin, "GET", "/me")).body.mfa).toMatchObject({ required: false, enrolled: false, verified: false });
  });

  it("tells staff they must set it up, and lets everyone else carry on", async () => {
    expect((await callV1(w.admin, "GET", "/me")).body.mfa).toMatchObject({ required: true, enrolled: false, verified: false });
    expect((await callV1(w.learner, "GET", "/me")).body.mfa).toBeNull();
    const blocked = await callV1(w.admin, "GET", "/trade/programs");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("mfa_required");
    expect((await callV1(w.learner, "GET", "/trade/programs")).body.code).not.toBe("mfa_required");
  });

  it("guards the shared routes that hold TRADE data too, and leaves the setup routes and CLEAR open", async () => {
    for (const path of ["/files/00000000-0000-4000-8000-000000000000", "/audit", "/smes/search?q=a", "/organizations"]) {
      expect((await callV1(w.reviewer, "GET", path)).body.code, path).toBe("mfa_required");
    }
    expect((await callV1(w.reviewer, "GET", "/me")).body.code).not.toBe("mfa_required");
    expect((await callV1(w.reviewer, "GET", "/mfa")).body.code).not.toBe("mfa_required");
    expect((await callV1(w.reviewer, "GET", "/clear/cases")).body.code).not.toBe("mfa_required");
  });

  it("keeps it to staff", async () => {
    expect((await callV1(w.learner, "POST", "/mfa/enrol")).status).toBe(403);
    expect((await callV1(null, "GET", "/mfa")).status).toBe(401);
  });

  it("sets up with a code from the app, then gives recovery codes once", async () => {
    const start = await callV1(w.admin, "POST", "/mfa/enrol");
    expect(start.status).toBe(200);
    expect(start.body.otpauthUrl).toContain("otpauth://totp/");
    secrets.admin = start.body.secret;
    // Wrong code: nothing is confirmed.
    expect((await callV1(w.admin, "POST", "/mfa/confirm", { code: "000000" })).status).toBe(422);
    const done = await callV1(w.admin, "POST", "/mfa/confirm", { code: codeNow(secrets.admin!) });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.recoveryCodes).toHaveLength(8);
    recovery.admin = done.body.recoveryCodes;
    // This session is verified, so the API answers again.
    expect((await callV1(w.admin, "GET", "/trade/programs")).status).toBe(200);
    expect((await callV1(w.admin, "GET", "/mfa")).body).toEqual({ required: true, enrolled: true, verified: true });
    // Setting up again is refused.
    expect((await callV1(w.admin, "POST", "/mfa/enrol")).status).toBe(409);
  });

  it("asks a new session for a code, refuses a used one, and takes the next", async () => {
    const reviewer = await callV1(w.reviewer, "POST", "/mfa/enrol");
    secrets.reviewer = reviewer.body.secret;
    expect((await callV1(w.reviewer, "POST", "/mfa/confirm", { code: codeNow(secrets.reviewer!) })).status).toBe(200);
    // The reviewer signs in again: a new session that hasn't passed the step.
    const again = await signIn("mfa-reviewer");
    expect((await callV1(again, "GET", "/trade/programs")).body.code).toBe("mfa_required");
    // The code that confirmed setup can't be used again.
    const reused = await callV1(again, "POST", "/mfa/verify", { code: codeNow(secrets.reviewer!) });
    expect(reused.status).toBe(422);
    const next = await callV1(again, "POST", "/mfa/verify", { code: codeNow(secrets.reviewer!, 1) });
    expect(next.status, JSON.stringify(next.body)).toBe(200);
    expect(next.body.verified).toBe(true);
    expect((await callV1(again, "GET", "/trade/programs")).body.code).not.toBe("mfa_required");
  });

  it("takes a recovery code once", async () => {
    const session = await signIn("mfa-admin");
    const [code] = recovery.admin!;
    expect((await callV1(session, "POST", "/mfa/verify", { recoveryCode: code })).status).toBe(200);
    forgetMfaCaches();
    const another = await signIn("mfa-admin");
    expect((await callV1(another, "POST", "/mfa/verify", { recoveryCode: code })).status).toBe(422);
  });

  it("locks after five wrong codes", async () => {
    const session = await signIn("mfa-admin");
    for (let i = 0; i < 5; i++) expect((await callV1(session, "POST", "/mfa/verify", { code: "111111" })).status).toBe(422);
    const locked = await callV1(session, "POST", "/mfa/verify", { code: codeNow(secrets.admin!, 1) });
    expect(locked.status).toBe(422);
    expect(locked.body.error).toContain("Try again");
  });

  it("refuses a reset from an administrator's session that hasn't passed the second step", async () => {
    const unverified = await signIn("mfa-admin");
    const adminId = (await callV1(unverified, "GET", "/me")).body.id;
    const reviewerId = (await callV1(w.reviewer, "GET", "/me")).body.id;
    for (const id of [adminId, reviewerId]) {
      const refused = await callV1(unverified, "DELETE", `/mfa/${id}`);
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe("mfa_required");
    }
    expect((await callV1(w.admin, "GET", "/mfa")).body.enrolled).toBe(true);
  });

  it("lets only an administrator reset someone, who then sets up again", async () => {
    const reviewerId = (await callV1(w.reviewer, "GET", "/me")).body.id;
    expect((await callV1(w.reviewer, "DELETE", `/mfa/${reviewerId}`)).status).toBe(403);
    expect((await callV1(w.admin, "DELETE", `/mfa/${reviewerId}`)).status).toBe(200);
    expect((await callV1(w.reviewer, "GET", "/mfa")).body).toEqual({ required: true, enrolled: false, verified: false });
    expect((await callV1(w.reviewer, "POST", "/mfa/enrol")).status).toBe(200);
  });
});
