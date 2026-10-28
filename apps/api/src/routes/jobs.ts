import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import { enqueue, getJobStatus, JOB_NAMES } from "@entrust/jobs";
import type { AppEnv } from "../app";
import {
  EnqueueJobResponse,
  EnqueueTestEmailBody,
  EnqueueTestFailBody,
  JobStatusParams,
  JobStatusResponse,
} from "../schemas/jobs";
import { Problem } from "../schemas/problem";
import { loadPrincipal } from "../services/access";
import { ServiceError } from "../services/errors";

const tags = ["Jobs"];

const problem = (description: string) => ({
  description,
  content: { "application/json": { schema: Problem } },
});

const jobErrors = {
  400: problem("Invalid input"),
  401: problem("Not signed in"),
  403: problem("Only Entrust admins can access background job controls"),
  404: problem("Job not found"),
};

const router = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues
      .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
      .join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

// Require signed-in session specifically for /jobs/* routes to prevent interference with sibling routers
router.use("/jobs/*", async (c, next) => {
  if (!c.get("user")) {
    throw new ServiceError("unauthenticated", "Not signed in.");
  }
  await next();
});

async function requireEntrustAdmin(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) {
    throw new ServiceError("unauthenticated", "Not signed in.");
  }
  const principal = await loadPrincipal(getDb(), user.id);
  if (principal.staffRole !== "admin") {
    throw new ServiceError("forbidden", "Only Entrust admins can access background job controls.");
  }
  return user;
}

const testEmailRoute = createRoute({
  method: "post",
  path: "/jobs/test-email",
  tags,
  summary: "Enqueue an example email background job",
  description:
    "Enqueues a test notification email job to be processed by the background worker runtime. Gated to Entrust admins.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: EnqueueTestEmailBody } },
    },
  },
  responses: {
    200: {
      description: "Job successfully enqueued",
      content: { "application/json": { schema: EnqueueJobResponse } },
    },
    ...jobErrors,
  },
});

const testFailRoute = createRoute({
  method: "post",
  path: "/jobs/test-fail",
  tags,
  summary: "Enqueue an intentional failing job to demonstrate retries",
  description:
    "Enqueues a job that fails on each attempt, demonstrating pg-boss retries with backoff and terminal failure state. Gated to Entrust admins.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: EnqueueTestFailBody } },
    },
  },
  responses: {
    200: {
      description: "Job successfully enqueued",
      content: { "application/json": { schema: EnqueueJobResponse } },
    },
    ...jobErrors,
  },
});

const jobStatusRoute = createRoute({
  method: "get",
  path: "/jobs/{queue}/{jobId}",
  tags,
  summary: "Retrieve background job status",
  description:
    "Queries pg-boss for job execution state, retry count, and sanitized output/error. Gated to Entrust admins.",
  request: {
    params: JobStatusParams,
  },
  responses: {
    200: {
      description: "Job status record",
      content: { "application/json": { schema: JobStatusResponse } },
    },
    ...jobErrors,
  },
});

export const jobs = router
  .openapi(testEmailRoute, async (c) => {
    await requireEntrustAdmin(c);
    const body = c.req.valid("json");
    const jobId = await enqueue(
      JOB_NAMES.SEND_EMAIL,
      {
        to: body.to,
        subject: body.subject,
        template: "test",
        props: {
          message: body.message,
        },
      },
      {
        retryLimit: 3,
        retryDelay: 2,
        retryBackoff: true,
      },
    );

    if (!jobId) {
      throw new ServiceError("invalid", "Failed to enqueue background job.");
    }

    return c.json({ jobId, queue: JOB_NAMES.SEND_EMAIL }, 200);
  })
  .openapi(testFailRoute, async (c) => {
    await requireEntrustAdmin(c);
    const body = c.req.valid("json");
    const jobId = await enqueue(
      JOB_NAMES.TEST_FAIL,
      {
        reason: body.reason,
      },
      {
        retryLimit: body.retryLimit,
        retryDelay: body.retryDelay,
        retryBackoff: true,
      },
    );

    if (!jobId) {
      throw new ServiceError("invalid", "Failed to enqueue background job.");
    }

    return c.json({ jobId, queue: JOB_NAMES.TEST_FAIL }, 200);
  })
  .openapi(jobStatusRoute, async (c) => {
    await requireEntrustAdmin(c);
    const { queue, jobId } = c.req.valid("param");
    const status = await getJobStatus(queue, jobId);
    if (!status) {
      throw new ServiceError("not_found", `Job not found: ${jobId}`);
    }

    // Sanitize output to prevent leaking internal stack traces or database errors
    let sanitizedOutput: unknown = status.output;
    if (status.state === "failed" && typeof status.output === "object" && status.output !== null) {
      const errObj = status.output as Record<string, unknown>;
      sanitizedOutput = {
        message: typeof errObj.message === "string" ? errObj.message : "Job failed",
      };
    }

    return c.json(
      {
        id: status.id,
        name: status.name,
        state: status.state,
        retryCount: status.retryCount,
        output: sanitizedOutput,
        createdOn: status.createdOn ? new Date(status.createdOn).toISOString() : undefined,
        completedOn: status.completedOn ? new Date(status.completedOn).toISOString() : undefined,
      },
      200,
    );
  });
