/**
 * The pictures for step 3 of a drip's page (the client's brief, 2026-11-20):
 * the evening with the nurse while the drip runs, then the morning after, one
 * per goal (the drip's category). A goal without its own falls back to Energy.
 *
 * These are generated (KIE, Seedream image-to-image from the evening room; the
 * prompts are in scrollcraft/builds/drip-v4/gen/). They show nobody real, carry
 * no text, and say nothing about a drip that its own page does not: the words
 * beside them are the drip's own benefits. Files are in public/site/v3/feel/.
 */
export type FeelImage = { src: string; width: number; height: number; position: string };

const pic = (name: string, position = "66% 50%"): FeelImage => ({
  src: `/site/v3/feel/${name}.webp`,
  width: 2200,
  height: 1238,
  position,
});

const DEFAULT = pic("energy");

/**
 * A goal's own picture. Add a file and an entry together. The position's y
 * keeps the head (and raised hands) in view where a wide window crops the
 * top and bottom: 0% where they reach the picture's top edge; where the head
 * sits lower, a little of the ceiling can go. Where a phone crops the sides,
 * x keeps the face in view.
 */
const BY_GOAL: Record<string, FeelImage> = {
  // Hands raised to about 5% from the top.
  Energy: pic("energy", "66% 0%"),
  // Head at about 9%.
  Hydration: pic("hydration", "66% 0%"),
  // Head at about 25%.
  Immunity: pic("immunity", "70% 25%"),
  // Head at about 16%.
  Skin: pic("skin", "66% 15%"),
};

export function feelImage(category: string | null | undefined): FeelImage {
  return (category && BY_GOAL[category]) || DEFAULT;
}

/**
 * The evening while the drip runs: the patient on the sofa, the nurse taking
 * his blood pressure, the stand empty for the page's own bag. Where things are
 * in the picture, in its own pixels (2200 x 1238): the stand's left hook (the
 * bag's hanging hole goes there), the pole, the cannula on his forearm (the
 * tube ends there), and its scale (the hook stands about 1.75 m up).
 */
export const CARE = {
  src: "/site/v3/feel/evening.webp",
  w: 2200,
  h: 1238,
  // The bottom of the left hook's loop, set so its wire shows through the bag's hole (checked on the render).
  hook: { x: 1655, y: 179 },
  pole: 1737,
  cannula: { x: 1476, y: 790 },
  pxPerCm: 6,
} as const;
