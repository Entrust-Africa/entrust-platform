import { z } from "@hono/zod-openapi";

export const EnqueueTestEmailBody = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email())]).openapi({
      description: "Recipient email address(es)",
      example: "user@example.test",
    }),
    subject: z.string().min(1).default("Test Background Email").openapi({
      description: "Email subject line",
      example: "Welcome to Entrust Background Jobs",
    }),
    template: z
      .enum(["test", "verification", "invitation", "password-reset"])
      .default("test")
      .openapi({
        description: "Template to render",
        example: "test",
      }),
    props: z.record(z.string(), z.unknown()).default({}).openapi({
      description: "Template variables or payload parameters",
    }),
    shouldFail: z.boolean().default(false).openapi({
      description: "If true, simulates delivery failure to trigger pg-boss retry mechanism",
      example: false,
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
    queue: z.string().openapi({
      description: "Queue name of the job",
      example: "send-email",
    }),
    jobId: z.string().openapi({
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
      "expired",
      "cancelled",
      "failed",
    ]),
    retryCount: z.number().int(),
    output: z.unknown().optional(),
    createdOn: z.string().optional(),
    completedOn: z.string().optional(),
  })
  .openapi("JobStatusResponse");
