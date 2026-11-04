/**
 * The questions a page answers, section by section, for the header's
 * question button (SiteLedger). Listed here, by route, so the header draws the
 * right button from the first paint: read from the page after it loaded, the
 * button appeared late and pushed the bar (a layout shift). The page marks
 * each section with the same id and words (data-q).
 */
export type PageQuestion = { id: string; text: string };

export const HOME_QUESTIONS = {
  what: { id: "q-what", text: "What is this?" },
  safe: { id: "q-safe", text: "Is it safe? Who is behind it?" },
  why: { id: "q-why", text: "Why IV and not tablets?" },
  which: { id: "q-which", text: "Which one is for me?" },
  inside: { id: "q-inside", text: "What exactly is in it?" },
  day: { id: "q-day", text: "What happens on the day?" },
  cost: { id: "q-cost", text: "What does it cost?" },
  notright: { id: "q-notright", text: "What if it's not right for me?" },
  faq: { id: "q-faq", text: "What else should I know?" },
  book: { id: "book", text: "Ready to book?" },
} satisfies Record<string, PageQuestion>;

export const QUESTIONS_BY_PATH: Record<string, PageQuestion[]> = {
  "/": Object.values(HOME_QUESTIONS),
};
