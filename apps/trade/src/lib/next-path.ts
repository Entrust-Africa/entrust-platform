// Where to send someone after they sign in or verify their email. Only Summit pages can be asked for, and only as a
// path on this site, so a crafted link can't send a visitor anywhere else.

export const NEXT_COOKIE = "trade-next";

/** The path if it is a Summit page on this site, otherwise null. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || value.length > 200) return null;
  if (!/^\/summit(?:[/?#][A-Za-z0-9\-._~/?#=&%]*)?$/.test(value)) return null;
  if (value.includes("//") || value.includes("..")) return null;
  return value;
}

/** The sign-in page, asking to come back to `next` afterwards. */
export function signInHref(next: string): string {
  const safe = safeNext(next);
  return safe ? `/sign-in?next=${encodeURIComponent(safe)}` : "/sign-in";
}

/** The remembered path from the cookie's value, which is stored URL-encoded. */
export function nextFromCookie(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return safeNext(decodeURIComponent(value));
  } catch {
    return null;
  }
}
