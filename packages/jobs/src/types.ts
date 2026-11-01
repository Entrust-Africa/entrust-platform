import { z } from "zod";

export const JOB_NAMES = {
  SEND_EMAIL: "send-email",
  TEST_FAIL: "test-fail",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

const BaseEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  from: z.string().optional(),
  text: z.string().optional(),
});

export const TestEmailPropsSchema = z.object({
  message: z.string().optional().default("Hello from Entrust Background Worker!"),
});

export const VerificationEmailPropsSchema = z.object({
  url: z.string().url(),
});

export const InvitationEmailPropsSchema = z.object({
  organizationName: z.string().min(1),
  inviterName: z.string().min(1),
  role: z.string().min(1),
  url: z.string().url(),
});

export const PasswordResetEmailPropsSchema = z.object({
  url: z.string().url(),
});

export const SummitClarificationEmailPropsSchema = z.object({
  applicationNumber: z.string().min(1),
  organizationName: z.string().min(1),
  message: z.string().min(1),
  /** Where the applicant answers. Absent when no Summit app address is configured. */
  url: z.string().url().optional(),
});

export const SummitResultEmailPropsSchema = z.object({
  applicationNumber: z.string().min(1),
  organizationName: z.string().min(1),
  /** What the applicant is told: selected, waitlisted or not selected. It names no score and no reason. */
  message: z.string().min(1),
  /** Where the applicant sees the result. Absent when no Summit app address is configured. */
  url: z.string().url().optional(),
});

const RawSendEmailJobSchema = z.discriminatedUnion("template", [
  BaseEmailSchema.extend({
    template: z.literal("test"),
    props: TestEmailPropsSchema.default({ message: "Hello from Entrust Background Worker!" }),
  }),
  BaseEmailSchema.extend({
    template: z.literal("verification"),
    props: VerificationEmailPropsSchema,
  }),
  BaseEmailSchema.extend({
    template: z.literal("invitation"),
    props: InvitationEmailPropsSchema,
  }),
  BaseEmailSchema.extend({
    template: z.literal("password-reset"),
    props: PasswordResetEmailPropsSchema,
  }),
  BaseEmailSchema.extend({
    template: z.literal("summit-clarification"),
    props: SummitClarificationEmailPropsSchema,
  }),
  BaseEmailSchema.extend({
    template: z.literal("summit-result"),
    props: SummitResultEmailPropsSchema,
  }),
]);

export const SendEmailJobSchema = z.preprocess((val: unknown) => {
  if (typeof val === "object" && val !== null && !("template" in val)) {
    return { ...(val as Record<string, unknown>), template: "test" };
  }
  return val;
}, RawSendEmailJobSchema);

export type SendEmailJobData = z.infer<typeof RawSendEmailJobSchema>;

export const TestFailJobSchema = z.object({
  reason: z.string().optional().default("Simulated intentional failure"),
});

export type TestFailJobData = z.infer<typeof TestFailJobSchema>;

export const JOB_SCHEMAS = {
  [JOB_NAMES.SEND_EMAIL]: SendEmailJobSchema,
  [JOB_NAMES.TEST_FAIL]: TestFailJobSchema,
} as const;

export interface JobDefinitions {
  [JOB_NAMES.SEND_EMAIL]: SendEmailJobData;
  [JOB_NAMES.TEST_FAIL]: TestFailJobData;
}

export type EnqueueInput<K extends JobName> = z.input<(typeof JOB_SCHEMAS)[K]>;

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
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  retryCount: number;
  output?: unknown;
  createdOn?: Date | string | null;
  completedOn?: Date | string | null;
}

export const DEFAULT_RETRY_CONFIG: Required<Pick<EnqueueOptions, "retryLimit" | "retryDelay" | "retryBackoff">> = {
  retryLimit: 3,
  retryDelay: 2,
  retryBackoff: true,
};
