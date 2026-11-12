# App Router Conventions

- `app/**/page.tsx` is the route entry and owns the metadata (built with `buildMetadata` from
  `app/lib/seo.ts`). Keep it thin and re-export the page UI:

  ```tsx
  import type { Metadata } from "next";
  import { buildMetadata } from "../lib/seo";
  export const metadata: Metadata = buildMetadata({ title: "…", description: "…", path: "/about" });
  export { default } from "../features/about/AboutPage";
  ```

- Page UI lives in `app/features/<page>/`, named `<Name>Page.tsx`, with any page-only pieces next to it.
- Shared pieces: `app/components/site` (header, menu, footer, decor), `app/components/motion`
  (animation primitives), `app/components/ui` (buttons, links, icons), `app/lib/site.ts` (links,
  contact details, platform colours, shared images).
- Server components by default; add `"use client"` only to the interactive or animated piece.
- Wrap every section in `.shell` for the page gutter and max width.
- Don't put `hidden` on a `ButtonLink`; wrap it (`<div className="hidden lg:block">`), because the
  button's own `inline-flex` wins.
