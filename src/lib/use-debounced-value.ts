"use client";

import { useEffect, useState } from "react";

/**
 * The value, but only once it has stopped changing for `delay` milliseconds.
 *
 * Used where a change costs something — a server round trip, a billed API call
 * — so that typing "glutathione" is one request rather than eleven. Where a
 * change is free, such as filtering an array already in the browser, do not
 * use this: a delay there only makes a fast thing feel slow.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
