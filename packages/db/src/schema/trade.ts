import { date, index, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ENROLLMENT_STATUSES } from "@entrust/trade-engine";
import { organization } from "./auth";

// TRADE platform PostgreSQL schema (#55).
// All tables reference core (organization, smeProfile, user, file) and never clear.
export const trade = pgSchema("trade");

export const DELIVERY_MODES = ["self_paced", "live", "hybrid"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

// A TRADE program, for example "TRADE Ethiopia, Zemen Bank pilot".
export const program = trade.table("program", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// A cohort within a TRADE program, sponsored by an organisation and delivered in a given mode.
export const cohort = trade.table(
  "cohort",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => program.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sponsorOrganizationId: text("sponsor_organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    country: text("country").notNull().default("ET"),
    language: text("language").notNull().default("en"),
    deliveryMode: text("delivery_mode", { enum: DELIVERY_MODES }).notNull().default("self_paced"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_cohort_program_idx").on(t.programId),
    index("trade_cohort_sponsor_idx").on(t.sponsorOrganizationId),
  ],
);

// An SME organisation's enrolment in a cohort. One per SME per cohort; an SME may enrol in several cohorts.
export const enrollment = trade.table(
  "enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status", { enum: ENROLLMENT_STATUSES }).notNull().default("invited"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_enrollment_cohort_org_uidx").on(t.cohortId, t.organizationId),
    index("trade_enrollment_org_idx").on(t.organizationId),
  ],
);
