/**
 * The liquid inside a bag (.nd-bag__fill), shared by the landing's build and
 * the drip page's companion bag. The level starts empty; liquid.ts moves it.
 */
export function LiquidFill({ drops, rings, blooms = 0 }: { drops: number; rings: number; blooms?: number }) {
  return (
    <div className="nd-bag__fill">
      <div className="liq">
        <div className="liq__level" data-liq-level="">
          <Wave back />
          <Wave />
        </div>
        {/* Clouds of an ingredient's colour rising into the liquid as it goes
            in (the drip page, motion-v4): kept under the surface (--liq-y). */}
        {blooms ? (
          <div className="liq__blooms" aria-hidden="true">
            {Array.from({ length: blooms }, (_, i) => (
              <i key={i} className="liq__bloom" />
            ))}
          </div>
        ) : null}
      </div>
      {Array.from({ length: drops }, (_, i) => (
        <i key={`d${i}`} className="liq__drop" />
      ))}
      {Array.from({ length: rings }, (_, i) => (
        <i key={`r${i}`} className="liq__ring" />
      ))}
    </div>
  );
}

function Wave({ back = false }: { back?: boolean }) {
  return (
    <div className={back ? "liq__wave liq__wave--back" : "liq__wave"}>
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
        <path className="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z" />
        <path className="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6" />
      </svg>
    </div>
  );
}

/** The client's label mark: an infinity. */
export function InfinityMark() {
  return (
    <svg viewBox="0 0 100 50" aria-hidden="true">
      <path
        d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
