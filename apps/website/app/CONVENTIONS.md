# App Router Conventions

This project uses Next.js App Router, where each route segment must include a `page.tsx` file.

## Why `page.tsx` exists

- `page.tsx` is the required route entrypoint in App Router.
- You cannot replace route entry with arbitrary filenames like `EntrustAbout.tsx`.
- To keep code readable, route entries should stay thin and delegate UI to named files.

## Recommended pattern

- Keep route metadata in `page.tsx`.
- Export page UI from a clearly named component file.
- Use one-line default re-exports in route files where possible.

## Package-style structure

- `app/shared/ui/*` for shared reusable UI entrypoints
  - `CommonContact`, `EcosystemNav`, `Footer`, `OurPartners`
- `app/features/<domain>/*` for feature/page view entrypoints
  - `features/entrust/*`
  - `features/andinet/*`
  - `features/afri-bridge/*`
- `app/**/page.tsx` stays as route entry and metadata owner

Example:

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { ... };
export { default } from "../EntrustAbout";
```

## Naming

- Prefer clear names like `EntrustHome.tsx`, `AndinetEvents.tsx`, `AfriBridgeHowItWorks.tsx`.
- Avoid typos in filenames to reduce onboarding confusion.
