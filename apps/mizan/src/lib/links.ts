// MIZAN has no organisation settings of its own: an SME's organisation and its members are managed in TRADE.
export function tradeOrganizationsUrl(): string {
  const trade = (process.env.NEXT_PUBLIC_TRADE_APP_URL ?? "").trim().replace(/\/+$/, "");
  return `${trade || "http://localhost:3001"}/organizations`;
}
