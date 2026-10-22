import "server-only";
import { headers } from "next/headers";
import { createApiClient } from "@entrust/api/client";

/** Server-side API client that forwards the visitor's cookies. */
export async function serverApi() {
  const cookie = (await headers()).get("cookie") ?? "";
  return createApiClient(process.env.API_URL ?? "http://localhost:4000", { headers: { cookie } });
}

/** The signed-in user, or null. */
export async function getMe() {
  const res = await (await serverApi()).v1.me.$get();
  return res.status === 200 ? res.json() : null;
}
