"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useOptimistic,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Select } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  actionLabel,
  AUDIT_GROUPS,
  groupFor,
  type AuditGroup,
  type DatePreset,
} from "@/lib/data/audit";

/**
 * The audit filter bar.
 *
 * Groups stay as chips — there are five of them, they are the axis somebody
 * reaches for first, and five chips read faster than a dropdown.
 *
 * Actions and people do not: thirty-three action chips filled the screen and
 * pushed the rows themselves below the fold, which is the opposite of what a
 * filter is for. Anything that grows with the data belongs in a select.
 *
 * Every choice is a URL, so the filter is shareable, survives a reload, and is
 * applied by the database rather than by hiding rows that were already sent.
 * Changing any of them drops the page number: staying on page 14 of a filter
 * that now has two pages would land on an empty table.
 *
 * The URL being the truth has a cost the eye catches: until the server answers,
 * the old URL still says "no date", so a date you just picked snapped back to
 * empty for a second and then reappeared, and on a phone the page jumped to the
 * top. So a choice shows at once (useOptimistic), the page stays where it is
 * (`scroll: false`), and the results dim while the new ones are on their way
 * (AuditResults) — the rows are stale, and they should look it.
 */

type Filters = {
  group: AuditGroup | null;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
};

/** A change to the filter: a string sets a key, `null` clears it. */
type Patch = { [K in keyof Filters]?: string | null };

const apply = (base: Filters, next: Patch): Filters => {
  const pick = (key: keyof Filters, current: string | undefined) =>
    next[key] === null ? undefined : ((next[key] as string | undefined) ?? current);
  return {
    group: (pick("group", base.group ?? undefined) as AuditGroup | undefined) ?? null,
    action: pick("action", base.action),
    actor: pick("actor", base.actor),
    from: pick("from", base.from),
    to: pick("to", base.to),
  };
};

const hrefFor = (f: Filters) => {
  const p = new URLSearchParams();
  if (f.group) p.set("group", f.group);
  if (f.action) p.set("action", f.action);
  if (f.actor) p.set("actor", f.actor);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  const s = p.toString();
  return `/admin/audit${s ? `?${s}` : ""}`;
};

/**
 * The filters and the results are siblings on the page, rendered by the
 * server, so the "a new filter is loading" fact has to live above both of them.
 */
const Navigation = createContext<{
  pending: boolean;
  start: (fn: () => void) => void;
} | null>(null);

export function AuditView({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  return <Navigation.Provider value={{ pending, start }}>{children}</Navigation.Provider>;
}

/**
 * The rows while a new filter is on its way: dimmed, not replaced. Swapping in
 * a skeleton would throw away a table someone may still be reading and make
 * every filter feel slower than it is. The dim waits 150ms before it starts, so
 * an answer that comes back quickly never flickers the page at all.
 */
export function AuditResults({ children }: { children: ReactNode }) {
  const pending = useContext(Navigation)?.pending ?? false;
  return (
    <div
      aria-busy={pending || undefined}
      className={`transition-opacity ${
        pending ? "opacity-45 duration-200 delay-150 pointer-events-none" : "opacity-100 duration-100"
      }`}
    >
      {children}
    </div>
  );
}

export function AuditFilters({
  group,
  action,
  actor,
  from,
  to,
  presets,
  counts,
  actors,
  byGroup,
  total,
}: {
  group: AuditGroup | null;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  /** Computed on the server — a client component must not read the clock. */
  presets: DatePreset[];
  counts: Array<{ action: string; n: number }>;
  actors: Array<{ id: string; name: string; n: number }>;
  byGroup: Record<string, number>;
  total: number;
}) {
  const router = useRouter();
  const shared = useContext(Navigation);
  // Only for a bar mounted without AuditView around it; the page provides one.
  const [, startLocal] = useTransition();
  const start = shared?.start ?? startLocal;

  /**
   * What the bar shows: the URL's filter, or the one just chosen while the
   * server is still answering. React drops the optimistic copy the moment the
   * navigation lands, by which point the props say the same thing.
   */
  const [view, show] = useOptimistic<Filters, Filters>({ group, action, actor, from, to }, (_, next) => next);

  /**
   * Built on the bar's current view, not the props, so two quick changes
   * compose — pick From, then To before the first answer arrives, and the
   * second request still carries the first date.
   */
  const urlFor = (next: Patch) => hrefFor(apply(view, next));

  const go = (next: Patch) => {
    const target = apply(view, next);
    start(() => {
      show(target);
      router.push(hrefFor(target), { scroll: false });
    });
  };

  /**
   * Chips stay real links, so a middle-click or ctrl-click still opens the
   * filter in a new tab. A plain click is taken over only to give it the same
   * instant, unjumping treatment as the selects.
   */
  const follow = (next: Patch) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(next);
  };

  const activePreset = presets.find((p) => p.from === view.from && p.to === view.to)?.label;

  /** The same filter, pointed at the export handler instead of the page. */
  const exportHref = `/api/audit/export${urlFor({}).slice("/admin/audit".length)}`;

  // Choosing a group drops an action that no longer belongs to it, rather than
  // leaving a filter that quietly returns nothing.
  const inGroup = view.group
    ? counts.filter((c) => AUDIT_GROUPS.includes(view.group!) && groupFor(c.action) === view.group)
    : counts;

  // The dropdown is ordered by name, not by how often something happened.
  // Somebody opening it is looking for one action they can already name, so a
  // frequency-ordered list means reading every row to find it. The count stays
  // on the option -- it is worth knowing once found, and no help in finding.
  const actions = [...inGroup].sort((a, b) =>
    actionLabel(a.action).localeCompare(actionLabel(b.action)),
  );

  const anyFilter = Boolean(view.group || view.action || view.actor || view.from || view.to);
  const clearAll: Patch = { group: null, action: null, actor: null, from: null, to: null };

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex flex-wrap gap-2 items-center">
        <Link
          href={urlFor({ group: null, action: null })}
          onClick={follow({ group: null, action: null })}
          className={chip(!view.group)}
        >
          Everything <span className="t-data text-[13px] opacity-70">{total}</span>
        </Link>
        {AUDIT_GROUPS.map((g) => {
          const next: Patch = { group: view.group === g ? null : g, action: null };
          return (
            <Link key={g} href={urlFor(next)} onClick={follow(next)} className={chip(view.group === g)}>
              {g} <span className="t-data text-[13px] opacity-70">{byGroup[g] ?? 0}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {/* The width lives on the wrapper, not on the control. A select left
            to size itself takes the width of its widest option, so the whole
            bar jumped every time a group changed the list underneath it. */}
        <div className="w-full sm:w-[280px]">
          <Select
            label="Action"
            value={view.action ?? ""}
            onChange={(e) => go({ action: e.target.value || null })}
          >
            <option value="">
              {view.group ? `Every ${view.group.toLowerCase()} action` : "Every action"}
            </option>
            {actions.map((c) => (
              <option key={c.action} value={c.action}>
                {actionLabel(c.action)} ({c.n})
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-[240px]">
          <Select
            label="Who"
            value={view.actor ?? ""}
            onChange={(e) => go({ actor: e.target.value || null })}
          >
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.n})
              </option>
            ))}
          </Select>
        </div>

        {/* One box, so the pair wraps together. Split across two rows they read
            as two unrelated fields rather than as the ends of one range. */}
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="flex-1 min-w-0 sm:flex-none sm:w-[150px]">
            <DatePicker
              label="From"
              value={view.from ?? ""}
              max={view.to || undefined}
              onChange={(v) => go({ from: v || null })}
            />
          </div>
          <div className="flex-1 min-w-0 sm:flex-none sm:w-[150px]">
            <DatePicker
              label="To"
              value={view.to ?? ""}
              min={view.from || undefined}
              onChange={(v) => go({ to: v || null })}
            />
          </div>
        </div>

        {anyFilter ? (
          <Link href="/admin/audit" onClick={follow(clearAll)} className="t-small font-semibold pb-[13px]">
            Clear
          </Link>
        ) : null}

        {/* Downloads the filter, not the page. A plain link, not a fetch: the
            browser handles the file, so a big export never sits in a tab's
            memory and the download survives navigating away. */}
        <a
          href={exportHref}
          className="t-small font-semibold pb-[13px] ml-auto whitespace-nowrap"
          download
        >
          Download CSV
          {anyFilter ? <span className="text-[var(--color-ink-3)]"> (this filter)</span> : null}
        </a>
      </div>

      {/* The windows people actually ask for, so the common case is one click
          rather than two date pickers. Lighter than the group chips above on
          purpose — they are a different axis, not more of the same one. */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="t-small text-[var(--color-ink-3)]">Quick range</span>
        {presets.map((p) => {
          const next: Patch =
            activePreset === p.label ? { from: null, to: null } : { from: p.from, to: p.to };
          return (
            <Link
              key={p.label}
              href={urlFor(next)}
              onClick={follow(next)}
              className={`t-small rounded-full px-[11px] py-[5px] border no-underline hover:no-underline ${
                activePreset === p.label
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : "border-[var(--color-line)] bg-transparent text-[var(--color-ink-2)]"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  `t-small rounded-full px-[14px] py-[7px] border no-underline hover:no-underline ${
    on
      ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
      : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
  }`;
