import { pgSchema } from "drizzle-orm/pg-core";

// TRADE platform PostgreSQL schema (#55).
// All tables reference core (organization, smeProfile, user, file) and never clear.
export const trade = pgSchema("trade");

export const DELIVERY_MODES = ["self_paced", "live", "hybrid"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
