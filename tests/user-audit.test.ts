import { describe, expect, it } from "vitest";
import { trackedFields, withDoctorName } from "@/lib/data/user-audit";
import { describeChange } from "@/lib/data/audit";

/** What the trail would show for an edit: the fields that moved, and how. */
const diff = (before: object, after: object, names: Record<string, string> = {}) =>
  describeChange(withDoctorName(trackedFields(before), names), withDoctorName(trackedFields(after), names));

const nurse = {
  name: "Test Nurse",
  status: "active",
  nurse: { licenseNo: "KNC/2024/1111", doctorId: "d1", serviceAreas: ["Koramangala", "HSR Layout"] },
};

describe("what an account edit leaves in the trail", () => {
  const names = { d1: "Dr. Sarah Menon", d2: "Dr. Amit Rao" };

  it("says nothing when nothing changed", () => {
    expect(diff(nurse, nurse, names)).toEqual([]);
  });

  it("shows a nurse moved between physicians, by name", () => {
    const moved = { ...nurse, nurse: { ...nurse.nurse, doctorId: "d2" } };
    expect(diff(nurse, moved, names)).toEqual([{ field: "worksUnder", from: "Dr. Sarah Menon", to: "Dr. Amit Rao" }]);
  });

  it("shows a zone swapped for another, which a count of zones would hide", () => {
    const swapped = { ...nurse, nurse: { ...nurse.nurse, serviceAreas: ["Koramangala", "Ejipura"] } };
    expect(diff(nurse, swapped, names)).toEqual([
      { field: "zones", from: "HSR Layout, Koramangala", to: "Ejipura, Koramangala" },
    ]);
  });

  it("reads the same zones as the same, whatever order they were ticked in", () => {
    const reordered = { ...nurse, nurse: { ...nurse.nurse, serviceAreas: ["HSR Layout", "Koramangala"] } };
    expect(diff(nurse, reordered, names)).toEqual([]);
  });

  it("shows a council number, a phone and a home location changing", () => {
    const changed = {
      ...nurse,
      phone: "+919800000099",
      nurse: { ...nurse.nurse, licenseNo: "KNC/2024/2222", latitude: 12.9, longitude: 77.6 },
    };
    const fields = diff(nurse, changed, names).map((c) => c.field).sort();
    expect(fields).toEqual(["councilNumber", "homeLatitude", "homeLongitude", "phone"]);
  });

  it("shows a clinic's GSTIN, which decides how its invoices are taxed", () => {
    const clinic = { name: "HealthFirst", status: "active", clinic: { gstin: "29AABCH1234K1ZN", pincode: "560038", city: "Bengaluru" } };
    const moved = { ...clinic, clinic: { ...clinic.clinic, gstin: "27AABCH1234K1ZR" } };
    expect(diff(clinic, moved)).toEqual([{ field: "gstin", from: "29AABCH1234K1ZN", to: "27AABCH1234K1ZR" }]);
  });

  it("shows a clinic's pincode, which the trail's secret filter used to hide (it contains 'code')", () => {
    const clinic = { name: "C", status: "active", clinic: { pincode: "560038" } };
    const moved = { ...clinic, clinic: { pincode: "560001" } };
    const [c] = diff(clinic, moved);
    expect(c).toEqual({ field: "pincode", from: "560038", to: "560001" });
    expect(c.to).not.toBe("hidden");
  });

  it("shows a clinic's monthly target and address", () => {
    const clinic = { name: "C", status: "active", clinic: { monthlyVolumeTarget: 100, address: "1 Main" } };
    const moved = { ...clinic, clinic: { monthlyVolumeTarget: 120, address: "2 Main" } };
    expect(diff(clinic, moved).map((c) => c.field).sort()).toEqual(["address", "monthlyTarget"]);
  });

  it("shows a physician's registration changing", () => {
    const doctor = { name: "Dr. X", status: "active", doctor: { specialization: "Internal medicine", licenseNo: "KMC/1", registrationCouncil: "Karnataka" } };
    const moved = { ...doctor, doctor: { ...doctor.doctor, licenseNo: "KMC/2" } };
    expect(diff(doctor, moved)).toEqual([{ field: "councilNumber", from: "KMC/1", to: "KMC/2" }]);
  });

  it("does not print an id when the physician is gone", () => {
    const gone = { ...nurse, nurse: { ...nurse.nurse, doctorId: "d9" } };
    const text = JSON.stringify(diff(nurse, gone, names));
    expect(text).not.toContain("d9");
    expect(text).toContain("no longer exists");
  });

  it("never carries a password, a hash or a token", () => {
    const withSecrets = { ...nurse, passwordHash: "$2a$10$abc", tokenVersion: 3, otp: "123456" } as object;
    const keys = Object.keys(trackedFields(withSecrets));
    expect(keys.join(" ")).not.toMatch(/pass|hash|token|otp|secret/i);
    expect(JSON.stringify(trackedFields(withSecrets))).not.toContain("$2a$");
  });

  it("leaves out what was never filled in, rather than writing 'undefined'", () => {
    const f = trackedFields({ name: "N", status: "active" });
    expect(Object.keys(f)).toEqual(["name", "status"]);
  });

  it("uses no field name the trail would hide as a secret, apart from ones it clears by name", () => {
    const all = trackedFields({
      name: "n", status: "s", phone: "p",
      doctor: { specialization: "a", licenseNo: "b", registrationCouncil: "c" },
      nurse: { licenseNo: "d", doctorId: "e", serviceAreas: ["f"], latitude: 1, longitude: 2 },
      clinic: { address: "g", city: "h", pincode: "i", gstin: "j", monthlyVolumeTarget: 3 },
    });
    const changed = describeChange({}, all).filter((c) => c.to === "hidden");
    expect(changed).toEqual([]);
  });
});
