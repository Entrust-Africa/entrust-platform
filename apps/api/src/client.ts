import { hc } from "hono/client";
import type { AppType } from "./app";

/**
 * Typed client for apps that call the API. Pass the API origin, e.g. http://localhost:4000. Headers
 * in `init` (a forwarded cookie, say) are added to the client's own, such as the JSON content type.
 */
export function createApiClient(baseUrl: string, init?: RequestInit) {
  const { headers, ...rest } = init ?? {};
  return hc<AppType>(baseUrl, {
    headers: headers ? Object.fromEntries(new Headers(headers)) : undefined,
    init: { credentials: "include", ...rest },
  });
}

export type { AppType };

// The shapes the CLEAR endpoints return, for apps that pass them between components.
export type {
  AmendmentView,
  CaseDetailView,
  CaseRulePackView,
  CaseSummaryView,
  ContractView,
  MinimumPriceCheckView,
  RulePackUpdateView,
} from "./schemas/clear";

// The shapes the Audit endpoint returns, for apps that query platform audit logs.
export type {
  AuditLogItemType,
  AuditLogListType,
  AuditQueryType,
} from "./schemas/audit";
