import "server-only";
import { headers } from "next/headers";

/** A server-side read of a TRADE endpoint, with the visitor's cookies. `data` is null unless the API answered 200. */
export async function tradeGet<T>(path: string): Promise<{ status: number; data: T | null; error: string | null }> {
  const cookie = (await headers()).get("cookie") ?? "";
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/trade${path}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (response.status === 200) return { status: 200, data: (await response.json()) as T, error: null };
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return { status: response.status, data: null, error: body?.error ?? null };
}
