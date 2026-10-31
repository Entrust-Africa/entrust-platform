import { z } from "zod";
import { MODULE_IDS } from "@entrust/trade-rules";

// What a module's learning package is made of. Content is data: a published version never changes and
// a correction is a new version. zod checks every version when the package loads, so a package that
// doesn't validate never reaches a learner.

const text = z.string().trim().min(1);
/** A short stable ID, used in stored answers and links: lesson-1, q3, revenue. */
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "use lower-case letters, digits, - and _");
const versionNumber = z.string().regex(/^\d+\.\d+\.\d+$/, "the version is major.minor.patch");

export const lessonSchema = z
  .object({
    id: slug,
    title: text,
    /** Markdown. */
    body: text,
    /** Time to read or watch, in minutes. */
    minutes: z.number().int().positive().optional(),
    videoUrl: z.url().optional(),
  })
  .strict();

export const workedExampleSchema = z.object({ title: text, body: text }).strict();

// Worksheets are structured forms, not uploaded files (#64). The arithmetic is a named calculator in
// @entrust/trade-engine, never AI.

export const FIELD_KINDS = ["text", "long_text", "number", "money", "percent", "date", "choice", "checkbox"] as const;

export const worksheetFieldSchema = z
  .object({
    id: slug,
    label: text,
    kind: z.enum(FIELD_KINDS),
    required: z.boolean().optional(),
    help: text.optional(),
    /** The answers a choice field offers. */
    options: z.array(z.object({ value: slug, label: text }).strict()).optional(),
  })
  .strict();

export const worksheetTableSchema = z
  .object({
    id: slug,
    label: text,
    columns: z.array(worksheetFieldSchema).min(1),
    minRows: z.number().int().nonnegative().optional(),
    maxRows: z.number().int().positive().optional(),
  })
  .strict();

export const COMPUTED_KINDS = ["money", "number", "percent", "days"] as const;

export const computedFieldSchema = z
  .object({
    id: slug,
    label: text,
    kind: z.enum(COMPUTED_KINDS),
    /** The pure function in @entrust/trade-engine that fills the field. */
    calculator: text,
    /** The fields, tables and other computed fields it reads. */
    inputs: z.array(slug),
  })
  .strict();

export const worksheetSchema = z
  .object({
    id: slug,
    title: text,
    description: text.optional(),
    fields: z.array(worksheetFieldSchema),
    tables: z.array(worksheetTableSchema),
    computed: z.array(computedFieldSchema),
  })
  .strict();

export const knowledgeQuestionSchema = z
  .object({
    id: slug,
    text,
    options: z.array(z.object({ id: slug, text }).strict()).min(2),
    /** The option IDs that are right. More than one makes it a multiple-answer question. */
    correct: z.array(slug).min(1, "a question needs a correct answer"),
    /** Absent where the content has none: feedback then shows the right answer and links to the lesson. */
    explanation: text.optional(),
  })
  .strict();

export const knowledgeCheckSchema = z
  .object({
    /** The share of questions to get right, 1 to 100. */
    passMark: z.number().min(1).max(100),
    questions: z.array(knowledgeQuestionSchema).min(1),
  })
  .strict();

export const rubricCriterionSchema = z
  .object({
    id: slug,
    title: text,
    description: text.optional(),
    maxPoints: z.number().int().positive(),
    /** The output can't pass with less than the rubric's `mustHaveMinimum` on this criterion. */
    mustHave: z.boolean(),
  })
  .strict();

export const rubricSchema = z
  .object({
    criteria: z.array(rubricCriterionSchema).min(1),
    /** Points needed to pass. */
    passMark: z.number().int().positive(),
    /** Points needed on each must-have criterion. */
    mustHaveMinimum: z.number().int().nonnegative(),
    /** Labels for a score as a share of the maximum, lowest first. The first starts at 0. */
    bands: z.array(z.object({ label: text, from: z.number().min(0).max(100) }).strict()).min(1),
    criticalFailures: z
      .array(
        z
          .object({
            id: slug,
            text,
            /** Set when software can spot the failure; the assessor still confirms it. */
            autoCheck: slug.optional(),
          })
          .strict(),
      ),
  })
  .strict();

export const aiPromptSchema = z
  .object({
    id: slug,
    title: text,
    prompt: text,
    /** What the learner checks in the AI's answer before using it. */
    verification: z.array(text),
  })
  .strict();

/** For facilitators and assessors only; it never reaches an SME. */
export const staffMaterialSchema = z
  .object({
    facilitatorGuide: text.optional(),
    liveSessionPlan: text.optional(),
    hybridSequence: text.optional(),
  })
  .strict();

export const approvalSchema = z.object({ by: text, at: z.iso.date() }).strict();

const duplicates = (values: readonly string[]) => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

export const moduleContentSchema = z
  .object({
    module: z.enum(MODULE_IDS),
    /** major.minor.patch. A learner keeps the version they started. */
    version: versionNumber,
    title: text,
    deliverable: text,
    objectives: z.array(text).min(1),
    /** A draft is staff-only and can still change. Approval publishes it, and from then on it never changes. */
    status: z.enum(["draft", "approved"]),
    /** Who approved it and when. Present exactly when the status is approved. */
    approval: approvalSchema.optional(),
    lessons: z.array(lessonSchema).min(1),
    workedExample: workedExampleSchema.optional(),
    worksheets: z.array(worksheetSchema),
    knowledgeCheck: knowledgeCheckSchema,
    rubric: rubricSchema,
    aiPrompts: z.array(aiPromptSchema),
    staff: staffMaterialSchema,
  })
  .strict()
  .superRefine((content, ctx) => {
    const problem = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

    if (content.status === "approved" && !content.approval) problem(["approval"], "an approved version records who approved it and when");
    if (content.status === "draft" && content.approval) problem(["approval"], "a draft has no approval record");

    for (const id of duplicates(content.lessons.map((l) => l.id))) problem(["lessons"], `duplicate lesson ${id}`);
    for (const id of duplicates(content.worksheets.map((w) => w.id))) problem(["worksheets"], `duplicate worksheet ${id}`);
    for (const id of duplicates(content.aiPrompts.map((p) => p.id))) problem(["aiPrompts"], `duplicate AI prompt ${id}`);

    content.worksheets.forEach((worksheet, w) => {
      const at = ["worksheets", w];
      if (!worksheet.fields.length && !worksheet.tables.length) problem(at, `${worksheet.id}: has no fields or tables`);
      const columns = worksheet.tables.flatMap((t) => t.columns);
      const names = [...worksheet.fields, ...worksheet.tables, ...worksheet.computed].map((x) => x.id);
      for (const id of duplicates(names)) problem(at, `${worksheet.id}: ${id} is used twice`);
      for (const id of duplicates(worksheet.tables.flatMap((t) => t.columns.map((c) => `${t.id}.${c.id}`)))) problem(at, `${worksheet.id}: column ${id} is used twice`);
      for (const field of [...worksheet.fields, ...columns]) {
        if (field.kind === "choice" && (field.options?.length ?? 0) < 2) problem(at, `${worksheet.id}: choice field ${field.id} needs at least two options`);
        if (field.kind !== "choice" && field.options) problem(at, `${worksheet.id}: only a choice field has options (${field.id})`);
      }
      for (const table of worksheet.tables) {
        if (table.minRows !== undefined && table.maxRows !== undefined && table.minRows > table.maxRows) problem(at, `${worksheet.id}: table ${table.id} needs more rows than it allows`);
      }
      const known = new Set(names);
      for (const computed of worksheet.computed) {
        for (const input of computed.inputs) {
          if (!known.has(input)) problem(at, `${worksheet.id}: ${computed.id} reads ${input}, which isn't in the worksheet`);
          if (input === computed.id) problem(at, `${worksheet.id}: ${computed.id} reads itself`);
        }
      }
    });

    const { questions } = content.knowledgeCheck;
    for (const id of duplicates(questions.map((q) => q.id))) problem(["knowledgeCheck", "questions"], `duplicate question ${id}`);
    questions.forEach((question, q) => {
      const at = ["knowledgeCheck", "questions", q];
      const options = question.options.map((o) => o.id);
      for (const id of duplicates(options)) problem(at, `${question.id}: duplicate option ${id}`);
      for (const id of duplicates(question.correct)) problem(at, `${question.id}: lists the correct answer ${id} twice`);
      for (const id of question.correct) if (!options.includes(id)) problem(at, `${question.id}: the correct answer ${id} isn't one of the options`);
      if (question.correct.length >= options.length) problem(at, `${question.id}: every option is correct`);
    });

    const { rubric } = content;
    const total = rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    for (const id of duplicates(rubric.criteria.map((c) => c.id))) problem(["rubric", "criteria"], `duplicate criterion ${id}`);
    for (const id of duplicates(rubric.criticalFailures.map((f) => f.id))) problem(["rubric", "criticalFailures"], `duplicate critical failure ${id}`);
    if (rubric.passMark > total) problem(["rubric", "passMark"], `the pass mark is ${rubric.passMark}, above the rubric's maximum of ${total}`);
    for (const c of rubric.criteria) {
      if (c.mustHave && rubric.mustHaveMinimum > c.maxPoints) problem(["rubric", "mustHaveMinimum"], `${c.id} is must-have but is worth ${c.maxPoints}, below the minimum of ${rubric.mustHaveMinimum}`);
    }
    if (rubric.bands[0]?.from !== 0) problem(["rubric", "bands"], "the first band starts at 0");
    rubric.bands.forEach((band, i) => {
      const previous = rubric.bands[i - 1];
      if (previous && band.from <= previous.from) problem(["rubric", "bands"], `band ${band.label} doesn't start above ${previous.label}`);
    });
    for (const id of duplicates(rubric.bands.map((b) => b.label))) problem(["rubric", "bands"], `duplicate band ${id}`);

    // A draft may still be missing the checklist (M05's prompts have none yet); a published one may not.
    if (content.status === "approved") {
      for (const prompt of content.aiPrompts) {
        if (!prompt.verification.length) problem(["aiPrompts"], `${prompt.id}: an approved AI prompt has a verification checklist`);
      }
    }
  });

export type Lesson = z.infer<typeof lessonSchema>;
export type WorkedExample = z.infer<typeof workedExampleSchema>;
export type WorksheetField = z.infer<typeof worksheetFieldSchema>;
export type WorksheetTable = z.infer<typeof worksheetTableSchema>;
export type ComputedField = z.infer<typeof computedFieldSchema>;
export type Worksheet = z.infer<typeof worksheetSchema>;
export type KnowledgeQuestion = z.infer<typeof knowledgeQuestionSchema>;
export type KnowledgeCheck = z.infer<typeof knowledgeCheckSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type Rubric = z.infer<typeof rubricSchema>;
export type AiPrompt = z.infer<typeof aiPromptSchema>;
export type StaffMaterial = z.infer<typeof staffMaterialSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ModuleContent = z.infer<typeof moduleContentSchema>;
