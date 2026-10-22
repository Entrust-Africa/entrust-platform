import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/** Browser auth client. `baseURL` is the API origin, e.g. http://localhost:4000. */
export function createEntrustAuthClient(baseURL: string) {
  return createAuthClient({ baseURL, plugins: [organizationClient()] });
}
