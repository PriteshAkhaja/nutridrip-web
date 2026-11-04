/* eslint-disable @next/next/no-img-element -- the bag is sized by the site's
   own stylesheet, with fixed dimensions. */
import Link from "next/link";
import type { CSSProperties, Ref } from "react";
import type { CatalogueDrip } from "@/lib/data/assembly";
import type { SiteImage } from "@/lib/site-images";
import { Photo } from "@/components/site/Photo";
import { dose, duration, inr } from "@/components/site/home/format";

const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** A clear bag filled with the drip's tint. */
export function Bag({ tint }: { tint: string }) {
  return (
    <div className="nd-bag" style={vars({ "--tint": tint, "--fill": 1 })} aria-hidden="true">
      <div className="nd-bag__fill" />
      <img
        className="nd-bag__img"
        src="/site/v3/bag-empty.webp"
        width={577}
        height={1200}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/**
 * A drip's card: the landing formulary's, shared with the Drips list. Its bag
 * in the drip's colour, or the admin's upload in the bag's place (the user's
 * rule, 2026-11-03), then every dose. Styles in styles/fcard.css.
 */
export function Fcard({
  d,
  k,
  photo = null,
  stock = null,
  hidden,
  ref,
}: {
  d: CatalogueDrip;
  /** Its place in the row, for the landing rail's entry tilt. */
  k: number;
  /** The admin's upload (uploadedDripPhotos), never a shipped stand-in. */
  photo?: SiteImage | null;
  /** Sessions the stock can make up now; shown only when low or out. */
  stock?: number | null;
  hidden?: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const inBag = d.items.filter((i) => !i.separate);
  const sep = d.items.filter((i) => i.separate);
  return (
    <article
      ref={ref}
      className="fcard"
      style={vars({ "--tint": d.tint, "--i": k })}
      aria-labelledby={`fc-${d.slug}`}
      hidden={hidden}
    >
      <div className="fcard__top">
        {photo ? (
          <div className="fcard__bag fcard__bag--photo">
            <Photo image={photo} fill sizes="68px" decorative={!photo.alt} />
          </div>
        ) : (
          <div className="fcard__bag" data-sc-tilt="6">
            <Bag tint={d.tint} />
          </div>
        )}
        <div className="fcard__head">
          <h3 id={`fc-${d.slug}`}>{d.name}</h3>
          <p className="fcard__cat">
            {d.category ?? "Wellness"}
            <span>{duration(d)}</span>
          </p>
          <p className="fcard__price">{inr(d.priceInr)}</p>
          {d.isPopular ? <p className="fcard__prem">Most booked</p> : null}
        </div>
      </div>
      <div>
        <p className="fcard__k">Inside the bag</p>
        <ul>
          {d.carrier ? (
            <li>
              {d.carrier.name} {dose(d.carrier)}
            </li>
          ) : null}
          {inBag.map((i) => (
            <li key={i.name}>
              {i.name} {dose(i)}
            </li>
          ))}
        </ul>
      </div>
      {sep.length ? (
        <div>
          <p className="fcard__k">Given separately</p>
          <ul className="fcard__sep">
            {sep.map((i) => (
              <li key={i.name}>
                {i.name} {dose(i)}
                {i.notes ? ` (${i.notes.toLowerCase()})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {d.tagline ? <p className="fcard__for">{d.tagline}.</p> : null}
      {stock !== null && stock <= 3 ? (
        <p className={stock === 0 ? "fcard__stock fcard__stock--out" : "fcard__stock"}>
          {stock === 0 ? "Out of stock" : `Only ${stock} left today`}
        </p>
      ) : null}
      <Link className="nd-link fcard__link" href={`/drips/${d.slug}`} prefetch={false}>
        Every dose, in full<span className="visually-hidden"> for {d.name}</span>
      </Link>
    </article>
  );
}
