import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOB_NAMES, stopBoss } from "@entrust/jobs";
import { callV1, cleanup, signUp, type TestUser } from "./support";

let testUser: TestUser;

beforeAll(async () => {
  await cleanup();
  testUser = await signUp("jobs-tester");
});

afterAll(async () => {
  await stopBoss();
  await cleanup();
});

describe("Jobs API", () => {
  describe("Authentication", () => {
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
  });

  describe("Enqueuing and Status", () => {
    it("enqueues a test-email job and retrieves its initial status", async () => {
      const res = await callV1(testUser, "POST", "/jobs/test-email", {
        to: "developer@example.test",
        subject: "Welcome to Entrust Background Jobs",
        template: "test",
        props: { message: "Test message via API" },
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("jobId");
      expect(res.body.queue).toBe(JOB_NAMES.SEND_EMAIL);

      const { jobId } = res.body;

      // Query status
      const statusRes = await callV1(testUser, "GET", `/jobs/${JOB_NAMES.SEND_EMAIL}/${jobId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.id).toBe(jobId);
      expect(statusRes.body.name).toBe(JOB_NAMES.SEND_EMAIL);
      expect(["created", "active", "completed"]).toContain(statusRes.body.state);
    });

    it("enqueues a test-fail job configured for retry demonstration", async () => {
      const res = await callV1(testUser, "POST", "/jobs/test-fail", {
        reason: "Demonstrating retries from API",
        retryLimit: 2,
        retryDelay: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("jobId");
      expect(res.body.queue).toBe(JOB_NAMES.TEST_FAIL);

      const { jobId } = res.body;

      const statusRes = await callV1(testUser, "GET", `/jobs/${JOB_NAMES.TEST_FAIL}/${jobId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.id).toBe(jobId);
      expect(statusRes.body.name).toBe(JOB_NAMES.TEST_FAIL);
    });

    it("returns 404 for a non-existent job ID", async () => {
      const res = await callV1(
        testUser,
        "GET",
        `/jobs/${JOB_NAMES.SEND_EMAIL}/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});
