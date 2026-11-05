import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { AGRO_PROGRAMME, buildCatalogue, catalogueFromApplications, catalogueFromRegister, deriveRegister, type CatalogueSme } from "@entrust/trade-engine";
import type { CatalogueView } from "../schemas/trade";
import { requireStaff, type Ctx } from "./access";
import { toInput } from "./trade-register";

// The pilot's SMEs, a list for each cohort: cohort 1 is the leather businesses in the register, cohort 2 the agro-processing businesses
// that applied. Only applications from Ethiopia are asked for, so a response from elsewhere never gets as far as this code. Staff only.

export async function getCatalogue(ctx: Ctx): Promise<CatalogueView> {
  requireStaff(ctx.principal, ["admin", "facilitator", "reviewer"], "see the SME catalogue");
  const [leather, applications] = await Promise.all([
    ctx.db.select().from(schema.smeRegister).orderBy(asc(schema.smeRegister.code)),
    ctx.db.select().from(schema.programApplication).where(eq(schema.programApplication.country, "ET")),
  ]);

  const smes: CatalogueSme[] = [
    ...leather.map((row) => catalogueFromRegister(deriveRegister(toInput(row)), row.id)),
    ...catalogueFromApplications(
      applications
        .filter((a) => AGRO_PROGRAMME.test(a.program))
        .map((a) => ({ id: a.id, submittedAt: a.submittedAt.toISOString(), email: a.email, businessName: a.businessName, contactName: a.contactName, phone: a.phone, location: a.location, answers: a.answers })),
    ),
  ];
  return { cohorts: buildCatalogue(smes) };
}
