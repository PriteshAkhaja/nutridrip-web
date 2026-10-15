"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Frame, Need } from "@/lib/media/rules";
import { ImageEditor } from "./ImageEditor";

export type Shown = { src: string; alt: string; position: string; width: number; height: number };
export type ImageStatus = "original" | "replaced" | "edited";
export type ImageItem = {
  slot: string;
  /** The section, in the page's words, or the drip's name. */
  title: string;
  image: Shown;
  status: ImageStatus;
  updated: string | null;
  need: Need;
  /** The size it is drawn at on the page, desktop and phone (lib/media/slots). */
  frame: Frame;
  phone: Frame;
  /** Where "Reset position" goes back to. */
  startPosition: string;
  /** A second line, e.g. a drip's goal. */
  where?: string;
  /** Where it can be seen, if not the group's page. */
  viewPath?: string;
};
export type ImageGroup = { key: string; name: string; path: string; note?: string; items: ImageItem[] };

type Filter = "all" | "changed" | "original";
const changed = (s: ImageStatus) => s !== "original";

/**
 * Admin → Site images, laid out as a library of the website's photographs:
 * a summary, search and a filter, the pages down the side (following the
 * scroll), and each page's photos as tiles in the order they appear on it.
 * A tile opens the editor (ImageEditor) beside the library, so the admin never
 * loses their place.
 */
export function ImageManager({ groups, lastChange }: { groups: ImageGroup[]; lastChange: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tips, setTips] = useState(false);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; href: string } | null>(null);
  const [active, setActive] = useState(groups[0]?.key ?? "");
  const opener = useRef<HTMLElement | null>(null);

  const all = groups.flatMap((g) => g.items);
  const counts = {
    all: all.length,
    changed: all.filter((i) => changed(i.status)).length,
    original: all.filter((i) => !changed(i.status)).length,
  };
  const pageCount = groups.filter((g) => g.key !== "drips-own").length;
  const dripCount = groups.find((g) => g.key === "drips-own")?.items.length ?? 0;

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (i) =>
              (filter === "all" || (filter === "changed") === changed(i.status)) &&
              (!q || `${i.title} ${g.name} ${i.where ?? ""}`.toLowerCase().includes(q))
          ),
        }))
        .filter((g) => g.items.length > 0),
    [groups, filter, q]
  );

  // The page list follows the scroll: the page marked is the last one whose top has
  // passed a line a third of the way down the screen, so it changes as a page's
  // heading arrives, and the section just above never competes with it.
  useEffect(() => {
    const sections = shown
      .map((g) => ({ key: g.key, el: document.getElementById(`page-${g.key}`) }))
      .filter((s) => s.el) as Array<{ key: string; el: HTMLElement }>;
    if (!sections.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let current = sections[0].key;
      for (const s of sections) if (s.el.getBoundingClientRect().top <= line) current = s.key;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  // A saved change is announced, then fades.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const openItem = all.find((i) => i.slot === openSlot) ?? null;
  const openGroup = groups.find((g) => g.items.some((i) => i.slot === openSlot)) ?? null;

  const open = (slot: string, from: HTMLElement) => {
    opener.current = from;
    setToast(null);
    setOpenSlot(slot);
  };
  const close = (saved?: string) => {
    if (saved && openItem) setToast({ text: saved, href: openItem.viewPath ?? openGroup?.path ?? "/" });
    setOpenSlot(null);
    // Back to the tile that opened it, for keyboard users.
    requestAnimationFrame(() => opener.current?.focus());
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Photos" value={String(counts.all)} sub={`${pageCount} pages and ${dripCount} drips`} />
        <Stat
          label="Changed"
          value={String(counts.changed)}
          sub={counts.changed ? "Open one to restore its original" : "All are the originals"}
        />
        <Stat label="Updated" value={lastChange ?? "None yet"} sub="Every change is in the audit trail" small />
      </div>

      {/* Search, filter, tips */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1 lg:max-w-[420px]">
          <span className="sr-only">Find a photo</span>
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, sections, drips"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] pl-10 pr-10 text-[14.5px] placeholder:text-[var(--color-ink-3)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear the search"
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </label>

        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "changed", label: "Changed", count: counts.changed },
            { value: "original", label: "Original", count: counts.original },
          ]}
        />

        <button
          type="button"
          onClick={() => setTips((v) => !v)}
          aria-expanded={tips}
          className="inline-flex h-11 cursor-pointer items-center gap-2 self-start rounded-[var(--radius-md)] px-3 text-[14px] font-medium text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] lg:ml-auto lg:self-auto"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          Photo guide
        </button>
      </div>

      {tips ? (
        <div className="grid gap-x-8 gap-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5 sm:grid-cols-2">
          <Tip title="Big enough to stay sharp">
            Each photo shows its best size. Below the size of its place it is refused; between that and twice it, it is
            allowed but looks a little soft on phones and laptops.
          </Tip>
          <Tip title="What to avoid">
            Readable drug labels, brand names, people&rsquo;s name tags, and photos you do not have the rights to use on
            a commercial site.
          </Tip>
          <Tip title="Choose what shows">
            Drag the photo in the editor. Desktop and phone crop it differently, and both are shown side by side.
          </Tip>
          <Tip title="Not listed here, on purpose">
            The drip animation&rsquo;s bag, vials and room, which the animation is measured against, and the logo, which
            is drawn.
          </Tip>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[200px_minmax(0,1fr)]">
        {/* Pages: down the side on a wide screen, a row of chips otherwise. */}
        <nav aria-label="Pages" className="xl:sticky xl:top-6 xl:self-start">
          <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 [scrollbar-width:thin] xl:flex-col xl:gap-0.5 xl:overflow-visible xl:pb-0">
            {shown.map((g) => {
              const isActive = active === g.key;
              const n = g.items.filter((i) => changed(i.status)).length;
              return (
                <li key={g.key} className="flex-none">
                  <a
                    href={`#page-${g.key}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13.5px] no-underline hover:no-underline xl:rounded-[var(--radius-sm)] xl:border-transparent xl:px-3 xl:py-2 ${
                      isActive
                        ? "border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary-text)]"
                        : "border-[var(--color-line-2)] text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <span className="xl:flex-1 xl:truncate">{g.name}</span>
                    {n ? (
                      <span
                        aria-label={`${n} changed`}
                        className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--color-primary)]"
                      />
                    ) : null}
                    <span className="t-data text-[12px] font-normal text-[var(--color-ink-3)]">{g.items.length}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {shown.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-2)] px-6 py-14 text-center">
              <p className="t-body m-0 font-semibold text-[var(--color-ink)]">No photo matches</p>
              <p className="t-small m-0 mt-1 text-[var(--color-ink-3)]">
                Try a page name such as &ldquo;Pricing&rdquo;, a section such as &ldquo;closing&rdquo;, or a
                drip&rsquo;s name.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-4 cursor-pointer text-[14px] font-semibold text-[var(--color-primary-text)] hover:underline"
              >
                Show every photo
              </button>
            </div>
          ) : null}

          {shown.map((g, gi) => (
            <section key={g.key} id={`page-${g.key}`} aria-labelledby={`h-${g.key}`} className="scroll-mt-6">
              <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)] pb-3">
                <div className="min-w-0">
                  <h2 id={`h-${g.key}`} className="t-h3 m-0">
                    {g.name}
                  </h2>
                  <p className="t-small m-0 mt-0.5 text-[var(--color-ink-3)]">
                    {g.note ?? (
                      <>
                        <span className={g.path === "/" ? "" : "t-data"}>{g.path === "/" ? "Front page" : g.path}</span>{" "}
                        · {g.items.length} {g.items.length === 1 ? "photo" : "photos"}, in the order they appear
                      </>
                    )}
                  </p>
                </div>
                <a
                  href={g.path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold no-underline hover:underline"
                >
                  View page
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden
                  >
                    <path d="M4 2h6v6M10 2L3 9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </header>
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 md:grid-cols-3 2xl:grid-cols-4">
                {g.items.map((i, ii) => (
                  <li key={i.slot}>
                    {/* The first row is what opens on the screen: loaded at once, not when scrolled to. */}
                    <Tile item={i} eager={gi === 0 && ii < 6} onOpen={(el) => open(i.slot, el)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {openItem && openGroup ? (
        <ImageEditor
          key={openItem.slot}
          item={openItem}
          groupName={openGroup.name}
          viewPath={openItem.viewPath ?? openGroup.path}
          onClose={close}
        />
      ) : null}

      {/* Saved: said where it can be seen. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
        {toast ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[var(--color-contrast)] py-2.5 pl-4 pr-2 text-[14px] text-white shadow-[var(--shadow-modal)]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{toast.text}</span>
            <a
              href={toast.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white no-underline hover:bg-white/25 hover:no-underline"
            >
              View
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, small }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 sm:px-5 sm:py-4">
      <p className="t-micro m-0 truncate">{label}</p>
      <p
        className={`m-0 mt-1 font-semibold text-[var(--color-ink)] sm:mt-1.5 ${
          small
            ? "text-[14px] leading-[1.3] sm:text-[17px] sm:leading-[1.35]"
            : "t-data text-[22px] leading-none sm:text-[26px]"
        }`}
      >
        {value}
      </p>
      <p className="t-small m-0 mt-1.5 hidden text-[var(--color-ink-3)] sm:block">{sub}</p>
    </div>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-small m-0 font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="t-small m-0 mt-0.5 text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
        {children}
      </p>
    </div>
  );
}

/** A small set of choices shown together, one of them on. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count: number }>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Show"
      className="inline-flex self-start rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-1 lg:self-auto"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-3.5 text-[13.5px] transition-colors duration-150 ${
              on
                ? "bg-[var(--color-surface)] font-semibold text-[var(--color-ink)] shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink)_10%,transparent)]"
                : "font-medium text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
            }`}
          >
            {o.label}
            <span className={`t-data text-[12px] ${on ? "text-[var(--color-ink-2)]" : "text-[var(--color-ink-3)]"}`}>
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One photo in the library: what it is, whether it changed, and a way in. */
function Tile({ item, eager, onOpen }: { item: ImageItem; eager: boolean; onOpen: (el: HTMLElement) => void }) {
  const status = item.status;
  return (
    <button
      type="button"
      id={item.slot}
      onClick={(e) => onOpen(e.currentTarget)}
      aria-label={`${item.title}${status !== "original" ? `, ${status}` : ""}. Edit photo`}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] text-left transition-colors duration-150 hover:border-[var(--color-ink-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-[var(--color-surface-2)]">
        <Image
          src={item.image.src}
          alt=""
          fill
          // Wider than drawn at quality 90: a library is where photos are judged.
          sizes="(min-width: 1536px) 300px, (min-width: 768px) 30vw, 48vw"
          quality={90}
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition-transform duration-500 ease-[var(--ease-glide)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{ objectPosition: item.image.position }}
        />
        {status !== "original" ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-primary-text)] shadow-[0_1px_3px_color-mix(in_srgb,var(--color-ink)_18%,transparent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden />
            {status === "replaced" ? "Replaced" : "Edited"}
          </span>
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-ink)_0%,transparent)] opacity-0 transition-all duration-200 group-hover:bg-[color-mix(in_srgb,var(--color-ink)_28%,transparent)] group-hover:opacity-100 group-focus-visible:bg-[color-mix(in_srgb,var(--color-ink)_28%,transparent)] group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--color-ink)]">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden
            >
              <path d="M4 20h4L19 9l-4-4L4 16v4z" strokeLinejoin="round" />
            </svg>
            Edit photo
          </span>
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-0.5 px-3.5 py-3">
        <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--color-ink)]">
          {item.title}
        </span>
        <span className="t-small truncate text-[var(--color-ink-3)]">
          {item.where ??
            (item.updated ? `Changed ${item.updated}` : `Best ${item.need.ideal.w} × ${item.need.ideal.h} px`)}
        </span>
      </span>
    </button>
  );
}
