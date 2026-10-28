import { z } from "@hono/zod-openapi";
import { JOB_NAMES } from "@entrust/jobs";

export const EnqueueTestEmailBody = z
  .object({
    to: z.string().email().openapi({
      description: "Single recipient email address for testing",
      example: "developer@example.test",
    }),
    subject: z.string().min(1).default("Test Background Email").openapi({
      description: "Email subject line",
      example: "Welcome to Entrust Background Jobs",
    }),
    message: z.string().optional().default("Hello from Entrust Background Worker!").openapi({
      description: "Custom test notification message",
      example: "Testing background job dispatch",
    }),
  })
  .openapi("EnqueueTestEmailBody");

export const EnqueueTestFailBody = z
  .object({
    reason: z
      .string()
      .default("Intentional test failure for retry demonstration")
      .openapi({
        description: "Failure reason message",
        example: "Intentional test failure",
      }),
    retryLimit: z.number().int().min(0).max(10).default(2).openapi({
      description: "Number of retries before landing in failed state",
      example: 2,
    }),
    retryDelay: z.number().int().min(0).max(60).default(1).openapi({
      description: "Delay in seconds between retries",
      example: 1,
    }),
  })
  .openapi("EnqueueTestFailBody");

export const EnqueueJobResponse = z
  .object({
    jobId: z.string().openapi({
      description: "Unique job identifier in pg-boss",
      example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    }),
    queue: z.string().openapi({
      description: "Name of the target job queue",
      example: "send-email",
    }),
  })
  .openapi("EnqueueJobResponse");

export const JobStatusParams = z
  .object({
    queue: z.enum([JOB_NAMES.SEND_EMAIL, JOB_NAMES.TEST_FAIL]).openapi({
      param: { name: "queue", in: "path" },
      description: "Valid registered job queue name",
      example: "send-email",
    }),
    jobId: z.string().min(1).max(128).openapi({
      param: { name: "jobId", in: "path" },
      description: "Job ID",
      example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    }),
  })
  .openapi("JobStatusParams");

export const JobStatusResponse = z
  .object({
    id: z.string(),
    name: z.string(),
    state: z.enum([
      "created",
      "retry",
      "active",
      "completed",
      "cancelled",
      "failed",
    ]),
    retryCount: z.number().int(),
    output: z.unknown().optional(),
    createdOn: z.string().optional(),
    completedOn: z.string().optional(),
  })
  .openapi("JobStatusResponse");
