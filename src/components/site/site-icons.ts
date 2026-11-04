import type { Metadata } from "next";

/**
 * The tab icon of every page in the client's design (the public site, the 404,
 * sign-in, /welcome and the quiz): their drop, pale on ink, as their pages set
 * it (public/site/mark.svg). It replaces the root layout's brand-mark.svg,
 * which the consoles and the patient app keep. Metadata merges shallowly, so a
 * page under one of these that sets `icons` itself replaces this one.
 */
export const SITE_ICONS: Metadata["icons"] = { icon: [{ url: "/site/mark.svg", type: "image/svg+xml" }] };
