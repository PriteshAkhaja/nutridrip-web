# Drip page assets: source and licence

Every picture the live drip page (`/drips/[slug]`) and the page loader show that
was made for them. Generated with kie.ai on the project's account; the key was
passed to the generating script as an environment variable only and is in no
file. All are photoreal stand-ins: the people in them are not real and nobody
in them is identifiable; no text, logos or name tags.

| File | What it is | How it was made | Licence |
|---|---|---|---|
| `public/site/v3/feel/evening.webp` | Step 2: the evening room, a patient on the sofa and a nurse taking his blood pressure, the IV stand left empty for the page's own bag | `seedream/5-pro` image-to-image from the home page's room (`scrollcraft/builds/home-v2`, `assets/room.webp`, itself generated: see that folder's ASSETS.md); prompt `gen/p-evening.txt`; original `gen/evening-1.png` | Generated for this project under the kie.ai account terms |
| `public/site/v3/feel/energy.webp` | Step 3, the morning after, goal Energy (also the fallback for any goal without its own picture) | `seedream/5-pro` image-to-image from the evening room; prompts `gen/pre-morning.txt` + `gen/g-energy.txt`; original `gen/morning-energy.png` | as above |
| `public/site/v3/feel/hydration.webp` | Step 3, goal Hydration | as above, `gen/g-hydration.txt`, `gen/morning-hydration.png` | as above |
| `public/site/v3/feel/immunity.webp` | Step 3, goal Immunity | as above, `gen/g-immunity.txt`, `gen/morning-immunity.png` | as above |
| `public/site/v3/feel/skin.webp` | Step 3, goal Skin | as above, `gen/g-skin.txt`, `gen/morning-skin.png` | as above |
| `public/site/v3/feel/athletic.webp` | Step 3, goal Athletic recovery: lacing his trainers on the sofa | as above, `gen/g-athletic.txt`, `gen/morning-athletic.png` (2026-11-23) | as above |
| `public/site/v3/feel/postviral.webp` | Step 3, goal Post-viral: at the window with a mug of tea | as above, `gen/g-postviral.txt`, `gen/morning-postviral.png` (2026-11-23) | as above |
| `public/site/v3/loader-bag.webp`, `loader-bag-mask.png` | The page loader's bag (176 px) and its liquid mask | Resized with sharp from the site's own `bag-empty.webp` and `bag-mask.png` | As the site's bag |

Spend: 80 credits on the key in use, 70 used (5 pictures at 14); 10 left.

All six goals have their morning picture (2026-11-23): Athletic recovery and
Post-viral were made with a new key (80 credits, 28 used, 52 left).

The vial and ampoule photographs and the bag on this page are the site's
existing assets (see `scrollcraft/builds/home-v2/ASSETS.md`).
