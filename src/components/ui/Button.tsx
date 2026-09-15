import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/** Every interactive target is at least 44px tall — the mobile apps depend on it. */
const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3 text-[13px]",
  md: "min-h-[44px] px-4 text-[13px]",
  lg: "min-h-[52px] px-5 text-[14.5px]",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:border-[var(--color-primary-dark)] active:translate-y-px",
  secondary:
    "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:bg-[var(--color-primary-soft)]",
  ghost:
    "border-transparent bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] active:bg-[var(--color-primary-line)]",
  danger:
    "border-[var(--color-critical)] bg-[var(--color-critical)] text-white hover:brightness-95 active:translate-y-px",
};

const BASE =
  "inline-flex items-center justify-center gap-[9px] rounded-[var(--radius-sm)] border font-semibold " +
  "leading-[1.25] cursor-pointer transition-all duration-150 ease-out " +
  "disabled:cursor-not-allowed disabled:border-[var(--color-line)] disabled:bg-[var(--color-surface-2)] " +
  "disabled:text-[var(--color-ink-3)] disabled:hover:bg-[var(--color-surface-2)] disabled:active:translate-y-0";

function Spinner({ light }: { light: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 rounded-full animate-spin"
      style={{
        border: `2px solid ${light ? "rgba(255,255,255,.4)" : "var(--color-line)"}`,
        borderTopColor: light ? "#FFFFFF" : "var(--color-primary)",
      }}
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const light = variant === "primary" || variant === "danger";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${SIZE[size]} ${VARIANT[variant]} ${block ? "w-full" : ""} ${className}`}
    >
      {loading && <Spinner light={light} />}
      {children}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      className={`${BASE} ${SIZE[size]} ${VARIANT[variant]} no-underline hover:no-underline ${
        block ? "w-full" : ""
      } ${className}`}
    >
      {children}
    </Link>
  );
}
