# Hosting

| Part | Where | Address |
| --- | --- | --- |
| API (`apps/api`) | Cloudflare Worker `entrust-api`, Neon Postgres | api.entrust-africa.com |
| CLEAR (`apps/clear`) | Railway service `entrust-clear` | clear.entrust-africa.com |
| TRADE (`apps/trade`) | Railway service `entrust-trade` | trade.entrust-africa.com |
| Summit page (`apps/summit`) | Railway service `entrust-summit` | adtis.entrust-africa.com |
| Website (`apps/website`) | Cloudflare Worker | entrust-africa.com |

## How a change goes live

1. A pull request merges to `main` and CI runs.
2. `.github/workflows/deploy.yml` applies the database migrations and deploys the API Worker.
3. Its last job, `promote-prod`, fast-forwards the `prod` branch to that commit.
4. Railway builds the three apps from `prod`. A service rebuilds only when files it depends on changed (its own app, `apps/api`, `packages`, the lockfile and the root config).

So an app never deploys before CI has passed and the API is live. Nobody pushes to `prod` by hand. To roll back, redeploy an earlier deployment of the service in the Railway dashboard.

## Railway

Project `entrust-platform` in the Africonnect workspace, environment `production`, region us-east4 (Virginia, near the database). The plan allows one region only.

Each service is built by Railpack and configured with service variables, not files:

- `RAILPACK_NODE_VERSION=24`
- `RAILPACK_BUILD_CMD=pnpm exec turbo run build --filter=@entrust/<app>`
- `RAILPACK_START_CMD=cd apps/<app> && ./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}`
- `API_URL` and `NEXT_PUBLIC_API_URL` (CLEAR and TRADE), or `API_URL` and `SUMMIT_APP_URL` (Summit page): `https://api.entrust-africa.com`, and `https://trade.entrust-africa.com` for `SUMMIT_APP_URL`. `NEXT_PUBLIC_` values are baked in at build time, so changing one needs a redeploy.

With the Railway CLI: `railway service status --service entrust-trade`, `railway logs --build --service entrust-trade`, `railway service redeploy --service entrust-trade`.

## DNS

Each hostname is a Cloudflare CNAME (DNS only, not proxied) to the `*.up.railway.app` target Railway shows for that custom domain, plus a TXT record `_railway-verify.<name>` that proves ownership. Without the TXT record the certificate is never issued.

## AfriConnect sign-in

People sign in to CLEAR and TRADE with their AfriConnect account (OpenID Connect). Entrust's sign-in page asks only for the email; AfriConnect's page, in the platform's colours, asks for the password or emails a code (and, for someone new, a name and a password), then sends them back signed in. Entrust keeps its own users, organisations and platform access, tied to AfriConnect's subject (`account.provider_id = 'africonnect'`). The provider side is described in AfriConnect's `docs/SHARED_IDENTITY.md`.

Switching it on, in this order:

1. AfriConnect registers Entrust as a client (`idp:registerClient`) with the redirect URI `https://api.entrust-africa.com/api/auth/callback/africonnect`, `skipConsent: true`, `provisionAccounts: true`, and the branding: `organizationName` "Entrust Africa", `primaryColor` `#157642`, `primaryForegroundColor` `#ffffff`, `backgroundColor` `#f5f7f6`, and per product `trade` (`productName` "TRADE", `logoUrl` `https://trade.entrust-africa.com/logo.png`) and `clear` (`productName` "CLEAR", `logoUrl` `https://clear.entrust-africa.com/logo.jpg`). It returns a client id and a secret, shown once.
2. On the API Worker, set the secrets `AFRICONNECT_CLIENT_ID` and `AFRICONNECT_CLIENT_SECRET` (`AFRICONNECT_ISSUER` defaults to `https://www.africonnect.africa.com/api/auth`) and redeploy. From then on, new accounts are made through AfriConnect only: Entrust email-and-password sign-up is off, and existing Entrust passwords still work through the API until they are retired.
3. On the Railway services `entrust-clear` and `entrust-trade`, set `AFRICONNECT_SIGN_IN=on`. It is read per request, so a restart is enough. Do steps 2 and 3 together: between them the old sign-up forms show but sign-up is already off.
4. Optionally give people who registered before this an AfriConnect account too: `apps/api/scripts/link-africonnect-accounts.ts` (a dry run without `--apply`).

What happens to whom:

- An existing Entrust account is linked by email the first time its owner signs in, only if the email is verified on both sides. An Entrust account whose email was never verified is refused with a message, so whoever created it cannot take over the real owner's sign-in.
- The public onboarding diagnostic emails a private link with a one-time proof. On that page (not the copy shown on screen) the person presses "Confirm and continue": that proves the email, moves the draft to a new private link (emailed to them, so whoever typed their address cannot keep editing it), and gives them an account on AfriConnect and Entrust, with no password until they first sign in. The draft records the Entrust user (`trade.public_diagnostic.user_id`). If AfriConnect is down at that moment, the backfill script makes the account later.
- The Summit application's first step asks for the business and the email, then AfriConnect does the rest and sends the applicant back to the application.
- Someone whose AfriConnect account has no verified email (a phone-only account) is told to add one on AfriConnect first.
- Signing out of CLEAR or TRADE signs out of Entrust only; the person stays signed in on AfriConnect. Someone else who then types their own email on the sign-in page is asked to sign in on AfriConnect, not sent back as the previous person.
- A person who takes longer than ten minutes on AfriConnect's pages comes back to the API's plain error page (Better Auth's sign-in state lasts ten minutes) and starts again.
