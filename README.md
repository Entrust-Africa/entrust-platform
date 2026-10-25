# Entrust platform

One codebase for Entrust Africa's platforms. CLEAR Export is the first; TRADE and
MIZAN come later and have no UI yet.

```
apps/
  api          the backend: Hono on Node.js, REST under /v1, login, OpenAPI docs at /docs
  website      entrust-africa.com: Entrust, Andinet and Bridgepoint (Next.js 16, Sanity)
  clear        CLEAR Export frontend (Next.js 16); talks to apps/api
packages/
  ui           design system: tokens (Tailwind 4) and shared components
  db           Postgres + Drizzle: schema "core" (shared) and one schema per platform
  auth         Better Auth config (served by apps/api) and the browser auth client
  rules        CLEAR's canonical 125 steps, master controls, facts, evidence types and rule packs, as data
  gate-engine  the GATE engine: pure functions that evaluate a case and check status changes
```

Rules that keep it extensible:

- The API owns business logic, permission checks and database access. Frontends call it
  through the typed client (`@entrust/api/client`) and never import `@entrust/db`.
- Platforms never import from each other. Shared code goes in `packages/`.
- One SME identity: an SME registers once (`core.sme_profile`) and appears in every platform.
- One database, one Postgres schema per platform. Shared tables live in `core`.
- Every platform writes to `core.audit_log`.

## Local setup

Requirements: Node 24 (LTS), pnpm (via Corepack), PostgreSQL 17 locally or a Neon database.

```sh
corepack enable pnpm

# Postgres (Debian/Ubuntu)
sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE ROLE entrust LOGIN PASSWORD 'entrust';"
sudo -u postgres createdb -O entrust entrust_platform

cp .env.example .env            # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
pnpm db:migrate
pnpm dev                        # API on :4000, CLEAR on :3000, website on :6001
```

- API docs: http://localhost:4000/docs (OpenAPI JSON at `/openapi.json`).
- CLEAR cases live under `/v1/clear/cases` (create, list, view, update facts, step transitions,
  evidence submission and review, dates for deadline clocks). The routes only validate and shape
  responses; the logic and permission checks are in `apps/api/src/services`. SME members see their
  own organisations' cases and get 404, not 403, for anyone else's. Entrust staff are the members of
  the organisation in `ENTRUST_ORG_ID` with the role `admin`, `facilitator` or `reviewer`, and see
  every case. Every change writes to `core.audit_log` and to the case's own history (`clear.case_event`).
- Failure rules FL-01 to FL-14 are data in `packages/rules` and are checked by the GATE engine after
  every change to a case. A rule that fires raises a flag (`clear.case_flag`) with the exception
  steps it lists, and holds the steps it names until an Entrust reviewer or admin waives the flag or
  the situation clears. Rules that wait on data a case doesn't hold yet (lab results, quantities, customs
  documents) are defined but dormant. Some rules fire with time alone, so the background
  worker (#16) is meant to call `syncOpenCases` (`apps/api/src/services/flags.ts`) on a schedule.
- Minimum export price (STEP-024, coffee only). ECTA sets a minimum export price every week and
  doesn't publish it, so an Entrust admin loads the figures as price tables, by CSV
  (`POST /v1/clear/minimum-prices/csv`) or typed in (`POST /v1/clear/minimum-prices`). A CSV has one
  row per price and the header `effective_from,effective_to,coffee_type,grade,origin,unit,min_price`
  (`origin` is optional, columns can come in any order, `unit` is `USD/kg` or `USD/lb`, both dates are
  included). Every table is kept; where two cover the same day the latest one decides. The SME (or
  Entrust) records the contract with `PUT /v1/clear/cases/{id}/contract`: its date, unit price,
  coffee type, grade and optional origin. The check takes the price in force on the contract date,
  converts units, and either completes STEP-024 (price at or above the minimum, once its
  prerequisites are done), raises FL-03 (below it), or leaves the step open with the reason, such as
  "No minimum price on file". Loading a table checks the open cases it covers again.
- Shipping document comparison (STEP-099). Entrust's spec mentions a "24-point" check without
  listing the points, so `packages/rules/src/documents.ts` defines them, with a matrix of which
  documents may carry which fields (the commercial invoice, packing list, B/L or AWB, certificate
  of origin, phytosanitary and quality certificates, plus the bank permit and letter of credit the
  rules read). There is no OCR yet: a person enters what each document says with
  `PUT /v1/clear/cases/{id}/documents/{document}/fields` (`GET /v1/clear/document-fields` lists the
  fields), and values are checked as they are typed. Every field that two or more documents carry
  must agree. The quantity and net weight get the UCP 600 tolerance (5% for bulk goods, 10% where
  the LC says "about", or what the LC states); a B/L under an LC or CAD must be made out to the
  order of a bank; and the invoice total can't exceed the permit value. When everything the case
  needs is entered and agrees, CLEAR completes STEP-099; a difference raises FL-06 and holds the
  handoff to the bank (STEP-110) until it is fixed or an Entrust reviewer waives it.
- Amendments. Once a phase gate is signed off, a recorded fact or the sales contract can't be
  changed directly (the endpoints refuse and say so). An Entrust admin or facilitator amends the
  case with `POST /v1/clear/cases/{id}/amendments`, giving a reason and the facts, contract terms
  or letter of credit terms (expiry, quantity tolerance, reference) to change. Each amendment is
  the case's next version (v2, v3, ...) and keeps every field it changed, before and after. What it
  sets back is worked out from the step data (`packages/gate-engine/src/amendment.ts`): the steps
  whose conditions use a changed fact, the step that establishes it (`determinedAt`), and the steps
  that list a contract or LC term in `relies`. The completed ones are reopened, the approved
  evidence they ask for goes back for review, and the sign-offs of their phases are reopened;
  everything else stays as it was. The case is "amendments pending" until all of that is done
  again, and while it is pending a recorded fact or the contract can only change by another
  amendment. The audit log shows each amendment, who made it and why.
- Rule packs. A pack is one corridor's requirements (product and destination), as data in
  `packages/rules/src/packs`: what each asks, who acts, its basis (confirmed or conditional law,
  awaiting verification, or a transaction term), its sources with links, the day they were checked,
  and the canonical steps it sits on. A requirement's status on a case is read from those steps.
  Nothing is presented as law without an official source: the packs are validated when the package
  loads, and a requirement that isn't established is labelled awaiting verification. The launch
  corridors each have a pack: green coffee to the US (`et-us-green-coffee` 0.4.0, ported from the
  simulation), green and roasted coffee to the EU, black cumin and paprika to Türkiye and to the US,
  Hass avocado to the EU and to the six GCC states, and processed food to the US (each 0.1.0,
  researched on 24 and 25 October 2026). A pack covers a product category (the case's product
  fact); the spice, avocado and processed food packs say in CASE-02 which products they were
  researched for. The requirements every Ethiopian
  export shares, and the sources, are in `packs/common.ts` and `packs/sources.ts`, so a change to
  one of them changes every pack that lists it. A case keeps the version it was opened with (`rule_pack_id`,
  `rule_pack_version`), so publishing a new version changes no open case: the case detail shows
  what the newer version would change (`rulePackUpdate`), and an Entrust admin or facilitator moves
  the case with `POST /v1/clear/cases/{id}/rule-pack` and a reason. A published version is never
  edited (`packages/rules/test/rule-packs.test.ts` holds each one's hash); a correction is a new
  version in the same file. `GET /v1/clear/rule-packs` lists the versions.

To use Neon instead of local Postgres, put its pooled connection string in `DATABASE_URL`.
The website reads its own `apps/website/.env` (see `apps/website/.env.example`).

- CLEAR `/sign-in` creates an account and signs in (through the API).
- CLEAR `/` lists the cases the signed-in user can see, `/cases/new` opens one, and `/cases/{id}` is
  the case workspace: its phases and gates, steps, evidence, flags, facts, contract, deadlines and
  rule pack requirements. Every change is a Server Action that calls the API as the visitor, so the
  API decides what they may do; the pages only choose which controls to show, from the GATE
  engine's transition tables (`apps/clear/src/lib/catalogue.ts`). A user who isn't in an
  organisation yet can't open a case: organisations are managed in #18.
- CLEAR `/design` shows the design system draft.

## Database changes

Edit the schema in `packages/db/src/schema`, then:

```sh
pnpm db:generate   # writes a SQL migration to packages/db/migrations
pnpm db:migrate    # applies it
```

The Better Auth tables in `packages/db/src/schema/auth.ts` are generated by
`npx @better-auth/cli generate`; regenerate them instead of editing by hand.

## Tooling notes

- TypeScript 7 is the compiler everywhere. The website also installs the TypeScript 6
  API under the `typescript` name, because typescript-eslint does not support TypeScript 7
  yet; `tsc` still runs TypeScript 7.
- pnpm only runs install scripts for packages listed under `allowBuilds` in
  `pnpm-workspace.yaml`.
- CI (`.github/workflows/ci.yml`) runs `pnpm typecheck`, `pnpm db:migrate`, `pnpm test` and `pnpm build`
  on every pull request, against its own Postgres.
- Tests use Vitest; run one package's with `pnpm --filter @entrust/gate-engine test`.
- `@entrust/db` and `@entrust/api` tests run against `DATABASE_URL`, so run `pnpm db:migrate` first.
  The API tests sign users up through Better Auth and use a case-reference country (QZ) that no real
  exporter has; they remove what they create, by its `test-api-` prefix.

## Website deployment

entrust-africa.com still deploys from the old `AfriConnectTechnologies/entrust-africa`
repository (GitHub Actions to cPanel). This repo does not deploy it yet; moving the
deployment here is a separate task.
