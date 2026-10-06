# Assets: sources and licences

No visible watermark on any asset. No API key is in this folder; the keys are
read from `nutridrip-new/.env` by local scripts only.

## Generated (kie.ai)

| File | What | Model and prompt | Licence |
|---|---|---|---|
| `out/kie-bag-1.png` | 500 ml IV bag, clear film, no label, neutral ports, studio glass light | `seedream/5-pro-text-to-image`, 3:4, `prompts/preamble.txt` + `prompts/01-bag.txt` | Generated for this project under the kie.ai account terms (as v1). No third-party marks, no text in the image |
| `out/kie-bag-2.png` | The same, fuller | same model, `prompts/preamble.txt` + `prompts/01b-bag-full.txt` | As above |
| `out/kie-containers-1.png` | 10 ml vial and 2 ml ampoule on one set, blank labels, neutral caps | same model, 16:9, `prompts/preamble.txt` + `prompts/02-containers.txt` | As above |

One preamble, verbatim, for all three: the same studio set and light.

### Spend (probed 5 Oct 2026)

| Step | Balance |
|---|---|
| Before | 52 |
| After bag 1 | 38 (14 debited) |
| After containers | 24 (14 debited) |
| After bag 2 | 10 (14 debited) |

42 credits for three stills; 10 left, below the cost of another. The published
rate is 28 per still; the ledger debited half that.

### Providers that could not be used

- **Gemini** (`GEMINI_AI_API_KEY`): the key lists seven image models, and every
  one returns 429 with `generate_content_free_tier_requests, limit: 0`. The free
  plan has no image quota.
- **Kling**: not needed; this build has no video.

## Rendered here (path-traced)

| File | What | How | Licence |
|---|---|---|---|
| `out/render-containers-1.png` | 10 ml vial and 2 ml ampoule, modelled to size | `tools/studio/index.html` (three.js 0.186 + three-gpu-pathtracer 0.0.26, MIT), driven by `tools/studio.mjs` | Authored for this project; no third-party content |
| `out/render-bag-1.png` | 500 ml IV bag, film, carrier liquid, ports | as above | as above |

## Processed (`tools/prepare.mjs`)

Every cutout in `assets/` comes from the files above:
- the ground behind each object is rebuilt from a ring of clean ground around it
  and divided out (flat-field);
- clear material keeps its refraction as true alpha;
- caps, crimp and labels stay opaque;
- the ink-ground versions turn the dark refraction lines into light rim lines;
- the sheen layers carry each object's own highlights, for above printed labels;
- the bag's empty plate and meniscus strip are made from the full photograph,
  so the last frame of the fill is the photograph itself.

## Data

`data/drips.json` and `data/site.json` are exported read-only from the dev
database by `tools/export-drips.mjs` (copied from v1 and extended with
container forms from stock lots, the carrier, the given-separately flag and the
zones' last bookable slot). No batch, lot or expiry is exported.

## Added after checkpoint 3 (second kie.ai key, user-supplied, 80 credits)

| File | What | Model and prompt | Licence |
|---|---|---|---|
| `out/room-1.png` | Evening living room with an empty IV stand (not used) | `seedream/5-pro-text-to-image`, 16:9, `prompts/room-preamble.txt` + `prompts/03-room.txt` | Generated for this project under the kie.ai account terms |
| `out/room-2.png` → `assets/room.webp` | The same brief: chosen. A real IV stand with empty hooks beside a sofa, lamp light, dusk at the window, a plain wall on the left for type | as above | as above |

Spend on that key: 80 → 52 (two stills, 14 each). The key was passed to the
generation command as an environment variable only; it is not in any file.

`assets/bag-room.webp`: the rim-lit bag warmed to the room's lamp light, made by
`tools/prepare.mjs`. The bag hangs on the photographed stand's left hook at its
real size (27 cm against a stand measured at 6.7 px per cm).
