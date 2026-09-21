"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { FaqList } from "@/components/ui/Marketing";
import { countFaqs, filterFaqs, type FaqCategory } from "@/lib/data/faqs";

/**
 * Search and category filter over the questions.
 *
 * The page renders every answer on the server, so with JavaScript off it is
 * still the whole list, readable top to bottom. This only narrows it — and the
 * answers themselves stay <details>, which need no script to open.
 */
export function FaqBrowser({ categories }: { categories: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const total = useMemo(() => countFaqs(categories), [categories]);
  const shown = useMemo(() => filterFaqs(categories, { query, category }), [categories, query, category]);
  const shownCount = countFaqs(shown);
  const searching = query.trim().length > 0;

  const chip = (on: boolean) =>
    `t-small rounded-full px-[14px] py-[8px] border min-h-[44px] sm:min-h-[36px] cursor-pointer transition-colors ${
      on
        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
        : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink-3)]"
    }`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="max-w-[520px]">
          <Input
            label="Search the questions"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="cancel, code, vitals, pincode…"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <button type="button" className={chip(category === "all")} onClick={() => setCategory("all")}>
            All <span className="t-data text-[13px] opacity-70">{total}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(category === c.id)}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label} <span className="t-data text-[13px] opacity-70">{c.items.length}</span>
            </button>
          ))}
        </div>

        {/* Said aloud to a screen reader, because the list changing under a
            typing finger is otherwise silent. */}
        <p className="t-small text-[var(--color-ink-3)]" aria-live="polite">
          {searching || category !== "all"
            ? `Showing ${shownCount} of ${total} answers`
            : `${total} answers`}
        </p>
      </div>

      {shown.length === 0 ? (
        <Card tone="muted" padding="p-8">
          <h2 className="t-h3 mb-2">No answer matches that</h2>
          <p className="t-body text-[var(--color-ink-2)] max-w-[56ch] mb-5">
            Try fewer or different words, or clear the topic. If it is not here, ask us — the form on the
            consultation page goes straight to our clinical team.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear the search
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {shown.map((c) => (
            <section key={c.id} aria-labelledby={`faq-${c.id}`}>
              <div className="mb-4">
                <h2 id={`faq-${c.id}`} className="t-h2">
                  {c.label}
                </h2>
                <p className="t-body text-[var(--color-ink-2)] mt-1">{c.blurb}</p>
              </div>
              <FaqList items={c.items} open={searching ? "all" : "first"} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
