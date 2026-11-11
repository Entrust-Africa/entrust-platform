// Links in content written in the studio, and in the AI assistant's answers, are drawn as links only when they go
// somewhere safe: an http(s) page, an email address, or a path on this site.

const BASE = "https://this-site.invalid";

/**
 * The link to draw for an href from Markdown, or null when it isn't safe. A path has to stay on this site once a browser
 * reads it: browsers treat a backslash like a slash, so `/\evil.example` is `//evil.example`, another site. The path is
 * resolved against a stand-in origin and kept only if it is still on it.
 */
export function safeLinkTarget(href: string): { href: string; external: boolean } | null {
  const value = href.trim();
  if (/^mailto:[^\s]+$/i.test(value)) return { href: value, external: false };
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? { href: url.toString(), external: true } : null;
    } catch {
      return null;
    }
  }
  if (!value.startsWith("/") || value.includes("\\")) return null;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return null;
    return { href: `${url.pathname}${url.search}${url.hash}`, external: false };
  } catch {
    return null;
  }
}
