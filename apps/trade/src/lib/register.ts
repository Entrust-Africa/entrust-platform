import type { ApiClient, Body } from "./summit-api";

/** What `GET /v1/trade/register` answers, typed from the API's own schema. */
export type Register = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["register"]["$get"]>>>;
export type RegisterItem = Register["items"][number];

export const REGISTER_VIEWS = [
  { id: "register", label: "Register" },
  { id: "readiness", label: "Readiness" },
  { id: "finance", label: "Finance pipeline" },
  { id: "services", label: "Entrust services" },
] as const;
export type RegisterView = (typeof REGISTER_VIEWS)[number]["id"];

export const isRegisterView = (value: string | undefined): value is RegisterView => REGISTER_VIEWS.some((v) => v.id === value);
