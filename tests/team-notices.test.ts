import { describe, expect, it } from "vitest";
import { TEAM_LINK, accountReadyBody, joinedTeam, noticesForNurseChange } from "@/lib/data/team-notices";

const nurse = { id: "n1", name: "Test Nurse", zones: ["Koramangala", "HSR Layout"] };
const names = { d1: "Dr. Sarah Menon", d2: "Dr. Amit Rao" };
const active = { status: "active" };

describe("a nurse joins a team", () => {
  it("tells the physician who, and where they work", () => {
    const n = joinedTeam(nurse, "d1");
    expect(n.userId).toBe("d1");
    expect(n.title).toBe("Test Nurse has joined your team");
    expect(n.body).toBe("Covers Koramangala, HSR Layout.");
    expect(n.link).toBe(TEAM_LINK);
  });

  it("says so when the nurse has no zones, because that means every zone", () => {
    expect(joinedTeam({ name: "Test Nurse", zones: [] }, "d1").body).toBe("Offered for every zone.");
    expect(joinedTeam({ name: "Test Nurse" }, "d1").body).toBe("Offered for every zone.");
  });

  it("puts the physician's name in the new nurse's own welcome", () => {
    expect(accountReadyBody({ email: "a@b.com", doctorName: "Dr. Sarah Menon" })).toBe(
      "Sign in with a@b.com. You will work under Dr. Sarah Menon."
    );
    expect(accountReadyBody({ email: "a@b.com" })).toBe("Sign in with a@b.com.");
    expect(accountReadyBody({})).toBe("Sign in with your phone number.");
  });
});

describe("a nurse is moved", () => {
  const move = noticesForNurseChange({
    nurse,
    before: { doctorId: "d1", ...active },
    after: { doctorId: "d2", ...active },
    doctorNames: names,
  });

  it("tells the old physician, the new one and the nurse", () => {
    expect(move.map((m) => m.userId).sort()).toEqual(["d1", "d2", "n1"]);
  });

  it("tells the old physician where the nurse went", () => {
    const left = move.find((m) => m.userId === "d1")!;
    expect(left.title).toBe("Test Nurse has left your team");
    expect(left.body).toBe("Now works under Dr. Amit Rao.");
  });

  it("welcomes the new physician exactly as a fresh nurse would be", () => {
    expect(move.find((m) => m.userId === "d2")).toEqual(joinedTeam(nurse, "d2"));
  });

  it("tells the nurse who they work under now, and sends them to their own app", () => {
    const n = move.find((m) => m.userId === "n1")!;
    expect(n.title).toBe("You now work under Dr. Amit Rao");
    expect(n.link).toBe("/nurse");
  });

  it("copes with a nurse taken off every physician", () => {
    const off = noticesForNurseChange({
      nurse,
      before: { doctorId: "d1", ...active },
      after: { doctorId: null, ...active },
      doctorNames: names,
    });
    expect(off.map((m) => m.userId).sort()).toEqual(["d1", "n1"]);
    expect(off.find((m) => m.userId === "d1")!.body).toBe("No longer posted under a physician.");
    expect(off.find((m) => m.userId === "n1")!.title).toBe("You are no longer posted under a physician");
  });

  it("copes with a nurse newly given a physician", () => {
    const on = noticesForNurseChange({
      nurse,
      before: { doctorId: null, ...active },
      after: { doctorId: "d1", ...active },
      doctorNames: names,
    });
    expect(on.map((m) => m.userId).sort()).toEqual(["d1", "n1"]);
  });

  it("does not print an id when it does not know a physician's name", () => {
    const m = noticesForNurseChange({
      nurse,
      before: { doctorId: "d1", ...active },
      after: { doctorId: "dX", ...active },
      doctorNames: {},
    });
    // The recipient's id is data; what a person READS must never be an id.
    expect(m.map((x) => `${x.title} ${x.body}`).join(" ")).not.toContain("dX");
    expect(m.find((x) => x.userId === "d1")!.body).toBe("Now works under another physician.");
  });
});

describe("a nurse's status changes", () => {
  const change = (from: string, to: string) =>
    noticesForNurseChange({
      nurse,
      before: { doctorId: "d1", status: from },
      after: { doctorId: "d1", status: to },
      doctorNames: names,
    });

  it("tells the physician when the nurse can no longer sign in", () => {
    for (const status of ["inactive", "suspended", "pending"]) {
      const [n, ...rest] = change("active", status);
      expect(rest, status).toEqual([]);
      expect(n.userId).toBe("d1");
      expect(n.title).toBe("Test Nurse is no longer active");
      expect(n.type).toBe("warning");
    }
  });

  it("says which it is: suspended is not the same as inactive", () => {
    expect(change("active", "suspended")[0].body).toContain("suspended");
    expect(change("active", "inactive")[0].body).toContain("inactive");
  });

  it("tells the physician when the nurse is back", () => {
    const [n] = change("inactive", "active");
    expect(n.title).toBe("Test Nurse is active again");
    expect(n.type).toBe("success");
  });

  it("stays quiet between two not-active states, since nothing changed for the team", () => {
    expect(change("inactive", "suspended")).toEqual([]);
  });

  it("stays quiet when a nurse works under nobody", () => {
    const m = noticesForNurseChange({
      nurse,
      before: { doctorId: null, status: "active" },
      after: { doctorId: null, status: "inactive" },
      doctorNames: names,
    });
    expect(m).toEqual([]);
  });

  it("tells only the physician the nurse works under now, not the one they just left", () => {
    const m = noticesForNurseChange({
      nurse,
      before: { doctorId: "d1", status: "active" },
      after: { doctorId: "d2", status: "inactive" },
      doctorNames: names,
    });
    const status = m.filter((x) => x.title === "Test Nurse is no longer active");
    expect(status.map((x) => x.userId)).toEqual(["d2"]);
    expect(m.find((x) => x.userId === "d1")!.title).toBe("Test Nurse has left your team");
  });
});

describe("what is not news", () => {
  it("says nothing when nothing about the posting changed", () => {
    expect(
      noticesForNurseChange({
        nurse,
        before: { doctorId: "d1", ...active },
        after: { doctorId: "d1", ...active },
        doctorNames: names,
      })
    ).toEqual([]);
  });

  it("every message links somewhere real and carries a type the bell understands", () => {
    const all = [
      joinedTeam(nurse, "d1"),
      ...noticesForNurseChange({ nurse, before: { doctorId: "d1", status: "active" }, after: { doctorId: "d2", status: "suspended" }, doctorNames: names }),
    ];
    for (const n of all) {
      expect(n.link).toMatch(/^\//);
      expect(["info", "success", "warning", "error"]).toContain(n.type);
      expect(n.title.length).toBeGreaterThan(0);
    }
  });
});
