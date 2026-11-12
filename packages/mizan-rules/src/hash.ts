/**
 * Canonical JSON and SHA-256, used for a configuration's fingerprint and for the hash of an approved (frozen) result.
 * Web Crypto only, so the same code runs in the API Worker, Node and the browser.
 */

/**
 * JSON with object keys sorted at every level, so the same value always gives the same text whatever order its keys were
 * built in. `undefined` properties are left out, as JSON.stringify does. Numbers that JSON cannot hold (NaN, Infinity)
 * throw instead of quietly becoming null, because a hash over a lossy text would not prove anything.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`canonicalJson: ${value} cannot be written as JSON`);
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  throw new Error(`canonicalJson: a ${typeof value} cannot be written as JSON`);
}

/** SHA-256 of the text's UTF-8 bytes, as 64 lower-case hex characters. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
