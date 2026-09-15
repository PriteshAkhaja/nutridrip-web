import type { PlanSessionView } from "@/lib/data/plans";

/**
 * A written course, read-only, on a phone.
 *
 * Every drug is shown with its dose and how it is given. A nurse is drawing
 * these up at the bedside and a patient is being asked to consent to them, so
 * neither is served by a summary — "Myers' Revive" alone tells you nothing
 * about the 15,000 mg that changed since last week.
 *
 * Sessions whose day has passed are dimmed rather than hidden: a course reads
 * as a course, and the patient can see what has already been given.
 */
export function PlanSchedule({ sessions }: { sessions: PlanSessionView[] }) {
  if (sessions.length === 0) {
    return (
      <p className="t-small text-[var(--color-ink-3)]">
        This plan has no sessions written into it yet.
      </p>
    );
  }

  const weeks = [...new Set(sessions.map((s) => s.weekNum))];

  return (
    <div className="flex flex-col gap-6">
      {weeks.map((weekNum) => {
        const inWeek = sessions.filter((s) => s.weekNum === weekNum);
        return (
          <section key={weekNum}>
            <span className="t-micro block mb-3">
              Week {weekNum} · {inWeek.length} session{inWeek.length === 1 ? "" : "s"}
            </span>
            <div className="flex flex-col gap-3">
              {inWeek.map((s) => (
                <article
                  key={s.key}
                  className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 ${
                    s.past ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="t-data text-[14.5px]">{s.date}</span>
                    {s.past ? (
                      <span className="t-small text-[var(--color-ink-3)]">Date passed</span>
                    ) : null}
                  </div>
                  <h3 className="t-body font-semibold mt-1">{s.dripName}</h3>

                  {s.components.length > 0 ? (
                    <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-[6px]">
                      {s.components.map((c, i) => (
                        <li key={`${s.key}-${i}`} className="t-small text-[var(--color-ink-2)]">
                          <span className="t-data text-[13px] text-[var(--color-ink)]">
                            {c.name} {c.dose.toLocaleString("en-IN")} {c.unit}
                          </span>{" "}
                          — {c.route}
                          {c.carrier && c.carrier !== "—" ? ` in ${c.carrier}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="t-small text-[var(--color-ink-3)] mt-2">
                      As per the standard recipe for this drip.
                    </p>
                  )}

                  {s.note ? (
                    <p className="t-small text-[var(--color-ink-2)] mt-3 pt-3 border-t border-[var(--color-line)]">
                      <span className="t-micro block mb-1">Note from the physician</span>
                      {s.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
