import { z } from "zod";

export const JOB_NAMES = {
  SEND_EMAIL: "send-email",
  TEST_FAIL: "test-fail",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const SendEmailJobSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  template: z.enum(["test", "verification", "invitation", "password-reset"]).optional().default("test"),
  props: z.record(z.string(), z.unknown()).optional().default({}),
  from: z.string().optional(),
  text: z.string().optional(),
});

export type SendEmailJobData = z.infer<typeof SendEmailJobSchema>;

export const TestFailJobSchema = z.object({
  reason: z.string().optional().default("Simulated intentional failure"),
});

export type TestFailJobData = z.infer<typeof TestFailJobSchema>;

export interface JobDefinitions {
  [JOB_NAMES.SEND_EMAIL]: SendEmailJobData;
  [JOB_NAMES.TEST_FAIL]: TestFailJobData;
}

export interface EnqueueOptions {
  priority?: number;
  startAfter?: number | string | Date;
  expireInSeconds?: number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  singletonKey?: string;
}

export interface JobStatusInfo {
  id: string;
  name: string;
  state: "created" | "retry" | "active" | "completed" | "expired" | "cancelled" | "failed";
  retryCount: number;
  output?: unknown;
  createdOn?: Date | string;
  completedOn?: Date | string;
}

export const DEFAULT_RETRY_CONFIG: Required<Pick<EnqueueOptions, "retryLimit" | "retryDelay" | "retryBackoff">> = {
  retryLimit: 3,
  retryDelay: 5,
  retryBackoff: true,
};
