import type { ApiClient, Body } from "./summit-api";

/** What `GET /v1/trade/register` answers, typed from the API's own schema. */
export type Register = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["register"]["$get"]>>>;
export type RegisterItem = Register["items"][number];
/** What `GET /v1/trade/register/{id}` answers: one business, and the programme responses that come from it. */
export type RegisterDetail = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["register"][":id"]["$get"]>>>;

/** What `GET /v1/trade/applications` answers: only responses from Ethiopia, and how many others are kept unseen. */
export type Applications = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["applications"]["$get"]>>>;
export type ApplicationItem = Applications["items"][number];
/** What `GET /v1/trade/applications/{id}` answers: one response, the business's others, and its register record. */
export type ApplicationDetail = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["applications"][":id"]["$get"]>>>;

export const REGISTER_VIEWS = [
  { id: "register", label: "Register" },
  { id: "readiness", label: "Readiness" },
  { id: "finance", label: "Finance pipeline" },
  { id: "services", label: "Entrust services" },
  { id: "applications", label: "Applications" },
] as const;
export type RegisterView = (typeof REGISTER_VIEWS)[number]["id"];

export const isRegisterView = (value: string | undefined): value is RegisterView => REGISTER_VIEWS.some((v) => v.id === value);
