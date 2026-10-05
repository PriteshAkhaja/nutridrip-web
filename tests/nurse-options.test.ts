import { describe, expect, it } from "vitest";
import {
  nurseOptions as rank,
  DEFAULT_NURSE_DAY_LIMIT as LIMIT,
  type NurseRow,
  type PatientPoint,
} from "@/lib/clinical/nurse-options";
import { ZONE_DEFAULTS, zoneNames } from "@/lib/zones";

/** Ranked against the launch zones, for a session on a known day (the physician approving a held drip). */
const nurseOptions = (
  nurses: NurseRow[],
  patient: PatientPoint,
  doctorId: string | null,
  day: { limit: number } | null = { limit: LIMIT }
) => rank(nurses, patient, doctorId, ZONE_DEFAULTS, day);
const ZONE_NAMES = zoneNames(ZONE_DEFAULTS);

const DOC = "doc-1";
const OTHER_DOC = "doc-2";

/** Jayanagar, 560011. */
const PATIENT = { latitude: 12.9308, longitude: 77.5838, pincode: "560011" };

const nurse = (over: Partial<NurseRow> & { id: string; name: string }): NurseRow => ({
  serviceAreas: [],
  latitude: null,
  longitude: null,
  doctorId: null,
  load: 0,
  ...over,
});

describe("whose nurses a physician is offered", () => {
  it("puts the physician's own team in `mine` and everybody else in `others`", () => {
    const out = nurseOptions(
      [
        nurse({ id: "a", name: "Asha", doctorId: DOC }),
        nurse({ id: "b", name: "Bina", doctorId: OTHER_DOC }),
        nurse({ id: "c", name: "Chitra", doctorId: null }),
      ],
      PATIENT,
      DOC
    );
    expect(out.mine.map((n) => n.name)).toEqual(["Asha"]);
    expect(out.others.map((n) => n.name)).toEqual(["Bina", "Chitra"]);
    expect(out.noTeam).toBe(false);
  });

  it("flags a physician with no team, so the screen can fall back to everyone", () => {
    const out = nurseOptions([nurse({ id: "b", name: "Bina", doctorId: OTHER_DOC })], PATIENT, DOC);
    expect(out.noTeam).toBe(true);
    expect(out.mine).toEqual([]);
    expect(out.others).toHaveLength(1);
  });

  it("treats nobody as 'mine' when the physician is unknown", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha", doctorId: DOC })], PATIENT, null);
    expect(out.noTeam).toBe(true);
    expect(out.others.map((n) => n.name)).toEqual(["Asha"]);
  });
});

describe("the order they are offered in", () => {
  it("ranks a nurse who covers the zone above a nearer one who does not", () => {
    const out = nurseOptions(
      [
        nurse({ id: "far", name: "Far", serviceAreas: ["Jayanagar"], latitude: 13.05, longitude: 77.6 }),
        nurse({ id: "near", name: "Near", serviceAreas: ["Whitefield"], latitude: 12.931, longitude: 77.584 }),
      ],
      PATIENT,
      null
    );
    expect(out.others.map((n) => n.name)).toEqual(["Far", "Near"]);
  });

  it("puts the nearest first among nurses who all cover the zone", () => {
    const out = nurseOptions(
      [
        nurse({ id: "f", name: "Far", serviceAreas: ["Jayanagar"], latitude: 13.05, longitude: 77.6 }),
        nurse({ id: "n", name: "Near", serviceAreas: ["Jayanagar"], latitude: 12.931, longitude: 77.584 }),
      ],
      PATIENT,
      null
    );
    expect(out.others.map((n) => n.name)).toEqual(["Near", "Far"]);
  });

  it("never lets an unknown distance beat a known one", () => {
    const out = nurseOptions(
      [
        nurse({ id: "u", name: "Unknown", serviceAreas: ["Jayanagar"] }),
        nurse({ id: "k", name: "Known", serviceAreas: ["Jayanagar"], latitude: 13.2, longitude: 77.9 }),
      ],
      PATIENT,
      null
    );
    expect(out.others.map((n) => n.name)).toEqual(["Known", "Unknown"]);
  });

  it("sorts a full nurse last however well they match", () => {
    const out = nurseOptions(
      [
        nurse({
          id: "full",
          name: "Full",
          serviceAreas: ["Jayanagar"],
          latitude: 12.931,
          longitude: 77.584,
          load: LIMIT,
        }),
        nurse({ id: "free", name: "Free", serviceAreas: ["Whitefield"], latitude: 13.2, longitude: 77.9 }),
      ],
      PATIENT,
      null
    );
    expect(out.others.map((n) => n.name)).toEqual(["Free", "Full"]);
    expect(out.others.find((n) => n.name === "Full")?.atCapacity).toBe(true);
  });

  it("keeps a full nurse visible rather than dropping them", () => {
    const out = nurseOptions([nurse({ id: "f", name: "Full", load: LIMIT })], PATIENT, null);
    expect(out.others).toHaveLength(1);
    expect(out.others[0].detail).toContain("full that day");
  });

  it("breaks a dead heat on the name, so the list does not shuffle between loads", () => {
    const out = nurseOptions(
      [
        nurse({ id: "z", name: "Zara", serviceAreas: ["Jayanagar"], latitude: 12.931, longitude: 77.584 }),
        nurse({ id: "a", name: "Asha", serviceAreas: ["Jayanagar"], latitude: 12.931, longitude: 77.584 }),
      ],
      PATIENT,
      null
    );
    expect(out.others.map((n) => n.name)).toEqual(["Asha", "Zara"]);
  });
});

describe("what the physician is told about each nurse", () => {
  it("names the zone, the distance and the load", () => {
    const out = nurseOptions(
      [nurse({ id: "a", name: "Asha", serviceAreas: ["Jayanagar"], latitude: 12.931, longitude: 77.584, load: 2 })],
      PATIENT,
      null
    );
    expect(out.zoneName).toBe("Jayanagar");
    expect(out.others[0].detail).toContain("covers Jayanagar");
    expect(out.others[0].detail).toMatch(/\d+(\.\d+)? km/);
    expect(out.others[0].detail).toContain(`2 of ${LIMIT} that day`);
  });

  it("counts against the day's limit as the super admin set it", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha", load: 3 })], PATIENT, null, { limit: 3 });
    expect(out.others[0].atCapacity).toBe(true);
    expect(out.others[0].detail).toContain("full that day · 3 of 3");
  });

  it("with no session day to count, says what a nurse has open and calls nobody full", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha", load: 9 })], PATIENT, null, null);
    expect(out.others[0].atCapacity).toBe(false);
    expect(out.others[0].detail).toContain("9 open");
    expect(out.others[0].detail).not.toContain(" of ");
  });

  it("says plainly when a nurse does not cover the area", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha", serviceAreas: ["Whitefield"] })], PATIENT, null);
    expect(out.others[0].coversZone).toBe(false);
    expect(out.others[0].detail).toContain("does not cover Jayanagar");
  });

  it("says the distance is unknown rather than inventing one", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha" })], PATIENT, null);
    expect(out.others[0].distanceKm).toBeNull();
    expect(out.others[0].detail).toContain("distance unknown");
  });

  it("treats a nurse with no declared areas as unrestricted, like dispatch does", () => {
    const out = nurseOptions([nurse({ id: "a", name: "Asha", serviceAreas: [] })], PATIENT, null);
    expect(out.others[0].coversZone).toBe(true);
  });

  it("claims no zone at all for a pincode we do not serve", () => {
    const out = nurseOptions(
      [nurse({ id: "a", name: "Asha", serviceAreas: ["Whitefield"] })],
      { latitude: 21.2, longitude: 72.8, pincode: "395013" },
      null
    );
    expect(out.zoneName).toBeNull();
    // With no zone there is nothing to cover or fail to cover.
    expect(out.others[0].coversZone).toBe(true);
    expect(out.others[0].detail).not.toContain("cover");
  });
});

describe("the zone names offered to the admin form", () => {
  it("are the real served zones, not free text", () => {
    expect(ZONE_NAMES).toHaveLength(14);
    expect(ZONE_NAMES).toContain("Jayanagar");
    expect(ZONE_NAMES).toContain("HSR Layout");
  });
});
