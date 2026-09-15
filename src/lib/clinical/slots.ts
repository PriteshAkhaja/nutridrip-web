/** The slot grid a patient books into. Nurses run to these windows. */
export const SLOTS = ["08:00", "10:00", "11:30", "13:30", "16:00", "18:30"];

/**
 * The next `count` days after `from`, at midnight — as far ahead as slots are
 * released.
 *
 * Which days these are depends on the clock and the timezone, so a client
 * component that computed them itself would render one list on the server and
 * possibly another after hydration. The server decides; `releasedDays()` is
 * what it hands down.
 */
export function nextDays(count = 5, from = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

export function slotDate(day: Date, slot: string): Date {
  const [h, m] = slot.split(":").map(Number);
  const when = new Date(day);
  when.setHours(h, m, 0, 0);
  return when;
}

/** Inside this window the nurse is already dispatched with the batch drawn. */
export const LATE_CHANGE_HOURS = 4;
export const LATE_CANCEL_FEE_INR = 500;

/** The released days as ISO strings, for handing from a server component to a client one. */
export function releasedDays(count = 5): string[] {
  return nextDays(count).map((d) => d.toISOString());
}
