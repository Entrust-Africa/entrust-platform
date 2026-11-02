import { createEntrustAuthClient } from "@entrust/auth/client";

export const authClient = createEntrustAuthClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
);
