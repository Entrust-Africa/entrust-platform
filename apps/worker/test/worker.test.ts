import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoss, enqueue, getJobStatus, JOB_NAMES, stopBoss } from "@entrust/jobs";
import { registerHandlers } from "../src";

describe("Worker Runtime End-to-End Handlers", () => {
  let workerBoss: ReturnType<typeof createBoss>;

  beforeAll(async () => {
    workerBoss = createBoss();
    await workerBoss.start();
    // Register the actual worker handlers from apps/worker
    await registerHandlers(workerBoss);
  });

  afterAll(async () => {
    await workerBoss.stop({ graceful: true, timeout: 5000 });
    await stopBoss();
  });

  it("processes a real send-email job through handleSendEmail and records emailId/logged", async () => {
    const jobId = await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: "worker-test@example.test",
      subject: "Real Worker Test Email",
      template: "test",
      props: { message: "Verifying real worker execution" },
    });

    expect(jobId).toBeDefined();

    // Poll until completed
    let status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "completed" && Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    }

    expect(status?.state).toBe("completed");
    expect(status?.id).toBe(jobId);
    expect(status?.output).toBeDefined();

    const output = status?.output as Record<string, unknown>;
    expect(output.success).toBe(true);
    expect(output.logged).toBe(true);
    expect(output.emailId).toBeDefined();
    expect(output.recipients).toEqual(["worker-test@example.test"]);
  });

  it("sends the Summit clarification email through the worker", async () => {
    const jobId = await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: ["applicant@example.test"],
      subject: "More information is needed for SUM-000042",
      template: "summit-clarification",
      props: { applicationNumber: "SUM-000042", organizationName: "ZEBU Coffee", message: "Please upload your export licence." },
    });

    let status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "completed" && Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    }

    expect(status?.state).toBe("completed");
    expect(status?.output).toMatchObject({ success: true, logged: true, recipients: ["applicant@example.test"] });
  });

  it("sends the Summit result email through the worker", async () => {
    const jobId = await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: ["applicant@example.test"],
      subject: "The result of Summit application SUM-000042",
      template: "summit-result",
      props: { applicationNumber: "SUM-000042", organizationName: "ZEBU Coffee", message: "Your business is on the waiting list for the Summit." },
    });

    let status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "completed" && Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    }

    expect(status?.state).toBe("completed");
    expect(status?.output).toMatchObject({ success: true, logged: true, recipients: ["applicant@example.test"] });
  });

  it("processes a real test-fail job through handleTestFail and preserves failure message", async () => {
    const failureReason = "Worker retry verification test";
    const jobId = await enqueue(
      JOB_NAMES.TEST_FAIL,
      {
        reason: failureReason,
      },
      {
        retryLimit: 1,
        retryDelay: 1,
        retryBackoff: true,
      },
    );

    expect(jobId).toBeDefined();

    // Poll until failed
    let status = await getJobStatus(JOB_NAMES.TEST_FAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "failed" && Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 300));
      status = await getJobStatus(JOB_NAMES.TEST_FAIL, jobId!);
    }

    expect(status?.state).toBe("failed");
    expect(status?.retryCount).toBeGreaterThanOrEqual(1);
    expect(status?.output).toBeDefined();

    const outputStr = JSON.stringify(status?.output);
    expect(outputStr).toMatch(new RegExp(failureReason, "i"));
  }, 20000);
});
