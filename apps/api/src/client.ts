import { hc } from "hono/client";
import type { AppType } from "./app";

/** Typed client for apps that call the API. Pass the API origin, e.g. http://localhost:4000. */
export function createApiClient(baseUrl: string, init?: RequestInit) {
  return hc<AppType>(baseUrl, { init: { credentials: "include", ...init } });
}

export type { AppType };
