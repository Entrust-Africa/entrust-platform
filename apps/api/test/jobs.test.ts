import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOB_NAMES, stopBoss } from "@entrust/jobs";
import { callV1, cleanup, createOrganization, signUp, type TestUser } from "./support";

let adminUser: TestUser;
let regularUser: TestUser;

beforeAll(async () => {
  await cleanup();
  [adminUser, regularUser] = await Promise.all([
    signUp("jobs-admin"),
    signUp("jobs-regular"),
  ]);
  const entrustOrgId = await createOrganization(
    "jobs-entrust",
    [[adminUser, "admin"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = entrustOrgId;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await stopBoss();
  await cleanup();
});

describe("Jobs API", () => {
  describe("Authentication and Permissions", () => {
    it("refuses signed-out requests", async () => {
      const resEmail = await callV1(null, "POST", "/jobs/test-email", {
        to: "recipient@example.test",
        subject: "Hello",
      });
      expect(resEmail.status).toBe(401);

      const resFail = await callV1(null, "POST", "/jobs/test-fail", {
        reason: "Test failure",
      });
      expect(resFail.status).toBe(401);

      const resGet = await callV1(null, "GET", "/jobs/send-email/non-existent-id");
      expect(resGet.status).toBe(401);
    });

    it("forbids non-admin signed-in users from accessing background job endpoints", async () => {
      const resEmail = await callV1(regularUser, "POST", "/jobs/test-email", {
        to: "recipient@example.test",
        subject: "Forbidden test",
      });
      expect(resEmail.status).toBe(403);
      expect(resEmail.body.error).toMatch(/admin/i);

      const resFail = await callV1(regularUser, "POST", "/jobs/test-fail", {
        reason: "Forbidden failure test",
      });
      expect(resFail.status).toBe(403);
      expect(resFail.body.error).toMatch(/admin/i);

      const resGet = await callV1(regularUser, "GET", "/jobs/send-email/some-id");
      expect(resGet.status).toBe(403);
      expect(resGet.body.error).toMatch(/admin/i);
    });
  });

  describe("Enqueuing and Status (Admin)", () => {
    it("enqueues a test-email job and retrieves its initial status", async () => {
      const res = await callV1(adminUser, "POST", "/jobs/test-email", {
        to: "developer@example.test",
        subject: "Welcome to Entrust Background Jobs",
        message: "Test message via API",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("jobId");
      expect(res.body.queue).toBe(JOB_NAMES.SEND_EMAIL);

      const { jobId } = res.body;

      // Query status
      const statusRes = await callV1(adminUser, "GET", `/jobs/${JOB_NAMES.SEND_EMAIL}/${jobId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.id).toBe(jobId);
      expect(statusRes.body.name).toBe(JOB_NAMES.SEND_EMAIL);
      expect(["created", "active", "completed"]).toContain(statusRes.body.state);
    });

    it("enqueues a test-fail job configured for retry demonstration", async () => {
      const res = await callV1(adminUser, "POST", "/jobs/test-fail", {
        reason: "Demonstrating retries from API",
        retryLimit: 2,
        retryDelay: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("jobId");
      expect(res.body.queue).toBe(JOB_NAMES.TEST_FAIL);

      const { jobId } = res.body;

      const statusRes = await callV1(adminUser, "GET", `/jobs/${JOB_NAMES.TEST_FAIL}/${jobId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.id).toBe(jobId);
      expect(statusRes.body.name).toBe(JOB_NAMES.TEST_FAIL);
    });

    it("rejects invalid queue name with 400", async () => {
      const res = await callV1(
        adminUser,
        "GET",
        "/jobs/unregistered-queue/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/queue/i);
    });

    it("returns 404 for a non-existent job ID in a valid queue", async () => {
      const res = await callV1(
        adminUser,
        "GET",
        `/jobs/${JOB_NAMES.SEND_EMAIL}/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("rejects invalid email addresses on test-email with 400", async () => {
      const res = await callV1(adminUser, "POST", "/jobs/test-email", {
        to: "not-a-valid-email",
        subject: "Invalid email test",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/to|email/i);
    });
  });
});
