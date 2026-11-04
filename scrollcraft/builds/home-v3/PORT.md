# Port: v3 landing and IV vs Tablets into the app (started 2026-11-02)

Approved by the user on 2026-11-02:
- the landing page (`builds/home-v3`, as reviewed on :4540)
- IV vs Tablets (`builds/iv-vs-tablets`), with two honesty fixes:
  - the tablet meter shows stage words only, with no invented fill level
  - the two clinical lines are reworded to the process we run (quiz reviewed by a physician, vitals at every session, labs where a drip requires them), and flagged for a physician in `CLIENT-CHANGES.md`

## Decisions

- **Chrome for every public page.** The new header and footer apply to every page in `(site)`: Outfit and Geist, the NutriDrip™ wordmark, a question button ("Menu" where a page has no `[data-q]` sections), and the nav with IV vs Tablets. Pages not yet redesigned keep their bodies until steps 2 and 3. Invoices and consoles keep `LogoMark`.
- **Scoped CSS.** The client's CSS (engine, `site.css`, page CSS) is scoped to the `.sc-site` wrapper by `scripts/scope-site-css.mjs` (PostCSS), and sits in `@layer site`, ordered `theme, base, site, components, utilities`:
  - `:root`, `html`, `body` → `.sc-site`
  - html-level properties (`scroll-padding`) → `:root:has(.sc-site)`
  - `body.x` → `.sc-site.x`
  - `.sc-ready X` → `.sc-ready .sc-site X` (the engine sets `sc-ready` on `<html>`)
  - everything else is prefixed with `.sc-site`

  Site rules beat Tailwind's preflight but never a utility, so `.sc-site a { color: inherit }` cannot repaint a `text-white` button.
- **Engine.** `scrollcraft.js` and `scrollcraft.css` are copied unchanged into `src/components/site/scroll/engine/`. The JS is imported dynamically in the browser only, since it is an IIFE on `window`. The `useScrollCraft` hook mounts it in an effect and calls `api.destroy()` in cleanup.
- **Page classes.** Classes page.js put on `<body>` (`nd-tinted`, `is-static`, `nd-js`) and `--tint` go on the `.sc-site` wrapper, and are removed in cleanup.
- **Assets.** In `public/site/v3/`. Fonts in `public/fonts/v3/` (OFL texts beside them).
- **Drip.tint.** An enum of `SITE_TINTS` (the safe palette), null by default. The read model falls back to the seed's per-slug choice, then to a palette pick by slug hash. Set in the Drip builder.
- **Copy.** New `content.ts` keys: `home.why.*` and `ivtabs.*`.

## Steps

- [x] 1. Fonts, assets, the engine copy, `scope-site-css.mjs`, layer order in `globals.css`
- [x] 2. `useScrollCraft` wrapper (mount and destroy)
- [x] 3. Site chrome: header (ledger or menu), footer, `.sc-site` wrapper in `(site)/layout.tsx`
- [x] 4. Drip.tint, the palette, the builder control, seed tints
- [x] 5. Home read model (forms, molecule, pack from lots, as `tools/export-drips.mjs`)
- [x] 6. Landing JSX sections and `HomeMotion` (page.js as a mount and cleanup)
- [x] 7. `/iv-vs-tablets` route (and its two fixes)
- [x] 8. Verify:
  - every width (390, 768, 1024, 1440, 1920)
  - reduced motion
  - client-side navigation in and out, with nothing left running
  - dev and production LCP and CLS
  - typecheck, lint, test
- [x] 9. Docs: `AGENTS.md`, `CLIENT-CHANGES.md`, `FINGERPRINTS.md`

## Log
- 2026-11-02, steps 1-2:
  - Engine copied byte-identical to the skill's.
  - CSS sources in `src/components/site/v3/styles/`; scoped output in `scoped/` (`npm run site-css`).
  - `@layer theme, base, site, components, utilities` in `globals.css`.
  - Engine in `src/components/site/scroll/engine/` (ESLint ignores it; `scrollcraft.d.ts` makes it importable).
  - `useScrollCraft(ref, motion)`.
- 2026-11-02, step 3 written:
  - `SiteChrome.tsx` is the v3 header and footer (keeps the session account link; the quiz CTA goes through `quizCtaFor` via `v3/Cta`).
  - `SiteLedger` (questions or "Menu"), `SiteNav`, `Wordmark`.
  - `.sc-site` wrapper and font preloads in the `(site)` layout.
  - `--site-header-h` maps to `--bar-h` for pages not yet redesigned.
- 2026-11-02, steps 4-6:
  - `Drip.tint` added (`lib/tints.ts`: `SITE_TINTS`, `SEED_TINTS`, `tintFor`), with the input schema, the PATCH allow-list, the builder's swatches and the seed.
  - Read model `listAssemblyDrips()` in `lib/data/assembly.ts`; `formsByMaster` and `assemble` are shared with `getAssemblyDrip`.
  - Landing:
    - `components/site/home/`: `Landing.tsx` (server), `HomeMotion.tsx` (client root), `motion.ts` (page.js port, with cleanup), `format.ts`.
    - `(site)/page.tsx` replaced; it imports `scoped/home.css`.
    - FAQs and categories come from `lib/data/marketing.ts`.
    - The teaser button now goes to `/iv-vs-tablets`.
  - Content: `home.why.*` added. `home.badge`, `home.stat1.*`, `home.stat3.*`, `home.safety.body` and `home.contra.heading` retired (old home only; stat1 was the placeholder 4.9 rating).
  - Checked at 1440 on dev (:3210): every frame side by side with the prototype; 0 errors, 0 overflow.
  - A first 500 ("Element type is invalid") was a stale Turbopack compile after replacing `page.tsx` while the server ran.
- 2026-11-02, step 7:
  - `components/site/ivtabs/`: `IvTabs.tsx`, `IvTabsMotion.tsx`, `motion.ts`.
  - Route `(site)/iv-vs-tablets/page.tsx`, with metadata.
  - 50 `ivtabs.*` content keys in two editor groups.
  - Honesty fixes: no gauge (stage words in `data-word`), the dot keeps its size, three lines reworded (marked "Ours" in `content.ts`). No invented 45 to 60 minutes when no drip is public.
- 2026-11-02, the step 8 checks so far:
  - Lint clean, typecheck clean, 788 tests.
  - Media slots: the home page's 11 slots and `goalTileSlot` retired (the new landing's pictures are composition planes, fixed, as the v2 assembly's were). Tests point at `how-it-works.step-physician`.
  - Client navigation (navcheck): leaving a scroll page leaves 0 engine instances, no `sc-ready`, no wrapper classes and 0 animation frames per second. Coming back mounts exactly 1.
- 2026-11-02, step 9:
  - `AGENTS.md`: the client's design, the wrapper, the wordmark, `Cta`/`QuizLink`, `/iv-vs-tablets` Full.
  - The parent `CLAUDE.md` gains `npm run site-css`.
  - `FINGERPRINTS.md`: the `nutridrip-site` row.
- 2026-11-02, step 8 done:
  - Both pages at 390, 768, 1024, 1440 and 1920: clean.
  - Production: the harness passes on both pages (desktop, phone, reduced); LCP home 0.8 s desktop, 1.5 s phone at 4× CPU; IV 0.3 and 0.4 s; CLS 0 for a returning visitor; 64 visible keyboard stops.
  - Fixed during the checks:
    - The ledger button arrived late and shifted the bar. Its questions are now listed by route (`v3/questions.ts`), drawn from the first paint.
    - The hero planes' width and height were the bag's (279×640), not the baked planes' (379×740).
  - The first-visit 0.002 is headless only: the intro's `scrollbar-gutter` against a hidden scrollbar.
- 2026-11-02, step 9 done: `CLIENT-CHANGES.md` entry 47.
- 2026-11-02, after the port (the user chose 1b): the client's printed bottle photos are replaced.
  - Every glass is a blank (`tools/blank-ampoule.mjs`, `tools/blank-vial.mjs`: per-column label edges, smoothed) with our HTML label.
  - The container comes from the stock form; the client's products keep their band colours (`OWN`, `LEMON`).
  - A vial's cap is recoloured through `vial-cap-mask.png` (cut from the photo's teal, as alpha).
  - The label scale is the exact computed width (`offsetWidth` rounded; up to 1.7% off).
  - The five printed `vial-*.webp` are removed from `public/`.
- The user's direction (2026-11-02): no new pages from the client's artifact unless the client asks; the next work is our own existing pages.
