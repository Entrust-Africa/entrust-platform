# Entrust Africa website

> This site lives in the `entrust-platform` monorepo as `apps/website`. Install and run it with pnpm from the repo root (`pnpm install`, then `pnpm --filter @entrust/website dev`). The npm instructions below are from the old standalone repository.

The public site for Entrust Africa (entrustafrica.com): the home page, the platform pages (TRADE,
CLEAR Export, MIZAN), Entrust's advisory services, and the company pages (About, Events, Partners,
Community, Contact).

## Design

The pages are built from the Sketch file "Entrust Africa website" (one page per route, each with a
Desktop 1440 and a Mobile 390 artboard). Design tokens (colours, type scale, radii) are in
`app/globals.css`; image assets exported from Sketch are in `public/images`.

Motion uses framer-motion through a few shared primitives, and respects the visitor's
"reduce motion" setting:

- `app/components/motion/Reveal.tsx`: `Reveal`, `Stagger`/`StaggerItem`, `AccentRule`
- `app/components/motion/SplitWords.tsx`: headings whose words rise in
- `app/components/motion/ParallaxImage.tsx`: photos that wipe open and drift on scroll
- `app/components/site/Decor.tsx`: the paper-cut horizon and the patchwork band

## Tech Stack

- **Framework:** Next.js 16 (React 19, App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4, Framer Motion
- **Content:** Sanity (events, read-only public dataset)
- **Email:** Resend (contact form, event RSVPs, newsletter sign-ups)

##  Getting Started

### Prerequisites

- **Node.js 20.9 or newer** (required by Next.js 16). Check with `node -v`.
- npm 10+

### 1. Clone and install

```bash
git clone git@github.com:AfriConnectTechnologies/entrust-africa.git
cd entrust-africa
npm ci
```

Always install with `npm ci` on your own machine. Do not copy a `node_modules` folder from the
server: it contains Linux binaries and will not run on macOS or Windows.

### 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable             | Purpose                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `RESEND_API_KEY`     | Resend key used by the contact, event RSVP and newsletter API routes         |
| `CONTACT_FROM_EMAIL` | Verified sender address in Resend (falls back to `onboarding@resend.dev`)    |
| `ADMIN_EMAIL`        | Recipient(s) of form submissions, comma-separated                            |

The site runs without these. Without a real `RESEND_API_KEY` the forms validate input but do not
deliver email. `.env` is git-ignored; never commit real values.

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:6001>.

### Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Development server with hot reload on port 6001    |
| `npm run build`     | Production build                                   |
| `npm start`         | Serve the production build (run `build` first)     |
| `npm run lint`      | ESLint                                             |
| `npm run typecheck` | TypeScript check without emitting files            |


## Project Structure

```
app/
  page.tsx, <route>/page.tsx   thin route files: metadata + re-export of the page
  features/<page>/             page UI (HomePage, TradePage, ...)
  components/site/             header with full-screen menu, footer, decorative shapes
  components/motion/           animation primitives
  components/ui/               buttons, links, icons
  lib/site.ts                  links, contact details, platform colours, shared image paths
  api/                         contact, event-rsvp and newsletter endpoints (Resend)
public/images/                 assets exported from the Sketch file
```

Old routes (`/andinet`, `/entrust/*` sub-pages, and the retired `/afri-bridge`) redirect to their new homes in
`next.config.js`.

##  Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site, uploads it to cPanel
over SCP and restarts the Passenger app. The repository needs these GitHub Actions secrets:
`CPANEL_HOST`, `CPANEL_USER`, `CPANEL_PASS`.

On the server, the Node.js app must run **Node 20 or newer**, and the real `.env` values live on
the server itself (they are not stored in git).