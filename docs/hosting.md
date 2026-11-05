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
