# Fonts

The web fonts the apps use, kept in the repo so that `next build` never downloads them. With `next/font/google` every build
fetched them from Google, and when that fetch failed the whole build failed ("Can't resolve
'@vercel/turbopack-next/internal/font/google/font'"), in CI and on Railway alike.

Each app loads them with `next/font/local` in its `layout.tsx`, which still self-hosts them and sets the same CSS
variables (`--font-montserrat`, `--font-open-sans`, `--font-ethiopic`, `--font-jetbrains-mono`, `--font-inter`,
`--font-anton`).

| File | Font | Weights | Subset |
| --- | --- | --- | --- |
| `montserrat-latin-wght-normal.woff2` | Montserrat (variable) | 100–900 | Latin |
| `open-sans-latin-wght-normal.woff2` | Open Sans (variable) | 300–800 | Latin |
| `noto-sans-ethiopic-ethiopic-wght-normal.woff2` | Noto Sans Ethiopic (variable) | 100–900 | Ethiopic |
| `jetbrains-mono-latin-wght-normal.woff2` | JetBrains Mono (variable) | 100–800 | Latin |
| `inter-latin-wght-normal.woff2` | Inter (variable) | 100–900 | Latin |
| `anton-latin-400-normal.woff2` | Anton | 400 | Latin |

The files come from Fontsource 5.3.0 (`@fontsource-variable/*` and `@fontsource/anton`), which repackages the Google Fonts
files. All six are under the SIL Open Font License 1.1; the licence texts are in `licenses/`. To add a weight or a subset,
take the file from the same Fontsource package and add it to the `src` list in the layouts.
