import { zoneForPincode } from "@/lib/zones";
import { CATEGORIES } from "@/lib/data/marketing";

/**
 * The consultation request form, as logic.
 *
 * A request lands in the same Lead collection as a clinic enquiry, with
 * `kind: "consult"`. Lead has one free-text `message`, so the structured parts
 * — what they want to talk about, when to ring — are written into it in a fixed
 * shape rather than into new fields. That keeps the model and the admin's
 * enquiries screen as they were, and the message stays readable exactly as the
 * person on the other end will read it.
 */

export const CONSULT_TOPICS: string[] = [...CATEGORIES.map((c) => c.name), "Something else"];

export const CONTACT_WINDOWS = ["Any time", "Morning", "Afternoon", "Evening"] as const;
export type ContactWindow = (typeof CONTACT_WINDOWS)[number];

/** Lead.message is capped at 2000 by the API; stay under it rather than be refused. */
export const CONSULT_MESSAGE_MAX = 2000;

export function composeConsultMessage(input: {
  topics?: string[];
  window?: string;
  question?: string;
}): string {
  // Only topics this form offered. The list is echoed back from a browser, so
  // it is checked here instead of trusted.
  const topics = (input.topics ?? []).filter((t) => CONSULT_TOPICS.includes(t));
  const window = CONTACT_WINDOWS.find((w) => w === input.window);
  const question = (input.question ?? "").trim();

  const head: string[] = [];
  if (topics.length) head.push(`Topics: ${topics.join(", ")}`);
  // "Any time" is the default, so it says nothing worth a line.
  if (window && window !== "Any time") head.push(`Best time to call: ${window}`);

  const top = head.join("\n");
  if (!top) return question.slice(0, CONSULT_MESSAGE_MAX);
  if (!question) return top;

  // Trim the question, never the header: what they ticked is short and is what
  // the person ringing them reads first.
  const room = CONSULT_MESSAGE_MAX - top.length - 2;
  return `${top}\n\n${question.slice(0, Math.max(0, room))}`;
}

/** Enough to be able to reply: a name, and some way of reaching them. */
export function consultReady(f: { name?: string; phone?: string; email?: string }): boolean {
  return Boolean((f.name ?? "").trim() && ((f.phone ?? "").trim() || (f.email ?? "").trim()));
}

export type PincodeHint = { tone: "safe" | "caution" | "critical"; text: string };

/**
 * Whether we reach a pincode — so somebody finds out while they are still
 * typing, not after they have written a paragraph. It informs and never blocks:
 * a request from outside the zones is still worth having, and the same shape
 * as the booking guard's straight yes or no.
 */
export function pincodeHint(pincode: string | null | undefined): PincodeHint | null {
  const pin = (pincode ?? "").replace(/\D/g, "");
  if (pin.length < 6) return null;
  if (pin.length > 6) return { tone: "critical", text: "A pincode is six digits." };

  const zone = zoneForPincode(pin);
  if (!zone) {
    return {
      tone: "critical",
      text: "We do not serve that pincode yet. You can still ask us a question.",
    };
  }
  return zone.status === "limited"
    ? { tone: "caution", text: `${zone.name} — we serve it, with shorter hours (${zone.window}).` }
    : { tone: "safe", text: `${zone.name} — we serve it.` };
}
