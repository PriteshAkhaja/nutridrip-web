import type { CSSProperties, ElementType, ReactNode } from "react";

/** A stagger for [data-reveal] elements: `style={delay(120)}`. */
export function delay(ms: number, style?: CSSProperties): CSSProperties {
  return { ...style, ["--reveal-delay" as string]: `${ms}ms` };
}

/**
 * The one content width for the whole public site: the header's. Every band
 * lines up with the logo above it, and nothing runs wider than 1280px however
 * big the screen, so a line of text never becomes a long walk for the eye.
 */
export function Container({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return <Tag className={`mx-auto w-full max-w-[1280px] px-6 md:px-10 ${className}`}>{children}</Tag>;
}

/**
 * Eyebrow, heading, lede: the opening of nearly every section. Arrives in a
 * short stagger. `action` sits at the right on wide screens and drops under the
 * lede on narrow ones.
 */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "left",
  action,
  id,
  className = "",
  titleClassName = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
  /** For aria-labelledby on the section. */
  id?: string;
  className?: string;
  titleClassName?: string;
}) {
  const centred = align === "center";
  const text = (
    <div className={`flex flex-col gap-4 min-w-0 ${centred ? "items-center text-center" : ""}`}>
      {eyebrow ? (
        <span className="t-eyebrow" data-reveal>
          {eyebrow}
        </span>
      ) : null}
      <h2
        id={id}
        className={`t-section ${centred ? "max-w-[22ch]" : "max-w-[19ch]"} ${titleClassName}`}
        data-reveal
        style={delay(70)}
      >
        {title}
      </h2>
      {lede ? (
        <p className={`t-lead ${centred ? "max-w-[58ch]" : "max-w-[56ch]"}`} data-reveal style={delay(140)}>
          {lede}
        </p>
      ) : null}
    </div>
  );

  if (!action) return <div className={`mb-12 md:mb-14 ${className}`}>{text}</div>;

  return (
    <div
      className={`mb-12 md:mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10 ${className}`}
    >
      {text}
      <div className="flex-none" data-reveal style={delay(200)}>
        {action}
      </div>
    </div>
  );
}
