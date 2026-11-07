import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth, APIError, trustedOrigins, type Session } from "@entrust/auth";
import { health } from "./routes/health";
import { clearCases } from "./routes/clear/cases";
import { clearMinimumPrices } from "./routes/clear/minimum-prices";
import { clearRulePacks } from "./routes/clear/rule-packs";
import { me } from "./routes/me";
import { ServiceError } from "./services/errors";
import { organizations } from "./routes/organizations";
import { smes } from "./routes/smes";
import { jobs } from "./routes/jobs";
import { files } from "./routes/files";
import { auditRouter } from "./routes/audit";
import { tradeApplications } from "./routes/trade/applications";
import { tradeAssessments } from "./routes/trade/assessments";
import { tradeCatalogue } from "./routes/trade/catalogue";
import { tradeEvidence } from "./routes/trade/evidence";
import { tradeModules } from "./routes/trade/modules";
import { tradeKnowledgeChecks } from "./routes/trade/knowledge-checks";
import { tradeSubmissions } from "./routes/trade/submissions";
import { tradeWorksheets } from "./routes/trade/worksheets";
import { tradeModuleProgress } from "./routes/trade/progress";
import { tradePlans } from "./routes/trade/plans";
import { tradePractice } from "./routes/trade/practice";
import { tradePublicDiagnostic } from "./routes/trade/public-diagnostic";
import { tradePrograms } from "./routes/trade/programs";
import { tradeRegister } from "./routes/trade/register";
import { tradeSessions } from "./routes/trade/sessions";
import { tradeSponsors } from "./routes/trade/sponsors";
import { summit, summitPublic } from "./routes/summit";
import { summitCommerce, summitCommercePublic } from "./routes/summit-commerce";

export type AppEnv = {
  Variables: { user: Session["user"] | null; session: Session["session"] | null };
};


const base = new OpenAPIHono<AppEnv>();

base.use(
  "*",
  cors({
    origin: trustedOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// Resolve the session once per request; routes decide whether it is required.
base.use("/v1/*", async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", result?.user ?? null);
  c.set("session", result?.session ?? null);
  await next();
});

base.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Services refuse with a ServiceError; this gives each one its status and the shared error body.
base.onError((error, c) => {
  if (error instanceof ServiceError) return c.json({ error: error.message, code: error.code }, error.status);
  if (error instanceof APIError) return c.json({ error: error.message, code: "invalid" }, (error.statusCode || 400) as any);
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.json({ error: "Something went wrong." }, 500);
});

// Routes are chained so the typed client (src/client.ts) sees every endpoint.
export const app = base
  .route("/v1", health)
  .route("/v1", me)
  .route("/v1", organizations)
  .route("/v1", smes)
  .route("/v1", jobs)
  .route("/v1", files)
  .route("/v1", auditRouter)
  .route("/v1/clear", clearCases)
  .route("/v1/clear", clearMinimumPrices)
  .route("/v1/clear", clearRulePacks)
  // The public diagnostic goes first: the signed-in TRADE routers below guard every path under /v1/trade.
  .route("/v1/trade", tradePublicDiagnostic)
  .route("/v1/trade", tradeModules)
  .route("/v1/trade", tradeKnowledgeChecks)
  .route("/v1/trade", tradeSubmissions)
  .route("/v1/trade", tradeModuleProgress)
  .route("/v1/trade", tradeAssessments)
  .route("/v1/trade", tradeWorksheets)
  .route("/v1/trade", tradeEvidence)
  .route("/v1/trade", tradePlans)
  .route("/v1/trade", tradeSponsors)
  .route("/v1/trade", tradePractice)
  .route("/v1/trade", tradePrograms)
  .route("/v1/trade", tradeRegister)
  .route("/v1/trade", tradeSessions)
  .route("/v1/trade", tradeApplications)
  .route("/v1/trade", tradeCatalogue)
  .route("/v1/summit", summitPublic)
  .route("/v1/summit/commerce", summitCommercePublic)
  .route("/v1/summit", summit)
  .route("/v1/summit/commerce", summitCommerce);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Entrust Platform API", version: "1" },
});
app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: "Entrust Platform API" }));

export type AppType = typeof app;
