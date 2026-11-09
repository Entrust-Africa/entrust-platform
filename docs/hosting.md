# Hosting

| Part | Where | Address |
| --- | --- | --- |
| API (`apps/api`) | Cloudflare Worker `entrust-api`, Neon Postgres | api.entrust-africa.com |
| CLEAR (`apps/clear`) | Railway service `entrust-clear` | clear.entrust-africa.com |
| TRADE (`apps/trade`) | Railway service `entrust-trade` | trade.entrust-africa.com |
| Summit page (`apps/summit`) | Railway service `entrust-summit` | adtis.entrust-africa.com |
| Email worker (`apps/worker`) | Railway service `entrust-worker` | none (no web address) |
| Website (`apps/website`) | Cloudflare Worker `entrust-website` | entrust-africa.com |

## How a change goes live

1. A pull request merges to `main` and CI runs.
2. `.github/workflows/deploy.yml` then runs, in this order: the database migrations, the API Worker, then the four Railway services and the website together, then the smoke checks.
3. The Railway job uploads the commit with a project token (the GitHub secret `RAILWAY_TOKEN`) and runs `railway up` for `entrust-trade`, `entrust-clear`, `entrust-summit` and `entrust-worker`. Railway cannot watch the repository itself, because nobody in the project has GitHub access, so nothing deploys from a branch.
4. The smoke checks open the addresses people really use (not the `workers.dev` copies), retrying for up to five minutes while a new build starts, and confirm the worker's newest deployment is running.

So an app never deploys before CI has passed and the API is live. Nothing is deployed by hand any more; if the workflow is down, run `railway up --service <name> --environment production --ci` from a clean checkout of `main`. To roll back, redeploy an earlier deployment of the service in the Railway dashboard.

CLEAR, TRADE and the Summit page used to be built into Cloudflare Workers as well (`entrust-clear`, `entrust-trade`, `entrust-summit`). The workflow no longer deploys them, so whatever is still on those workers is an old, unused copy.

## Railway

Project `entrust-platform` in the Africonnect workspace, environment `production`, region us-east4 (Virginia, near the database). The plan allows one region only.

Each service is built by Railpack and configured with service variables, not files:

- `RAILPACK_NODE_VERSION=24`
- `RAILPACK_BUILD_CMD=pnpm exec turbo run build --filter=@entrust/<app>`
- `RAILPACK_START_CMD=cd apps/<app> && ./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}` (the three web apps), or `cd apps/worker && node dist/index.mjs` (the worker)
- `API_URL` and `NEXT_PUBLIC_API_URL` (CLEAR and TRADE), or `API_URL` and `SUMMIT_APP_URL` (Summit page): `https://api.entrust-africa.com`, and `https://trade.entrust-africa.com` for `SUMMIT_APP_URL`. `NEXT_PUBLIC_` values are baked in at build time, so changing one needs a redeploy.
- The worker's own variables are listed under "Settings" below.

With the Railway CLI: `railway service status --service entrust-trade`, `railway logs --build --service entrust-trade`, `railway service redeploy --service entrust-trade`.

## Email and background jobs

Most emails are not sent by the API. The API puts the email on a queue (pg-boss, in the `pgboss` schema of the same database) and returns; the `entrust-worker` service picks it up and sends it through Resend. That covers the diagnostic links and confirmations, Summit registration, clarification and result emails, assessor notices and session reminders. Sign-in emails (verification, password reset, invitations) are the exception: the API sends those straight to Resend.

- The worker is one Node process with no web address. Look at it with `railway logs --service entrust-worker`.
- A queued email is `created`; it becomes `completed` when sent, `retry` while it is being retried, and `failed` once the retries run out. `trade.public_diagnostic.link_emailed_at` records that the link was queued, not that it was delivered.
- **If the worker has been down, look at the queue before starting it again.** It sends everything that is waiting. Cancel what should not go out first (`update pgboss.job set state = 'cancelled', completed_on = now() where name = 'send-email' and state = 'created' and ...`).
- Run exactly one worker. Its `DATABASE_URL` must be the direct (not pooled) connection string.

## Database

Neon project `entrust-clear` (Postgres 18, AWS us-east-2). The branch called `production` is the default and holds all the live data. Until 9 November 2026 the live data sat on a branch called `staging` while an empty branch was called `production`; the empty one is now `empty-unused` and can be deleted when nobody needs it. Connection strings did not change.

- There is no hosted staging environment. To try something against real-shaped data, branch `production` in Neon and point a local copy at the branch, never at `production` itself.
- Point-in-time restore reaches back seven days (the setting is `history_retention_seconds` on the Neon project; it was one day). Nothing older than that is backed up, so take a dump before any risky change to the data.

## Alerts

- A failed deploy or smoke check fails the "Deploy to production" run, and GitHub emails the people who watch the repository.
- `.github/workflows/queue-watch.yml` runs every 30 minutes and fails when an email has waited more than 15 minutes or has failed for good in the last day. That is how a stopped worker shows up.
- There is no error tracker, so an error inside a request is only in the Cloudflare Worker logs (the API) or the Railway logs (the apps) until someone looks.

## Settings

The values live in each service's own settings and can't be read back: Cloudflare Worker settings are write-only secrets (set with `wrangler secret put NAME --name entrust-api`; `wrangler deploy` keeps them), and Railway shows its variables in the dashboard and with `railway variable list`. These are the names the code reads. Not every one is needed everywhere.

- **API Worker `entrust-api`:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_COOKIE_DOMAIN`, `CORS_ORIGINS`, `CLEAR_APP_URL`, `TRADE_APP_URL`, `SUMMIT_APP_URL`, `SUMMIT_SITE_URL`, `ENTRUST_ORG_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_MODE`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_CAP_USD`, `FILE_STORAGE`, `R2_*`, `AFRICONNECT_CLIENT_ID`, `AFRICONNECT_CLIENT_SECRET`, `AFRICONNECT_ISSUER`, `AFRICONNECT_PROVIDER_ID`. Never replace `CORS_ORIGINS` or `AUTH_COOKIE_DOMAIN` without reading the current value first.
- **Worker `entrust-worker` (Railway):** `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (`Entrust Africa <no-reply@entrust-africa.com>`), `EMAIL_MODE=send`, `NODE_ENV=production`, and the `RAILPACK_*` build variables. The Resend key is the same one the API uses (the domain `entrust-africa.com` is verified in that Resend account).
- **TRADE and CLEAR (Railway):** `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SIMULATOR_URL`, `AFRICONNECT_SIGN_IN`, `AFRICONNECT_BUYERS_URL` (optional).
- **Summit page (Railway):** `API_URL`, `SUMMIT_APP_URL`.
- **GitHub Actions secrets:** `DATABASE_URL` (migrations and the queue check), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` (the website's forms) and `RAILWAY_TOKEN` (a project token for the production environment, made in the Railway dashboard under the project's Settings, Tokens).

## DNS

Each hostname is a Cloudflare CNAME (DNS only, not proxied) to the `*.up.railway.app` target Railway shows for that custom domain, plus a TXT record `_railway-verify.<name>` that proves ownership. Without the TXT record the certificate is never issued.

## AfriConnect sign-in

People sign in to CLEAR and TRADE with their AfriConnect account (OpenID Connect). Entrust's sign-in page asks only for the email, or offers "Continue with Google", which goes through AfriConnect straight on to Google (`idp_hint=google`; AfriConnect's production Google client must be set up, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in its Convex settings); AfriConnect's page, in the platform's colours, asks for the password or emails a code (and, for someone new, a name and a password), then sends them back signed in. Entrust keeps its own users, organisations and platform access, tied to AfriConnect's subject (`account.provider_id = 'africonnect'`). The provider side is described in AfriConnect's `docs/SHARED_IDENTITY.md`.

Switching it on, in this order:

1. AfriConnect registers Entrust as a client (`idp:registerClient`) with the redirect URI `https://api.entrust-africa.com/api/auth/callback/africonnect`, `skipConsent: true`, `provisionAccounts: true`, and the branding: `organizationName` "Entrust Africa", `primaryColor` `#157642`, `primaryForegroundColor` `#ffffff`, `backgroundColor` `#f5f7f6`, and per product `trade` (`productName` "TRADE", `logoUrl` `https://trade.entrust-africa.com/logo.png`) and `clear` (`productName` "CLEAR", `logoUrl` `https://clear.entrust-africa.com/logo.jpg`). It returns a client id and a secret, shown once.
2. On the API Worker, set the secrets `AFRICONNECT_CLIENT_ID` and `AFRICONNECT_CLIENT_SECRET` (`AFRICONNECT_ISSUER` defaults to `https://www.africonnect.africa.com/api/auth`) and redeploy. From then on, new accounts are made through AfriConnect only: Entrust email-and-password sign-up is off, and existing Entrust passwords still work through the API until they are retired.
3. On the Railway services `entrust-clear` and `entrust-trade`, set `AFRICONNECT_SIGN_IN=on`. It is read per request, so a restart is enough. Do steps 2 and 3 together: between them the old sign-up forms show but sign-up is already off.
4. Optionally give people who registered before this an AfriConnect account too: `apps/api/scripts/link-africonnect-accounts.ts` (a dry run without `--apply`).

The "Meet buyers" cards on the CLEAR and TRADE dashboards (and at the end of a CLEAR case and of the TRADE programme) open AfriConnect's marketplace, `https://www.africonnect.africa.com/marketplace`, in a new tab. They need no setting. To point them elsewhere (a staging AfriConnect, or another page), set `AFRICONNECT_BUYERS_URL` on `entrust-clear` and `entrust-trade`; it is read per request, so a restart is enough.

What happens to whom:

- An existing Entrust account is linked by email the first time its owner signs in, only if the email is verified on both sides. An Entrust account whose email was never verified is refused with a message, so whoever created it cannot take over the real owner's sign-in.
- The public onboarding diagnostic emails a private link with a one-time proof. On that page (not the copy shown on screen) the person presses "Confirm and continue": that proves the email, moves the draft to a new private link (emailed to them, so whoever typed their address cannot keep editing it), and gives them an account on AfriConnect and Entrust, with no password until they first sign in. The draft records the Entrust user (`trade.public_diagnostic.user_id`). If AfriConnect is down at that moment, the backfill script makes the account later.
- The Summit application's first step asks for the business and the email, then AfriConnect does the rest and sends the applicant back to the application.
- Someone whose AfriConnect account has no verified email (a phone-only account) is told to add one on AfriConnect first.
- Signing out of CLEAR or TRADE signs out of Entrust only; the person stays signed in on AfriConnect. Someone else who then types their own email on the sign-in page is asked to sign in on AfriConnect, not sent back as the previous person. "Continue with Google" always signs in again (`prompt=login`), and Google is asked to show its account chooser.
- A person who takes longer than ten minutes on AfriConnect's pages comes back to the API's plain error page (Better Auth's sign-in state lasts ten minutes) and starts again.
