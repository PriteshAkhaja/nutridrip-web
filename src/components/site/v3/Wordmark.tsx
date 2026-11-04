/**
 * The public site's mark, as the client set it: the NutriDrip™ wordmark over
 * "IV NUTRIENT THERAPY", in type (no image). Invoices and the consoles keep
 * LogoMark (components/layout/Logo.tsx).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`nd-mark ${className}`.trim()}>
      <b>
        NutriDrip<sup>™</sup>
      </b>
      <small>IV NUTRIENT THERAPY</small>
    </span>
  );
}
