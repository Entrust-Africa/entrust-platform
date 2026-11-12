import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createApiClient } from "@entrust/api/client";
import type { MizanAction } from "@entrust/roles";
import type { UserProfile } from "./types";

/** Server-side API client that forwards the visitor's cookies. */
export async function serverApi() {
  const cookie = (await headers()).get("cookie") ?? "";
  return createApiClient(process.env.API_URL ?? "http://localhost:4000", { headers: { cookie } });
}

/** The signed-in user, or null. Once per page render: the layout and the page both ask. */
export const getMe = cache(async (): Promise<UserProfile | null> => {
  const res = await (await serverApi()).v1.me.$get();
  return res.status === 200 ? ((await res.json()) as unknown as UserProfile) : null;
});

export interface MizanAccess {
  /** Entrust staff with any MIZAN permission, including Quality. */
  staff: boolean;
  staffRole: "admin" | "facilitator" | "reviewer" | null;
  quality: boolean;
  actions: MizanAction[];
  /** The caller's own SME organisations whose approved reports they can open. */
  reportOrganizations: { id: string; name: string }[];
}

/** What the signed-in person can do in MIZAN. Nothing at all means they have no access. */
export const getMizanAccess = cache(async (): Promise<MizanAccess | null> => {
  const res = await (await serverApi()).v1.mizan.access.$get();
  return res.status === 200 ? ((await res.json()) as MizanAccess) : null;
});

/** Whether the person can use MIZAN at all: as staff, or as an SME with reports to open. */
export const hasMizanAccess = (access: MizanAccess | null): access is MizanAccess =>
  !!access && (access.staff || access.reportOrganizations.length > 0);
