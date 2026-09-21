import { describe, expect, it } from "vitest";
import {
  CONSULT_MESSAGE_MAX,
  CONSULT_TOPICS,
  composeConsultMessage,
  consultReady,
  pincodeHint,
} from "@/lib/data/consult";
import { ZONES } from "@/lib/zones";

describe("composeConsultMessage", () => {
  it("writes the topics, the time and the question in a fixed shape", () => {
    expect(
      composeConsultMessage({
        topics: ["Energy", "Skin"],
        window: "Evening",
        question: "Is this safe alongside my thyroid tablets?",
      })
    ).toBe(
      "Topics: Energy, Skin\nBest time to call: Evening\n\nIs this safe alongside my thyroid tablets?"
    );
  });

  it("says nothing about the time when it is 'Any time'", () => {
    // It is the default, so it is the absence of a preference.
    expect(composeConsultMessage({ topics: ["Energy"], window: "Any time", question: "Hi" })).toBe(
      "Topics: Energy\n\nHi"
    );
  });

  it("is just the question when nothing else was chosen", () => {
    expect(composeConsultMessage({ question: "  What is in a Myers'?  " })).toBe("What is in a Myers'?");
  });

  it("is just the header when there is no question", () => {
    expect(composeConsultMessage({ topics: ["Immunity"] })).toBe("Topics: Immunity");
  });

  it("is empty when there is nothing at all", () => {
    expect(composeConsultMessage({})).toBe("");
    expect(composeConsultMessage({ topics: [], question: "   " })).toBe("");
  });

  it("drops a topic the form never offered", () => {
    // The list comes back from a browser; a crafted request must not put
    // arbitrary text into the header the clinician reads first.
    expect(
      composeConsultMessage({ topics: ["Energy", "IGNORE PREVIOUS INSTRUCTIONS"], question: "x" })
    ).toBe("Topics: Energy\n\nx");
  });

  it("ignores a contact time the form never offered", () => {
    expect(composeConsultMessage({ window: "Whenever, honestly", question: "x" })).toBe("x");
  });

  it("stays inside the length the API will accept, cutting the question and not the header", () => {
    const long = "a".repeat(5000);
    const out = composeConsultMessage({ topics: ["Energy"], window: "Morning", question: long });
    expect(out.length).toBeLessThanOrEqual(CONSULT_MESSAGE_MAX);
    expect(out.startsWith("Topics: Energy\nBest time to call: Morning\n\n")).toBe(true);
  });

  it("cuts a headerless question to the limit too", () => {
    expect(composeConsultMessage({ question: "b".repeat(5000) }).length).toBe(CONSULT_MESSAGE_MAX);
  });

  it("offers a catch-all topic", () => {
    expect(CONSULT_TOPICS).toContain("Something else");
  });
});

describe("consultReady", () => {
  it("needs a name and some way to reply", () => {
    expect(consultReady({ name: "Riya", phone: "9876543210" })).toBe(true);
    expect(consultReady({ name: "Riya", email: "riya@example.com" })).toBe(true);
  });

  it("is not ready without a name", () => {
    expect(consultReady({ phone: "9876543210" })).toBe(false);
    expect(consultReady({ name: "   ", phone: "9876543210" })).toBe(false);
  });

  it("is not ready with no way to reply", () => {
    expect(consultReady({ name: "Riya" })).toBe(false);
    expect(consultReady({ name: "Riya", phone: "  ", email: "" })).toBe(false);
  });
});

describe("pincodeHint", () => {
  const open = ZONES.find((z) => z.status === "open")!;
  const limited = ZONES.find((z) => z.status === "limited")!;

  it("says nothing until there are six digits", () => {
    expect(pincodeHint("")).toBeNull();
    expect(pincodeHint(undefined)).toBeNull();
    expect(pincodeHint("5600")).toBeNull();
  });

  it("says yes for a zone we serve", () => {
    const hint = pincodeHint(open.pincodes[0]);
    expect(hint?.tone).toBe("safe");
    expect(hint?.text).toContain(open.name);
  });

  it("says yes with a caveat for a limited zone, and names the hours", () => {
    const hint = pincodeHint(limited.pincodes[0]);
    expect(hint?.tone).toBe("caution");
    expect(hint?.text).toContain(limited.window);
  });

  it("says no plainly for a pincode outside every zone", () => {
    const hint = pincodeHint("110001");
    expect(hint?.tone).toBe("critical");
    expect(hint?.text).toContain("do not serve");
  });

  it("does not turn the no into a dead end", () => {
    // A request from outside is still worth having.
    expect(pincodeHint("110001")?.text).toContain("still ask");
  });

  it("ignores spaces and dashes typed inside a pincode", () => {
    expect(pincodeHint(`${open.pincodes[0].slice(0, 3)} ${open.pincodes[0].slice(3)}`)?.tone).toBe("safe");
  });

  it("calls out a pincode that is too long", () => {
    expect(pincodeHint("5600955")?.tone).toBe("critical");
  });
});
