import { z } from "zod";
import { MODULE_IDS } from "@entrust/trade-rules";
import { approvalSchema, lessonSchema, rubricCriterionSchema, workedExampleSchema, worksheetSchema } from "./schema";
import type { ModuleContent } from "./schema";

const text = z.string();

/**
 * What an SME gets of a version. `toLearnerView` builds it field by field, so nothing added to
 * ModuleContent later reaches an SME until it is listed here: the answer keys, the explanations (shown
 * after an attempt, not before), the auto-check IDs and the staff-only material stay behind. The
 * schema is strict, so a test fails if the view carries anything it doesn't list.
 */
export const learnerModuleSchema = z
  .object({
    module: z.enum(MODULE_IDS),
    version: text,
    title: text,
    deliverable: text,
    objectives: z.array(text),
    status: z.enum(["draft", "approved"]),
    approval: approvalSchema.nullable(),
    lessons: z.array(lessonSchema),
    workedExample: workedExampleSchema.nullable(),
    worksheets: z.array(worksheetSchema),
    knowledgeCheck: z
      .object({
        passMark: z.number(),
        questions: z.array(
          z
            .object({
              id: text,
              text,
              options: z.array(z.object({ id: text, text }).strict()),
              /** More than one option is right, so the screen offers check boxes. It doesn't say which. */
              multiple: z.boolean(),
            })
            .strict(),
        ),
      })
      .strict(),
    rubric: z
      .object({
        criteria: z.array(rubricCriterionSchema),
        passMark: z.number(),
        mustHaveMinimum: z.number(),
        bands: z.array(z.object({ label: text, from: z.number() }).strict()),
        criticalFailures: z.array(z.object({ id: text, text }).strict()),
      })
      .strict(),
    aiPrompts: z.array(z.object({ id: text, title: text, prompt: text, verification: z.array(text) }).strict()),
  })
  .strict();

export type LearnerModuleContent = z.infer<typeof learnerModuleSchema>;

export function toLearnerView(content: ModuleContent): LearnerModuleContent {
  return {
    module: content.module,
    version: content.version,
    title: content.title,
    deliverable: content.deliverable,
    objectives: content.objectives,
    status: content.status,
    approval: content.approval ?? null,
    lessons: content.lessons,
    workedExample: content.workedExample ?? null,
    worksheets: content.worksheets,
    knowledgeCheck: {
      passMark: content.knowledgeCheck.passMark,
      questions: content.knowledgeCheck.questions.map((q) => ({ id: q.id, text: q.text, options: q.options, multiple: q.correct.length > 1 })),
    },
    rubric: {
      criteria: content.rubric.criteria,
      passMark: content.rubric.passMark,
      mustHaveMinimum: content.rubric.mustHaveMinimum,
      bands: content.rubric.bands,
      criticalFailures: content.rubric.criticalFailures.map((f) => ({ id: f.id, text: f.text })),
    },
    aiPrompts: content.aiPrompts,
  };
}
