import { createApiClient } from "@entrust/api/client";

// How the Summit screens talk to the API. The pages on the server use `serverApi()` (lib/api.ts), which forwards the
// visitor's cookies. Components in the browser use `browserApi()`. Both give the same typed client, so a response is
// typed from the API's own schemas and the screens can only read what the API sends.

export type ApiClient = ReturnType<typeof createApiClient>;

/** The API's address as the browser sees it. */
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let client: ApiClient | undefined;

/** The typed client for components in the browser. It sends the visitor's session cookie. */
export function browserApi(): ApiClient {
  client ??= createApiClient(apiUrl);
  return client;
}

/** A refusal from the API, with the sentence it gave. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Reply = { ok: boolean; status: number; json(): Promise<unknown> };

/** The body of a successful reply (200 or 201), typed. */
export type Body<R> = R extends { status: infer S; json: () => Promise<infer T> } ? (S extends 200 | 201 ? T : never) : never;

/** Waits for a reply and returns its body. A refusal throws an `ApiError` whose message is fit to show. */
export async function ok<R extends Reply>(reply: Promise<R>): Promise<Body<R>> {
  let res: R;
  try {
    res = await reply;
  } catch {
    throw new ApiError("We couldn't reach the server. Check your internet connection and try again.", 0);
  }
  if (res.ok) return (await res.json()) as Body<R>;
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const message = typeof data?.error === "string" && data.error ? data.error : null;
  if (res.status === 401) throw new ApiError("Your session has ended. Please sign in again.", 401);
  throw new ApiError(message ?? "Something went wrong. Please try again.", res.status);
}

/** A sentence to show for anything that was thrown. */
export function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}
