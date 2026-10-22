#  Entrust – Andinet – Bridgepoint Africa Group Website

> This site now lives in the `entrust-platform` monorepo as `apps/website`. Install and run it with pnpm from the repo root (`pnpm install`, then `pnpm --filter @entrust/website dev`). The npm instructions below are from the old standalone repository.

Official website for **Bridgepoint Africa Group**, providing a unified online presence for its three core entities:

- **Entrust Consulting** – SME advisory and capacity-building services  
- **Andinet** – Professional networking and expatriate connections  
- **Bridgepoint Africa** – Trade facilitation platform  

This repository contains the full Next.js website implementation, including frontend components, pages, and styling.


##  Project Objective

- Build a professional, responsive website for the group  
- Provide quick access to each business entity  
- Showcase services, networking opportunities, and trade facilitation  
- Deliver a modern, scalable, and maintainable codebase  


## Website Sections

### 1. Landing Page
- Central gateway to the three entities  
- Interactive panels for:
  - Entrust Consulting  
  - Andinet  
  - Bridgepoint Africa  
- Clean design and fast navigation  
- Mobile-first responsive layout  

### 2. Entrust Consulting
- Showcase SME advisory programs  
- AfCFTA & COMESA training and workshops  
- Entrust Academy for structured courses  
- Interactive cards and CTAs for program sign-up  

### 3. Andinet
- Networking platform for African professionals  
- Expatriate and SME community programs  
- Events, trade shows, webinars, and resource library  
- Interactive carousels and downloadable content  

### 4. Bridgepoint Africa
- Trade facilitation platform  
- Market access support for SMEs (AfCFTA & COMESA)  
- Trade compliance guidance and partnerships  
- Interactive dashboards and service cards  

### 5. Contact Page
- Unified contact form for all entities  
- Smart routing based on inquiry type  
- Responsive and validated form fields  


##  Tech Stack

- **Framework:** Next.js 16 (React 19, App Router)  
- **Language:** TypeScript  
- **Styling:** Tailwind CSS 4, Framer Motion  
- **Content:** Sanity (events, read-only public dataset)  
- **Email:** Resend (contact form, event RSVPs, newsletter sign-ups)  
- **Hosting:** cPanel (Node.js / Passenger), deployed from GitHub Actions  


##  Design Principles

- Mobile-first, fully responsive layout  
- Clean and professional UI consistent across sections  
- Smooth hover and interactive animations  
- Optimized performance and SEO-ready  
- Easy to maintain and expand  


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


##  Project Structure

```
app/                  Pages, components and API routes (App Router)
  entrust/            Entrust Consulting section
  andinet/            Andinet section
  afri-bridge/        Bridgepoint Africa section
  api/                contact, event-rsvp and newsletter endpoints (Resend)
  lib/                Sanity client and event fetching
public/               Static assets (images under public/src/assets)
server.js             cPanel / Passenger entry point
.github/workflows/    CI/CD pipeline
```


##  Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site, uploads it to cPanel
over SCP and restarts the Passenger app. The repository needs these GitHub Actions secrets:
`CPANEL_HOST`, `CPANEL_USER`, `CPANEL_PASS`.

On the server, the Node.js app must run **Node 20 or newer**, and the real `.env` values live on
the server itself (they are not stored in git).