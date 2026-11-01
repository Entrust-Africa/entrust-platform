import { z } from "@hono/zod-openapi";
import { learnerModuleSchema, moduleContentSchema } from "@entrust/trade-content";
import { MODULE_IDS } from "@entrust/trade-rules";
import { Facts, Role } from "./clear";

const ModuleSummary = z
  .object({
    id: z.enum(MODULE_IDS).openapi({ example: "M04" }),
    title: z.string(),
    deliverable: z.string(),
    objectives: z.array(z.string()),
    /** ready: an approved version. draft: only drafts, which only Entrust staff see. in_production: no content yet. */
    contentStatus: z.enum(["ready", "draft", "in_production"]),
    /** The newest version the caller can open, or null while the module is in production. */
    latestVersion: z.string().nullable().openapi({ example: "0.1.0" }),
    /** The versions the caller can open, newest first. */
    versions: z.array(z.string()),
  })
  .openapi("TradeModuleSummary");

export const ModuleList = z.object({ items: z.array(ModuleSummary) }).openapi("TradeModuleList");

export const ModuleParam = z.object({ id: z.string().openapi({ example: "M04" }) });
export const ModuleQuery = z.object({
  version: z.string().optional().openapi({ description: "A version to open. Default: the newest the caller can open.", example: "0.1.0" }),
});

export const ModuleDetail = ModuleSummary.extend({
  /**
   * The content of the version, or null while the module is in production. An SME gets the lessons,
   * worksheets, knowledge-check questions without answers, rubric and AI prompts. Entrust staff also
   * get the answer keys and explanations, the auto-check IDs and the staff-only material.
   */
  content: z.union([moduleContentSchema, learnerModuleSchema]).nullable(),
}).openapi("TradeModule");

// ---- Practice cases (M08) ----

export const PracticeScenarioList = z
  .object({
    /** What every screen shows on a practice case. */
    label: z.string().openapi({ example: "Practice. Simulated, not a real export." }),
    scenarios: z.array(
      z.object({
        id: z.string().openapi({ example: "zebu-coffee" }),
        title: z.string(),
        summary: z.string(),
        /** The learner gives the facts, from their own brief, when they start it. */
        ownFacts: z.boolean(),
      }),
    ),
  })
  .openapi("PracticeScenarioList");

export const StartPracticeBody = z
  .object({
    organizationId: z
      .string()
      .optional()
      .openapi({ description: "The SME organisation. Defaults to the caller's active organisation." }),
    scenario: z.string().openapi({ example: "zebu-coffee" }),
    facts: Facts.optional().openapi({
      description: "For a scenario that takes the learner's own deal: at least product and destinationCountry. Leave it out for the others.",
    }),
  })
  .openapi("StartPracticeBody");

export const PracticeListQuery = z.object({
  organizationId: z.string().optional().openapi({ description: "Narrow to one organisation. Default: all the caller's." }),
});

export const PracticeRoleQuery = z.object({
  as: Role.optional().openapi({
    description:
      "The party whose turn the learner takes. A case's steps belong to the SME, to Entrust's reviewers and to banks and authorities, so a learner working alone picks whose they are working. Default: their own role. Entrust staff keep their own.",
    example: "reviewer",
  }),
});
