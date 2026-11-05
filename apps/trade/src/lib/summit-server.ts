import "server-only";
import { notFound, redirect } from "next/navigation";
import { serverApi, getMe } from "./api";
import { ApiError } from "./summit-api";
import { signInHref } from "./next-path";
import type { UserProfile } from "./types";

/** The signed-in user, or a redirect to the sign-in page that comes back to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<UserProfile> {
  const me = await getMe();
  if (!me) redirect(signInHref(returnTo));
  return me;
}

/** Runs a read on the API, turning "not signed in" into the sign-in page and "no such thing" into a 404. */
export async function load<T>(returnTo: string, read: (api: Awaited<ReturnType<typeof serverApi>>) => Promise<T>): Promise<T> {
  try {
    return await read(await serverApi());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(signInHref(returnTo));
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

