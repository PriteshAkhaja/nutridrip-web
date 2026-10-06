"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { EFFECTS, type EffectName } from "./effects";

/**
 * Mounts one of the site's scroll moments (./effects.ts) on the server-rendered
 * content inside it, and removes it again on navigation. Never under reduced
 * motion: there, and before the script runs, the content is exactly what the
 * server drew. `as` keeps the markup what it should be (a <p>, a <div>).
 */
export function ScrollEffect({
  effect,
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: {
  effect: EffectName;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return EFFECTS[effect](ref.current);
  }, [effect]);
  return (
    <Tag ref={ref} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}
