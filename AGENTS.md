# Agent instructions: nutridrip-new

If `../CLAUDE.md` exists, read it first. It holds the architecture and the rules
that are not obvious from the code, and they apply to Codex as much as to Claude.

## Public pages are designed with the scroll-craft skill

Pages under `src/app/(site)/` are designed with the **scroll-craft** skill,
installed globally (`~/.claude/skills/scroll-craft` for Claude Code,
`~/.codex/skills/scroll-craft` for Codex; `<skill>` below means that folder).
Load the skill before you design or redesign one of these pages. Its workspace
is `scrollcraft/` in this repo, set by `.scrollcraft.json`.

### Which pages, and how much

Not every page should be scroll-driven. Scroll as a timeline persuades; it also
slows down someone who came to look something up.

| Treatment | Pages | Why |
|---|---|---|
| **Full**: pinned and scrubbed acts, one engineered peak | `/`, `/how-it-works`, `/about`, `/safety`, `/for-clinics`, `/iv-vs-tablets` | They tell a story and persuade |
| **Companion**: no pinned act; a reading column beside one sticky picture that the reading drives, which is the peak | `/drips/[slug]` (the user's choice, 2026-11-02) | The visitor reads every dose; the bag beside the list shows each one going in |
| **Light**: shared tokens, entry reveals (`data-sc-in`), at most one pinned moment, no scroll-jacking | `/drips`, `/pricing`, `/zones`, `/consult` | The visitor is comparing, checking a pincode, or filling a form |
| **None** | `/faqs`, `/legal/[doc]`, the 404 (`NotFound`, from `app/not-found.tsx` in `SiteShell` and from `(site)/not-found.tsx`), and everything outside `(site)`: login, quiz, patient app, consoles. Sign-in, `/welcome` and the quiz wear the client's look through `ClientTheme` (`components/site/account/`; sign-in and `/welcome` inside `AccountFrame`), whose `account.css` re-points the app's tokens so the app's form components follow | Reading, searching or working; motion only gets in the way |

For a new public page, choose a row and name it in your plan. If it is not
clear which, ask.

### One site, not many builds

The skill's fingerprint gate stops a *new site* repeating an old one. The
NutriDrip public site is one build, so do not gate its pages against each other:

- Pages share the header, footer and nav (`SiteChrome`), the tokens and the
  fonts. Never vary the nav treatment or the close pattern per page to pass
  the gate.
- Pages follow the client's design, adopted for the whole public site on
  2026-10-30 (`scrollcraft/lab/client-artifact/REVIEW.md`): Outfit and Geist,
  black buttons, the green accent on the pale ground, the NutriDrip™ wordmark,
  and the shared stylesheets in `src/components/site/v3/styles/`. Its dark
  grounds (the build's prep table, the limits band, the footer) are part of
  that design; add no others unless the user asks. A redesign changes
  structure and motion where that helps the page; it does not restyle the
  brand again.
- `scrollcraft/FINGERPRINTS.md` holds one row for the whole site,
  `nutridrip-site`, written when the first page ships. Later pages are not
  gated against it.
- Inside the site, vary the grammar and the scroll devices between pages so two
  pages never feel like one page shown twice, and give each Full page its own
  peak.
- The site's signature move is **the drip assembling itself**: a drip's
  ingredients, taken from the Drip document and never hard-coded, merge on
  scroll into the 500 ml bag carrying the real NutriDrip label. It belongs to
  `/` and `/drips/[slug]`. Do not copy it onto other pages.
- Build it by compositing, not with generated video: video models cannot make
  the merge exact, and they cannot show each drip's own ingredients. Stills
  only: one transparent-background (alpha) IV bag with a blank label area, and
  one premium alpha still per real container form (ampoule, vial), each
  ingredient shown in the form its stock lots record. Code does all
  the motion: each vial travels its own path into the bag's port in turn,
  droplets fall (SVG/canvas), the liquid inside the bag rises (SVG, with
  500 ml shown), and every word, including the bag label and the LogoMark, is
  HTML from the Drip document. Write this choreography in page-local code driven
  by the engine's `--sc-p`; the engine itself stays unchanged. Real 3D
  (Three.js) is the upgrade path only if the composited version falls short,
  and it then needs an accurately modelled bag and no-WebGL posters.
- The step-by-step choreography, with reference frames in scroll order, is in
  `_reference/Images/scroll-reference/MOTION-PLAN.md`. Read it and the
  `perkform-*.png` frames before planning the move.

### Build, approve, port

1. **Prototype** the page standalone in `scrollcraft/builds/<page>/`, following
   the skill. Verify with `<skill>/scripts/shoot.mjs` at desktop, 390 px mobile
   and reduced motion. Show the contact sheet and wait for approval.
2. **Port** it into the route through the shared wrapper in
   `src/components/site/scroll/`, created by the first port (the landing,
   2026-11-02): `useScrollCraft.ts` mounts the engine (`engine/`) with the
   page's own motion and undoes both on unmount, and the stylesheets are
   scoped by `npm run site-css` (`scripts/scope-site-css.mjs`). Every later
   page reuses it rather than solving these again:
   - The engine (`scrollcraft.js`, `scrollcraft.css`) is copied unchanged.
     Never edit it per page.
   - `ScrollCraft.mount()` attaches window listeners, two
     `requestAnimationFrame` loops and IntersectionObservers. Since 0.3.1 it
     returns an api with an idempotent `destroy()` that undoes all of it. The
     wrapper mounts in an effect and calls `destroy()` in that effect's cleanup,
     so client-side navigation and React's dev double-mount leave nothing
     running. An engine without `destroy()` is out of date: update the skill
     rather than working around it.
   - `scrollcraft.css` resets `html`, `body`, `*` and `img` and sets its own
     `:root` tokens. Unlayered, it would beat the app's layered tokens and can
     outlive the route after navigation. Scope it to the wrapper.
   - A page's stylesheet stays loaded after a client-side navigation away
     from it, so a rule on a class two pages share reaches the other page too.
     Shared rules go in `site.css` (every page), `glass.css` (the labelled
     glass, the bag label's print and the liquid, used by `/` and
     `/drips/[slug]`, with their code in `v3/glass.ts`, `v3/liquid.ts` and
     `v3/LiquidFill.tsx`) or `fcard.css` (a drip's card, `v3/Fcard.tsx`, used
     by `/` and `/drips`); a page's own rules use its own class names, or
     scope a shared one under the page's own (`.formulary .fcard`).
   - A drip's photo shows only when the admin has uploaded one
     (`uploadedDripPhotos`): in the bag's place on its card, and under the
     description on its page. Otherwise the drip is its bag in its colour.
     The shipped stand-in photos never show on a redesigned page. The same
     holds for photos of people (About's team cards, `uploadedSiteImages`):
     the client's page promises only real photographs of its doctors.
   - A page closes on the shared "Ready to book?" slip and the phone's sticky
     quiz bar: `BookSection` with `getBookFacts()` (`v3/BookSection.tsx`), and
     `mountBook()` (`v3/book.ts`) in the page's motion, which fills in the
     drip picked on the landing and keeps the bar down while an act holds the
     screen. A pinned act reserves its height with `.act-res` and `--span` /
     `--span-m` (`site.css`).
   - Since 2026-11-03 the user has waived the approval stop for the remaining
     pages (How it works onwards): build in the route, verify as in step 3,
     and record the brief in `scrollcraft/builds/<page>/BRIEF.md`.
3. **Re-verify** the ported page with `shoot.mjs` against `localhost:3000`, and
   at 390, 768, 1024, 1440 and 1920 px.

### Rules that still apply on every public page

- Server components read the database directly. Copy comes from the Drip
  document and `src/lib/content.ts`; photos from `src/lib/site-images.ts`.
- No invented benefits, statistics or claims. Text over imagery is real
  HTML/SVG, never baked into a generated image, and the mark is the real
  wordmark (`src/components/site/v3/Wordmark.tsx`); invoices and the consoles
  keep `LogoMark` (`src/components/layout/Logo.tsx`).
- The tab icon is the client's drop (`public/site/mark.svg`, set by
  `SITE_ICONS` in `src/components/site/site-icons.ts`) on every page in their
  design and on the quiz; the consoles and the patient app keep the
  brand-coloured `brand-mark.svg`. A public route outside `(site)` sets
  `icons: SITE_ICONS` in its own metadata.
- Clinical hues (safe, caution, danger) are reserved for genuine status, never
  decoration. A fill level always shows its number.
- Every page keeps a clear path to the quiz (`QuizButton`; on redesigned
  pages `Cta` or `QuizLink` from `src/components/site/v3/Cta.tsx`, which
  send a returning patient the same way); keep
  `MobileBookBar` where a page has one.
- The site header floats over the first section: pad it by
  `var(--site-header-h)`. Use `dvh`, not `vh`.
- A pinned scene must fit a phone held sideways (667x375, 844x390, 932x430):
  the stage clips whatever is taller than the screen. Under 500 px tall
  (`SHORT_SCREEN`, `src/components/site/scroll/short-screen.ts`) About, How
  it works and IV vs Tablets read their still version, and the landing takes
  its phone layout with its steps and day read flat (`.is-flat`). A new
  pinned act does the same, and its stylesheet repeats the query in its own
  `@media` rules so the reserved height agrees from first paint.
- The still version (reduced motion, short screens) shows everything: no
  rail left clipped where it cannot pan (the landing's drips become a grid),
  nothing pinned to the top and bottom of one screen that can meet.
- Motion must not cost speed: no blur or `backdrop-filter` on moving or sticky
  layers, a CSS-first hero, a loader only while something is really loading.
  Report LCP and CLS on dev and production builds.
- Under `prefers-reduced-motion`, everything is readable and still.
- Read optional fields with `?.` and `??`, and show a visible fallback.
- Run `npm run typecheck`, `npm run lint` and `npm test`. Do not run
  `npm run smoke` without asking: it writes test rows into the dev database.
- Append short Added/Changed bullets to `_reference/CLIENT-CHANGES.md`.

### Generated and stock assets

Try providers in this order, and stop at the first that works:

1. **KIE**: `node <skill>/scripts/kie.mjs probe` first, and state the balance
   and the estimated spend before generating a wave.
2. **Kling API** for image-to-video camera moves, **Gemini API** for stills.
   Both are free plans: probe each with one call and confirm the free quota
   covers that output. The official Kling API signs a JWT from an access key
   and a secret key; if `KLING_AI_API_KEY` is not in that form, ask.
3. **Free stock with a commercial licence** (Unsplash, Pexels photos and video,
   Pixabay, Mixkit), plus slow ffmpeg camera moves on high-resolution stills.

Never use an asset with a visible watermark, or one from a free plan that
forbids commercial use: this is a client's commercial site. Record each
asset's source and licence in its build folder. Encode clips with
`<skill>/scripts/encode.sh`, desktop and mobile.

The keys (`KIE_AI_API_KEY`, `KLING_AI_API_KEY`, `GEMINI_AI_API_KEY`) live in
`.env`. Read them only in local scripts. Never put one in page code, a build
folder, a commit or your output.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
