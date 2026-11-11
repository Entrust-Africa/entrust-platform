import "server-only";
import { headers } from "next/headers";

/** How long a page waits for the API before it says so, rather than hanging. */
const TIMEOUT_MS = 15_000;

/**
 * A server-side read of a TRADE endpoint, with the visitor's cookies. `data` is null unless the API answered 200. Never
 * throws: an API that doesn't answer in time, or can't be reached, comes back as status 0 with a message, so a page can say
 * so instead of failing as a whole.
 */
export async function tradeGet<T>(path: string): Promise<{ status: number; data: T | null; error: string | null }> {
  const cookie = (await headers()).get("cookie") ?? "";
  try {
    const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/trade${path}`, {
      headers: { cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 200) return { status: 200, data: (await response.json()) as T, error: null };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return { status: response.status, data: null, error: body?.error ?? null };
  } catch (error) {
    console.error(`[trade] GET ${path} failed:`, error);
    return { status: 0, data: null, error: "TRADE didn't answer in time. Try again in a moment." };
  }
}
