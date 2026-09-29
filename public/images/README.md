Photography for the public site.

Every photograph is registered in `src/lib/site-images.ts` with its alt text,
its focal point (so any crop keeps the subject in frame) and a small blurred
placeholder shown while it loads. Pages ask for an image by name (`dripImage()`
for a drip, `goalImage()` for a goal tile), never by path.

To use the company's own photography, add it under `site/` with a **new file
name** and point the registry entry at it, updating `width`, `height` and
`blur`. A new name matters: resized copies are cached by address (four hours on
the server and in browsers), so a photo swapped in under an old name keeps
showing the old picture for that long. The nine launch drips each have a
picture; a drip added later in the Drip builder falls back to its category's
picture, then to `drip-bag.jpg`.

`home-hero.png` is NutriDrip's own image, kept as the original. The site
serves `home-hero.jpg`, a copy with the same pixels at a tenth of the file size
(184 KB against 2 MB): every size the browser asks for is cut from the source,
and a large PNG made each of those slow. Everything under `site/` is from
[Unsplash](https://unsplash.com/license) under the Unsplash License: free for
commercial use, no attribution required. Credits are kept regardless.

Sources are kept no larger than any layout needs: 1600px wide for landscape,
1400px for portrait. The biggest a photo is ever shown is about 640px (the home
hero), so that still covers a 2x screen, and the browser downloads a size cut
for its own screen, never the source itself.

| File | Used on | Photographer |
|---|---|---|
| `home-hero.jpg` (from `home-hero.png`) | Home hero; How it works (the session); About closing panel | NutriDrip |
| `site/drip-bag.jpg` | Myers' Revive; Pricing hero; fallback for new drips | Samuel Ramos |
| `site/drip-chamber.jpg` | Hydration goal tile; Pricing closing panel | Marcelo Leal |
| `site/drip-line-window.jpg` | Home and How it works closing panels | Camila Mofsovich |
| `site/drip-window-light.jpg` | Home "Not for everyone" | Hiroshi Tsubono |
| `site/drip-stand.jpg` | Drips closing panel; For clinics hero | Marcelo Leal |
| `site/vial-check.jpg` | How it works hero | National Cancer Institute |
| `site/vials-mono.jpg` | Home safety band; Safety reference bands | National Cancer Institute |
| `site/pharmacist.jpg` | About (pharmacy and operations); For clinics economics | National Cancer Institute |
| `site/physician.jpg` | About (physicians) | vaibhav vivian |
| `site/physician-phone.jpg` | Home and How it works (physician review); FAQs closing panel | National Cancer Institute (cropped to remove a name tag) |
| `site/nurse-prep.jpg` | About (nurses); drip page closing panel | maks_d |
| `site/vitals-home.jpg` | Home and How it works (nurse visit); drip page session; Safety hero | Nappy |
| `site/goal-energy.jpg` | Energy goal tile; fallback for Energy drips | Christina Moroz |
| `site/goal-rest.jpg` | Deep Recharge | Shane Ryan Herilalaina |
| `site/goal-skin.jpg` | Glow Protocol; fallback for Skin drips | Himanshu Dewangan |
| `site/goal-skin-2.jpg` | Skin goal tile | Jatin Punia |
| `site/goal-travel.jpg` | Jetlag Reset; Immunity goal tile | William Bayreuther |
| `site/goal-immunity.jpg` | Immune Shield | Lucas George Wendt |
| `site/goal-postviral.jpg` | Post-viral Rebuild; Post-viral goal tile | Slaapwijsheid.nl |
| `site/goal-hydration.jpg` | Hydrate Plus | engin akyurt |
| `site/goal-athletic.jpg` | Athletic Recovery; Athletic recovery goal tile | Scott Broome |
| `site/goal-labs.jpg` | Iron Restore | Testalize.me |
| `site/bengaluru-dusk.jpg` | Zones hero | Priyansh Patidar |
| `site/city-skyline.jpg` | How it works (choosing a slot) | Vishwanth Pindiboina |
| `site/city-street.jpg` | How it works (nurse sets off); Zones closing panel | Akshay Nanavati |

The set was given one light shared grade (a touch less saturation, a slightly
lifted black point) so it reads as one shoot. Nothing was retouched.
