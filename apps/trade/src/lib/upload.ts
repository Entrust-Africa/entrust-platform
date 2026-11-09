"use client";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** What the files store accepts, so a bad file is turned away in the browser before anything is sent. */
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export interface UploadedFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
}

const hex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function call<T>(path: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${api}${path}`, { credentials: "include", ...init });
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    return res.ok ? { ok: true, data: body as T } : { ok: false, error: body?.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}

/** Turns a file away in the browser if the store would refuse it. */
export function checkFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "Upload a PDF, JPEG or PNG file.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return "Files can be at most 20 MB.";
  return null;
}

/**
 * Uploads a file to the business's own storage in three steps: ask the API for a short-lived upload link (with the file's checksum),
 * send the bytes straight to the store, then tell the API it is done so it can check what arrived. Returns the file's id.
 */
export async function uploadFile(organizationId: string, file: File): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: string }> {
  const problem = checkFile(file);
  if (problem) return { ok: false, error: problem };
  const bytes = await file.arrayBuffer();
  const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));

  const start = await call<{ fileId: string; uploadUrl: string; uploadToken: string; headers: Record<string, string> }>("/v1/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, originalName: file.name, contentType: file.type, sizeBytes: file.size, sha256 }),
  });
  if (!start.ok) return start;

  try {
    // The mock store used in development takes the same request, but with the cookie.
    const put = await fetch(start.data.uploadUrl, { method: "PUT", headers: start.data.headers, body: bytes, credentials: start.data.uploadUrl.startsWith(api) ? "include" : "omit" });
    if (!put.ok) return { ok: false, error: "The file couldn't be stored. Try again." };
  } catch {
    // A failed PUT to the store from the browser is most often the store refusing the page's address.
    return { ok: false, error: "The file couldn't be sent to storage. Try again, and tell Entrust if it keeps happening." };
  }

  const done = await call<{ file: { id: string; originalName: string; contentType: string; sizeBytes: number } }>("/v1/files/finalise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadToken: start.data.uploadToken }),
  });
  if (!done.ok) return done;
  return { ok: true, file: { id: done.data.file.id, name: done.data.file.originalName, contentType: done.data.file.contentType, sizeBytes: done.data.file.sizeBytes } };
}

/** Opens a short-lived download link for a file the caller may see. */
export async function openFile(fileId: string): Promise<string | null> {
  const res = await call<{ downloadUrl: string }>(`/v1/files/${fileId}/download-url`, { method: "GET" });
  if (!res.ok) return res.error;
  window.open(res.data.downloadUrl, "_blank", "noopener,noreferrer");
  return null;
}
