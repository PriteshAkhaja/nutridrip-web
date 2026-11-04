import Link from "next/link";
import type { CSSProperties } from "react";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import type { ContentKey } from "@/lib/content";
import { can } from "@/lib/auth/rbac";
import type { Role } from "@/lib/models/types";
import { Cta } from "@/components/site/v3/Cta";
import { BookSection, type BookFacts } from "@/components/site/v3/BookSection";
import { Photo } from "@/components/site/Photo";
import type { SiteImage } from "@/lib/site-images";
import { AboutMotion } from "./AboutMotion";
import { Crumbs } from "@/components/site/v3/Crumbs";

/**
 * About, in the client's design. The client's page is about a named doctor,
 * and no named doctor, story or figures exist in our records (PAGES.md 3c),
 * so it carries ours: the headline, intro and mission (content.ts), figures
 * counted from the live service, the three teams, and the peak: the line
 * between them, what each role can and cannot do in the app, read from the
 * permission matrix itself (lib/auth/rbac.ts).
 */

type Copy = Record<ContentKey, string>;
const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** The columns: the three teams a patient meets, by their role in the app. */
const TEAMS: Array<{ role: Role; name: string }> = [
  { role: "doctor", name: "Physician" },
  { role: "nurse", name: "Nurse" },
  { role: "admin", name: "Operations" },
];

export function About({
  copy,
  facts,
  figures,
  photos,
}: {
  copy: Copy;
  facts: BookFacts;
  figures: { drips: number; zones: number };
  /** Each team's photo, only once a real one is uploaded. */
  photos: { physicians: SiteImage | null; nurses: SiteImage | null; pharmacy: SiteImage | null };
}) {
  const n = CHECKLIST_STEPS.length;
  const FIGURES: Array<{ value: number; unit?: string; label: string }> = [
    { value: figures.drips, label: "drips, every dose published" },
    { value: figures.zones, label: "zones across Bengaluru" },
    { value: n, label: "steps in every session" },
    { value: APPROVAL_VALID_DAYS, unit: "days", label: "how long an approval lasts" },
  ];

  // The line: each row asks the permission matrix (or, for the last, the
  // checklist's own rule, which no role can get round).
  const LINE: Array<{ act: string; why: string; allowed: (r: Role) => boolean }> = [
    {
      act: "Approve, change or decline your protocol",
      why: "A prescribing decision, so it belongs to a registered physician. Operations can watch the queue, not make the call.",
      allowed: (r) => can(r, "quiz.decide"),
    },
    {
      act: "Read your lab reports",
      why: "A lab report is your own medical document: you and the physician read it, and operations staff do not.",
      allowed: (r) => can(r, "labs.view"),
    },
    {
      act: "Clear a session stopped on vitals",
      why: "The nurse who took the reading cannot clear it. The physician decides, under their own name.",
      // The clear-vitals route admits the physician (and the super admin) alone.
      allowed: (r) => r === "doctor",
    },
    {
      act: "Work the checklist at your door",
      why: "The nurse, with you, step by step and in order.",
      allowed: (r) => can(r, "infusion.prepare"),
    },
    {
      act: "Dispatch stock, soonest expiry first",
      why: "Expired and quarantined lots are never counted as available, so they are never sent.",
      allowed: (r) => can(r, "orders.dispatch"),
    },
    {
      act: "Trace a recalled batch to every patient",
      why: "Every vial is recorded against its session, so a recall names everyone who received it the same day.",
      allowed: (r) => can(r, "recall.trace"),
    },
    {
      act: "Skip a mandatory checklist step",
      why: "No one. The app will not close a step while an earlier mandatory one is open.",
      allowed: () => false,
    },
  ];

  const ROLES: Array<{ title: string; photo: SiteImage | null; body: string }> = [
    {
      title: "Physicians",
      photo: photos.physicians,
      body: "Registered doctors read every health quiz, call you, and approve, change or decline the protocol. They write treatment plans, clear a session stopped on out-of-range vitals, and review anything a nurse files. Their name and registration sit on your session report.",
    },
    {
      title: "Nurses",
      photo: photos.nurses,
      body: "Registered nurses come to you, take baseline vitals, capture your consent and work the checklist in order. They cannot skip a mandatory step and cannot clear their own vitals block: that is deliberate, and it is why they are trusted with the rest.",
    },
    {
      title: "Pharmacy and operations",
      photo: photos.pharmacy,
      body: "The team behind the scenes keeps stock by batch and expiry, dispatches the soonest expiry first, seals the kits, and can name every patient who received a batch if its maker recalls it.",
    },
  ];

  return (
    <AboutMotion drips={facts.drips}>
      <section className="nd-pagehead ab-head">
        <div className="nd-wrap">
          <Crumbs trail={[{ name: "About" }]} />
          <h1 className="nd-q">{copy["about.headline"]}</h1>
          <p className="nd-lede">{copy["about.intro"]}</p>
          <div className="ab-head__go">
            <Cta />
            <Link className="nd-btn nd-btn--ghost" href="/consult" prefetch={false}>
              Ask a clinician
            </Link>
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight ab-facts" aria-labelledby="facts-h">
        <div className="nd-wrap">
          <h2 id="facts-h" className="visually-hidden">
            NutriDrip in figures
          </h2>
          <dl className="ab-facts__row" data-sc-in="" data-sc-stagger="70">
            {FIGURES.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>
                  <span className="nd-num" data-sc-count={`0 ${f.value}`}>
                    {f.value}
                  </span>
                  {f.unit ? <small>{f.unit}</small> : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className="nd-small ab-facts__note">Counted from the live service, not rounded up.</p>
        </div>
      </section>

      <section className="sc-section ab-mission" aria-labelledby="mission-h">
        <div className="nd-wrap ab-mission__grid">
          <div data-sc-in="">
            <p className="nd-tag">What we are trying to do</p>
            <h2 id="mission-h" className="nd-q nd-q--sm">
              A procedure, not a treat.
            </h2>
          </div>
          <p className="ab-mission__text" data-sc-in="">
            {copy["about.mission"]}
          </p>
        </div>
      </section>

      <section className="sc-section nd-section--tight ab-teams" aria-labelledby="teams-h">
        <div className="nd-wrap">
          <div className="ab-teams__head" data-sc-in="">
            <p className="nd-tag">Who does what</p>
            <h2 id="teams-h" className="nd-q nd-q--sm">
              Three teams, and a line between them.
            </h2>
          </div>
          <div className="ab-teams__grid" data-sc-in="" data-sc-stagger="90">
            {ROLES.map((r) => (
              <article key={r.title} className={`ab-team${r.photo ? " ab-team--photo" : ""}`}>
                {/* Admin → Site images, About: shown only once a real photo is uploaded. */}
                {r.photo ? (
                  <Photo
                    image={r.photo}
                    className="ab-team__pic"
                    radius="16px"
                    sizes="(min-width: 861px) 30vw, 92vw"
                    decorative={!r.photo.alt}
                  />
                ) : null}
                <h3 className="ab-team__h">{r.title}</h3>
                <p className="ab-team__b">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The line: row by row, what each team can do in the app. */}
      <section
        className="ab-line act-res"
        data-sc-act="pin"
        data-sc-span="4"
        style={vars({ "--span": 4, "--span-m": 4.4 })}
        aria-labelledby="line-h"
      >
        <div data-sc-stage="" className="ab-line__stage" data-sc-verify-state="0">
          <div className="nd-wrap ab-line__in">
            <div className="ab-line__head">
              <h2 id="line-h" className="nd-q nd-q--sm">
                The line, as the app draws it.
              </h2>
              <p className="nd-body">
                The safeguards are not a policy document: they are what each role can and cannot do in the software the
                team works in.
              </p>
            </div>
            <table className="ab-matrix">
              <caption className="visually-hidden">What each team can do in the app</caption>
              <thead>
                <tr>
                  <td />
                  {TEAMS.map((t) => (
                    <th key={t.role} scope="col">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LINE.map((l, i) => (
                  <tr key={l.act} className={i === 0 ? "is-in is-now" : undefined}>
                    <th scope="row">
                      {l.act}
                      <span className="ab-matrix__why">{l.why}</span>
                    </th>
                    {TEAMS.map((t) => {
                      const yes = l.allowed(t.role);
                      return (
                        <td key={t.role} className={yes ? "is-yes" : "is-no"}>
                          <span className="ab-matrix__mark" aria-hidden="true" />
                          <span className="ab-matrix__word">{yes ? "Can" : "Cannot"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className="ab-line__why" aria-label="Why">
              {LINE.map((l, i) => (
                <li key={l.act} className={i === 0 ? "is-now" : undefined}>
                  {l.why}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="sc-section nd-section--tight ab-more" aria-labelledby="more-h">
        <h2 id="more-h" className="visually-hidden">
          The company, and where to read more
        </h2>
        <div className="nd-wrap nd-grid2" data-sc-in="" data-sc-stagger="90">
          <div className="nd-callout ab-more__card">
            <p className="nd-tag">The registered entity</p>
            <p className="ab-more__h">{copy["footer.legalName"]}</p>
            <p className="nd-body">
              Clinical establishment registration <span className="nd-num">{copy["footer.registration"]}</span>.
            </p>
            <p className="ab-more__links">
              <Link className="nd-link" href="/legal/terms" prefetch={false}>
                Terms
              </Link>
              <Link className="nd-link" href="/legal/privacy" prefetch={false}>
                Privacy
              </Link>
              <Link className="nd-link" href="/legal/grievance" prefetch={false}>
                Grievance officer
              </Link>
            </p>
          </div>
          <div className="nd-callout ab-more__card">
            <p className="nd-tag">Read the detail</p>
            <p className="ab-more__h">Rather see it than take our word?</p>
            <p className="nd-body">
              The Safety page lists all {n} checklist steps and the vital-sign limits that stop an infusion. How it
              works follows one session from the quiz to the report.
            </p>
            <p className="ab-more__links">
              <Link className="nd-link" href="/safety" prefetch={false}>
                Safety
              </Link>
              <Link className="nd-link" href="/how-it-works" prefetch={false}>
                How it works
              </Link>
              <Link className="nd-link" href="/faqs" prefetch={false}>
                FAQs
              </Link>
            </p>
          </div>
        </div>
      </section>

      <BookSection facts={facts} />
    </AboutMotion>
  );
}
