/**
 * A screen too short to hold a pinned act: in practice a phone on its side
 * (667 x 375, 844 x 390, 932 x 430). A pinned stage is one screen tall and
 * clips the rest, so on such a screen the acts that cannot fit are read as
 * their still version (About, How it works, IV vs Tablets), and the landing
 * takes its phone layout with the steps and the day read flat.
 *
 * The page stylesheets repeat this query in their own @media rules (they
 * cannot import it), so the reserved heights agree with the motion from first
 * paint. Change it in both places.
 */
export const SHORT_SCREEN = "(max-height: 500px)";
