import type { HomeData } from "@/lib/data/home-v5";

/** "<" written as its escape (backslash, u003c), so no string in the data can close the script tag. */
const LT_ESCAPE = String.fromCharCode(92) + "u003c";

/**
 * The home page's data as a script, sent by the route right after the markup and before the page script
 * (port/boot.ts), so the page can be built as it is read, before the first paint.
 */
export function homeBootData(data: HomeData): string {
  return "window.__ndHomeData=" + JSON.stringify(data).split("<").join(LT_ESCAPE) + ";";
}
