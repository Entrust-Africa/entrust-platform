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

/**
 * The organisations the signed-in user belongs to, from the auth service's organisation plugin.
 * Organisation management (#18) will replace this with CLEAR's own endpoint.
 */
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

/**
 * The exporters Entrust staff can open a case for: every SME organisation with access to CLEAR. Staff belong to the Entrust
 * organisation alone, so `listOrganizations` has nothing to offer them. Empty for anyone the API doesn't let open cases for others.
 */
export async function listExporters(): Promise<{ id: string; name: string }[]> {
  const res = await (await serverApi()).v1.clear.exporters.$get();
  if (res.status !== 200) return [];
  const { items } = await res.json();
  return items.map((o) => ({ id: o.id, name: o.smeId ? `${o.name} (${o.smeId})` : o.name }));
}
