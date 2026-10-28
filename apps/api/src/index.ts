import { serve } from "@hono/node-server";
import { getBoss, stopBoss } from "@entrust/jobs";
import { app } from "./app";

const port = Number(process.env.API_PORT ?? 4000);

if (process.env.NODE_ENV === "production" || process.env.EMAIL_MODE === "send") {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from || from.includes("onboarding@resend.dev")) {
    console.warn(
      "[notify:warning] EMAIL_FROM is unset or using onboarding@resend.dev. In send mode, Resend will reject delivery to any recipient other than the Resend account owner.",
    );
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn("[notify:warning] RESEND_API_KEY is not configured.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.CLEAR_APP_URL ||
      process.env.CLEAR_APP_URL.includes("localhost") ||
      process.env.CLEAR_APP_URL.includes("127.0.0.1"))
  ) {
    console.warn(
      "[auth:warning] CLEAR_APP_URL is not set or points to localhost in production. Member invitations will fail.",
    );
  }
}

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
