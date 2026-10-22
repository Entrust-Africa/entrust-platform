import "server-only";
import { headers } from "next/headers";
import { auth } from "@entrust/auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
