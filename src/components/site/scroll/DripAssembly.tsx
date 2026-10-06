"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { AssemblyDrip } from "@/lib/data/assembly";
import { ROOM } from "./assembly-assets";
import { mountAssembly, type Opening } from "./assembly";
import styles from "./DripAssembly.module.css";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const fmt = (n: number) => Number(n).toLocaleString("en-IN");

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = matchMedia(reducedQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/**
 * The drip assembles itself (see ./assembly.ts for the score). On the home
 * page the act opens on the page's own hero (`hero`, server-rendered: the
 * badge, the headline, the quiz) set over the drip's real containers; on a
 * drip page there is no hero and it opens on the containers in a row. Either
 * way it ends in a room at the last bookable time, with the quiz (`actions`).
 *
 * Every word is here as real text; the pictures are built by assembly.ts and
 * are aria-hidden. Under reduced motion there is no pin and no travel: three
 * still frames, the hero, the bag with its full list beside it, and the room.
 */
export function DripAssembly({
  drip,
  hero,
  heroId,
  id,
  actions,
  zones,
  lastSlot,
  call,
  nurse = "given at home by a council-registered nurse",
  physician = "A physician reviews you first, before anything is booked",
}: {
  drip: AssemblyDrip;
  /** The page's own hero, on the home page. Without it the act opens on the spread. */
  hero?: ReactNode;
  /** The id of the <h1> inside `hero`, for the section's label. */
  heroId?: string;
  /** The section's id, e.g. for the phone booking bar to step aside while it shows. */
  id?: string;
  actions: ReactNode;
  /** How many zones we serve. */
  zones: number;
  /** The latest bookable time, already formatted to the site's clock. */
  lastSlot: string | null;
  /** The physician call, from the editable copy: "15 min phone call with your physician". */
  call: string;
  /** Who gives it and who approves it, from the home hero's promises. */
  nurse?: string;
  physician?: string;
}) {
  const opening: Opening = hero ? "hero" : "spread";
  const titleId = heroId ?? `asm-${drip.slug}`;
  const ref = useRef<HTMLElement>(null);
  const still = useSyncExternalStore(
    subscribe,
    () => matchMedia(reducedQuery).matches,
    () => false
  );

  useEffect(() => {
    if (!ref.current) return;
    return mountAssembly(ref.current, drip, still, opening);
  }, [drip, still, opening]);

  const inBag = drip.items.filter((i) => !i.separate);
  const count = `${WORDS[inBag.length] ?? inBag.length} ingredient${inBag.length === 1 ? "." : "s."}`;
  const name = drip.name.endsWith(".") ? drip.name : `${drip.name}.`;
  const mins = drip.durationToMin ? `${drip.durationMin} to ${drip.durationToMin} min` : `${drip.durationMin} min`;
  const formula = [
    ...inBag.map((i) => ({ name: i.name, dose: `${fmt(i.dose)} ${i.unit}` })),
    ...(drip.carrier ? [{ name: drip.carrier.name, dose: `${fmt(drip.carrier.dose)} ${drip.carrier.unit}` }] : []),
    // Not in the bag, and never on its label, but part of the session.
    ...drip.items
      .filter((i) => i.separate)
      .map((i) => ({ name: `${i.name} (given separately)`, dose: `${fmt(i.dose)} ${i.unit}` })),
  ];

  const ground = (
    <>
      <div className={styles.ink} data-asm-ink aria-hidden />
      <div className={styles.ring} data-asm-ring aria-hidden>
        <i />
      </div>
      <div className={styles.point} data-asm-point aria-hidden />
    </>
  );
  const room = (
    <div className={styles.room} data-asm-room aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- placed by object-position in px, measured against the stand */}
      <img
        className={styles.roomImg}
        data-asm-room-img
        src={ROOM.src}
        alt=""
        width={2200}
        height={1238}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.roomScrim} />
    </div>
  );
  const heroBlock = hero ? (
    <div className={styles.hero} data-asm-hero>
      {hero}
    </div>
  ) : null;
  // On a drip page the count is the act's title: it greets, already in place.
  const countTitle = (
    <h2 id={hero ? undefined : titleId} className={styles.count} data-asm-count>
      {count}
    </h2>
  );
  const captions = (
    <ol className={styles.captions} aria-label={`${drip.name}: what goes in`}>
      {drip.items.map((i) => (
        <li key={i.name} data-asm-cap>
          <b>{i.name}</b>
          <span>
            {fmt(i.dose)} {i.unit}
          </span>
          {i.separate ? <em>Given separately</em> : null}
        </li>
      ))}
    </ol>
  );
  const one = (
    <h2 className={styles.one} data-asm-one>
      One drip. <span>{name}</span>
    </h2>
  );
  const readout = (
    <p className={styles.readout} data-asm-readout aria-hidden>
      <span data-asm-num>0</span> ml
    </p>
  );
  const cards = (
    <>
      <div className={`${styles.card} ${styles.cardA}`} data-asm-card="a">
        <p>
          {mins}, {nurse}.
        </p>
      </div>
      <div className={`${styles.card} ${styles.cardB}`} data-asm-card="b">
        <p>{physician}.</p>
      </div>
    </>
  );
  const grounded = (
    <div className={styles.grounded} data-asm-grounded>
      {lastSlot ? <p className={styles.time}>{lastSlot}</p> : null}
      <p className={styles.line}>
        A nurse at your door, in any of {zones} zones across Bengaluru, after a {call}.
      </p>
      <div className={styles.actions}>{actions}</div>
    </div>
  );
  const formulaList = (
    <ul className={styles.formula} aria-label={`${drip.name}: composition`}>
      {formula.map((f) => (
        <li key={f.name}>
          <span>{f.name}</span>
          <span>{f.dose}</span>
        </li>
      ))}
    </ul>
  );

  if (still) {
    return (
      <section ref={ref} id={id} className={`${styles.root} ${styles.still}`} aria-labelledby={titleId}>
        <div className={styles.stage} data-asm-stage>
          <div className={styles.glass} data-asm-glass aria-hidden />
          {heroBlock ?? (
            <>
              {countTitle}
              {captions}
            </>
          )}
        </div>
        <div className={styles.stage} data-asm-stage>
          {ground}
          <div className={styles.bagwrap} aria-hidden>
            <div data-asm-bag />
          </div>
          {one}
          {formulaList}
        </div>
        <div className={styles.stage} data-asm-stage>
          {room}
          {grounded}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id={id} className={styles.root} aria-labelledby={titleId}>
      <div className={styles.stage} data-asm-stage>
        {ground}
        {room}
        <div className={styles.glass} data-asm-glass aria-hidden />
        <div className={styles.bagwrap} aria-hidden>
          <div data-asm-bag />
        </div>
        {heroBlock}
        {countTitle}
        {one}
        {readout}
        {captions}
        <ul className={styles.srOnly}>
          {formula.map((f) => (
            <li key={f.name}>
              {f.name}, {f.dose}
            </li>
          ))}
        </ul>
        {cards}
        {grounded}
      </div>
    </section>
  );
}
