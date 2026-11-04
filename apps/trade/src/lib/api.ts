import "server-only";
import { headers } from "next/headers";
import { createApiClient } from "@entrust/api/client";
import type { UserProfile } from "./types";

/** Server-side API client that forwards the visitor's cookies. */
export async function serverApi() {
  const cookie = (await headers()).get("cookie") ?? "";
  return createApiClient(process.env.API_URL ?? "http://localhost:4000", { headers: { cookie } });
}

/** The signed-in user, or null. */
export async function getMe(): Promise<UserProfile | null> {
  const res = await (await serverApi()).v1.me.$get();
  return res.status === 200 ? ((await res.json()) as unknown as UserProfile) : null;
}

/** The organisations the signed-in user belongs to. */
export async function listOrganizations(): Promise<{ id: string; name: string }[]> {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/auth/organization/list`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const organizations = (await res.json()) as { id: string; name: string }[];
  return organizations.map(({ id, name }) => ({ id, name }));
}
