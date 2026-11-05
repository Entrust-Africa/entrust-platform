import type { ApiClient, Body } from "./summit-api";

/** What `GET /v1/trade/catalogue` answers, typed from the API's own schema. */
export type Catalogue = Body<Awaited<ReturnType<ApiClient["v1"]["trade"]["catalogue"]["$get"]>>>;
export type CatalogueCohort = Catalogue["cohorts"][number];
export type CatalogueSme = CatalogueCohort["smes"][number];
