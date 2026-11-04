"use client";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface TradeResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/** A call from the browser to a TRADE endpoint, with the session cookie. Never throws: a network failure comes back as an error message. */
export async function tradeFetch<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<TradeResult<T>> {
  try {
    const response = await fetch(`${api}/v1/trade${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    return response.ok
      ? { ok: true, status: response.status, data: parsed as T, error: null }
      : { ok: false, status: response.status, data: null, error: parsed?.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, status: 0, data: null, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
