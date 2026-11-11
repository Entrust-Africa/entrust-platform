import { serve } from "@hono/node-server";
import { getBoss, stopBoss } from "@entrust/jobs";
import { app } from "./app";
import { checkProductionConfig, isProduction } from "./config-check";

const port = Number(process.env.API_PORT ?? 4000);

// The same check the Worker runs (worker.ts), so a missing setting is logged wherever the API starts.
if (isProduction() || process.env.EMAIL_MODE === "send") checkProductionConfig();

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Entrust API on http://localhost:${info.port} (docs at /docs)`);
});

// Eagerly initialize the pg-boss background jobs producer so connection issues surface during deploy
if (process.env.DATABASE_URL) {
  getBoss().catch((err) => {
    console.error("[api:jobs] Failed to initialize background jobs producer:", err);
  });
}

const shutdown = async () => {
  await stopBoss();
  server.close();
};

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
