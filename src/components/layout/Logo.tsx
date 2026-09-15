import Link from "next/link";

/**
 * The mark is itself a Fill — a vessel filled 62% with the accent. It is the
 * one place the primitive is allowed to carry no number, because it names the
 * product rather than measuring anything.
 *
 * Drawn out of background colours, which is why it carries `print-exact`: a
 * browser strips backgrounds when printing unless told otherwise, and without
 * it the mark came out of every prescription and invoice as an empty outline.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="print-exact relative overflow-hidden flex-none inline-block"
      style={{
        width: size,
        height: size,
        border: "1px solid var(--color-primary-line)",
        borderRadius: size / 3,
        background: "var(--color-primary-soft)",
      }}
      aria-hidden
    >
      <span
        className="print-exact absolute left-0 right-0 bottom-0 bg-[var(--color-primary)]"
        style={{ height: "62%" }}
      />
    </span>
  );
}

export function Logo({ size = 24, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-[10px] no-underline hover:no-underline">
      <LogoMark size={size} />
      <span
        className="text-[var(--color-ink)]"
        style={{ font: `600 ${Math.round(size * 0.67)}px/1 var(--font-display)`, letterSpacing: "-0.01em" }}
      >
        NutriDrip
      </span>
    </Link>
  );
}
