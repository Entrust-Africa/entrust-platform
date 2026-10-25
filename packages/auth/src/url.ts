/**
 * Resolves the base URL for the CLEAR frontend application.
 *
 * In production or when sending real emails, an unset URL or a localhost URL
 * is considered a configuration error and throws to prevent delivering
 * unreachable links to external recipients.
 */
export function getClearAppUrl(): string {
  const raw = process.env.CLEAR_APP_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";
  const isSend = process.env.EMAIL_MODE === "send";

  if (!raw) {
    if (isProd || isSend) {
      throw new Error(
        "CLEAR_APP_URL must be configured in production (or when EMAIL_MODE=send) to generate valid invitation links.",
      );
    }
    return "http://localhost:3000";
  }

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw);
  if (isProd && isLocalhost) {
    throw new Error(
      `CLEAR_APP_URL cannot point to localhost ('${raw}') in production. Set it to your public domain.`,
    );
  }

  return raw.replace(/\/+$/, "");
}
