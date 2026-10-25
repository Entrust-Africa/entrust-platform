import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
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
import { ServiceError } from "../services/errors";

const tags = ["Jobs"];

const problem = (description: string) => ({
  description,
  content: { "application/json": { schema: Problem } },
});

const jobErrors = {
  400: problem("Invalid input"),
  401: problem("Not signed in"),
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

// Require signed-in session for job endpoints
router.use("*", async (c, next) => {
  if (!c.get("user")) {
    throw new ServiceError("unauthenticated", "Not signed in.");
  }
  await next();
});

const testEmailRoute = createRoute({
  method: "post",
  path: "/jobs/test-email",
  tags,
  summary: "Enqueue an example email background job",
  description:
    "Enqueues a transactional or test email job to be processed by the background worker runtime.",
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
    "Enqueues a job that fails on each attempt, demonstrating pg-boss retries with backoff and terminal failure state.",
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
  description: "Queries pg-boss for job execution state, retry count, and output/error.",
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
    const body = c.req.valid("json");
    const jobId = await enqueue(
      JOB_NAMES.SEND_EMAIL,
      {
        to: body.to,
        subject: body.subject,
        template: body.template,
        props: {
          ...body.props,
          shouldFail: body.shouldFail,
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
    const { queue, jobId } = c.req.valid("param");
    const status = await getJobStatus(queue, jobId);
    if (!status) {
      throw new ServiceError("not_found", `Job not found: ${jobId}`);
    }

    return c.json(
      {
        id: status.id,
        name: status.name,
        state: status.state,
        retryCount: status.retryCount,
        output: status.output,
        createdOn: status.createdOn ? new Date(status.createdOn).toISOString() : undefined,
        completedOn: status.completedOn ? new Date(status.completedOn).toISOString() : undefined,
      },
      200,
    );
  });
