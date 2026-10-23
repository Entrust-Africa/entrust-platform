import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth, type Session } from "@entrust/auth";
import { health } from "./routes/health";
import { clearCases } from "./routes/clear/cases";
import { me } from "./routes/me";
import { ServiceError } from "./services/errors";

export type AppEnv = {
  Variables: { user: Session["user"] | null; session: Session["session"] | null };
};

const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);

const base = new OpenAPIHono<AppEnv>();

base.use(
  "*",
  cors({
    origin: origins,
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
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.json({ error: "Something went wrong." }, 500);
});

// Routes are chained so the typed client (src/client.ts) sees every endpoint.
export const app = base.route("/v1", health).route("/v1", me).route("/v1/clear", clearCases);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Entrust Platform API", version: "1" },
});
app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: "Entrust Platform API" }));

export type AppType = typeof app;
