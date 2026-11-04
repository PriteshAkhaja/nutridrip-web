"use client";

import { useMemo, useState } from "react";
import { countFaqs, filterFaqs, type FaqCategory } from "@/lib/data/faqs";

/**
 * Search and topic filter over the questions, in the client's style.
 *
 * The page renders every answer on the server, so with JavaScript off it is
 * still the whole list, readable top to bottom. This only narrows it, and the
 * answers stay <details>, which need no script to open. A search opens every
 * match: somebody who typed a word wants the sentence it is in.
 */
export function FaqBrowser({ categories }: { categories: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const total = useMemo(() => countFaqs(categories), [categories]);
  const shown = useMemo(() => filterFaqs(categories, { query, category }), [categories, query, category]);
  const shownCount = countFaqs(shown);
  const searching = query.trim().length > 0;

  return (
    <div className="fq">
      <div className="fq-tools">
        <div className="nd-field fq-search">
          <label htmlFor="fq-q">Search the questions</label>
          <input
            id="fq-q"
            type="search"
            placeholder="cancel, code, vitals, pincode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="fq-chips" role="group" aria-label="Filter by topic">
          <button
            type="button"
            className="fq-chip"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            All <span>{total}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="fq-chip"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label} <span>{c.items.length}</span>
            </button>
          ))}
        </div>
        {/* Said aloud to a screen reader: the list changing under a typing finger is otherwise silent. */}
        <p className="nd-small fq-count" aria-live="polite">
          {searching || category !== "all" ? `Showing ${shownCount} of ${total} answers` : `${total} answers`}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="nd-callout fq-none">
          <p className="fq-none__h">No answer matches that.</p>
          <p className="nd-body">
            Try fewer or different words, or clear the topic. If it is not here, ask us: the form on the Ask a clinician
            page goes straight to our clinical team.
          </p>
          <button
            type="button"
            className="nd-btn nd-btn--ghost"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="fq-cats">
          {shown.map((c) => (
            <section key={c.id} aria-labelledby={`faq-${c.id}`} className="fq-cat">
              <div className="fq-cat__head">
                <h2 id={`faq-${c.id}`} className="nd-q nd-q--sm">
                  {c.label}
                </h2>
                <p className="nd-body">{c.blurb}</p>
                <p className="nd-small">
                  {c.items.length} {c.items.length === 1 ? "answer" : "answers"}
                </p>
              </div>
              <div className="nd-faq fq-list">
                {c.items.map((f, i) => (
                  <details key={f.q} open={searching || i === 0}>
                    <summary>{f.q}</summary>
                    <div>{f.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
