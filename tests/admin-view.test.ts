import { describe, expect, it } from "vitest";
import {
  ADMIN_BOOKING_FIELDS,
  ADMIN_BOOKING_SELECT,
  ADMIN_PATIENT_FIELDS,
  adminSafeUser,
} from "@/lib/data/admin-view";
import { PERMISSIONS, can, patientRecordView } from "@/lib/auth/rbac";
import { Booking } from "@/lib/models/Booking";
import { ROLES } from "@/lib/models/types";

/** Everything on a booking that is somebody's medical record rather than a schedule. */
const CLINICAL_BOOKING_FIELDS = [
  "checklist",
  "vitals",
  "consent",
  "observations",
  "adverseEvents",
  "componentsGiven",
  "aftercareNotes",
  "approvalNotes",
  "rejectionReason",
  "bagVolumeMl",
  "remainingMl",
  "rateMlHr",
  "rxOverride",
  "rxUnlockedAt",
  "rxUnlockedBy",
  "rxUnlockMethod",
  "vitalsClearedAt",
  "vitalsClearedBy",
  "vitalsClearanceNote",
  "feedback",
];

describe("who reads how much of a patient's record", () => {
  it("gives physicians and the super admin the whole record", () => {
    expect(patientRecordView("doctor")).toBe("full");
    expect(patientRecordView("superadmin")).toBe("full");
  });

  it("gives an Admin the operational view and nothing clinical", () => {
    expect(patientRecordView("admin")).toBe("limited");
  });

  it("opens no patient record to a nurse, a clinic, a patient or a stranger", () => {
    for (const role of ["nurse", "clinic", "patient", undefined] as const) {
      expect(patientRecordView(role), String(role)).toBe("none");
    }
  });

  it("answers for every role, so a new role cannot be silently given access", () => {
    for (const role of ROLES) {
      expect(["full", "limited", "none"]).toContain(patientRecordView(role));
    }
  });

  it("keeps lab reports and treatment plans away from an Admin, in the API as well as the screen", () => {
    expect(can("admin", "labs.view")).toBe(false);
    expect(can("admin", "plans.view")).toBe(false);
    // ...while the people who are party to them keep it.
    for (const role of ["doctor", "patient"] as const) expect(can(role, "labs.view")).toBe(true);
    for (const role of ["doctor", "nurse", "patient"] as const) expect(can(role, "plans.view")).toBe(true);
    expect(can("superadmin", "labs.view")).toBe(true);
  });

  it("never lists an Admin against a permission whose name says clinical", () => {
    // A guard against the next capability being added with the whole staff list.
    const clinicalish = Object.keys(PERMISSIONS).filter((p) => /^(labs|plans|infusion|adverse|consent)\./.test(p));
    for (const p of clinicalish) {
      expect(can("admin", p as keyof typeof PERMISSIONS), p).toBe(false);
    }
  });
});

describe("adminSafeUser", () => {
  const patient = {
    name: "Riya Mehta",
    phone: "+919845550001",
    role: "patient",
    patient: {
      dob: new Date("1994-02-11"),
      gender: "female",
      bloodGroup: "B+",
      heightCm: 164,
      weightKg: 58,
      address: "12 Park Rd",
      city: "Bengaluru",
      pincode: "560034",
      allergies: "Sulfa drugs",
      chronicConditions: "Hypothyroid",
      currentMedications: "Levothyroxine",
      surgeries: "Appendectomy",
      emergencyContactName: "A. Mehta",
      emergencyContactPhone: "+919800000000",
      vitalityScore: 62,
    },
  };

  it("keeps where a patient is, and drops what is wrong with them", () => {
    const safe = adminSafeUser(patient);
    expect(safe.patient).toEqual({ address: "12 Park Rd", city: "Bengaluru", pincode: "560034" });
    expect(JSON.stringify(safe)).not.toMatch(/Sulfa|Hypothyroid|Levothyroxine|Appendectomy|vitality|allerg|1994/i);
  });

  it("keeps the person themselves: name and phone are how staff reach them", () => {
    const safe = adminSafeUser(patient);
    expect(safe.name).toBe("Riya Mehta");
    expect(safe.phone).toBe("+919845550001");
  });

  it("does not change what it was given", () => {
    const before = JSON.stringify(patient);
    adminSafeUser(patient);
    expect(JSON.stringify(patient)).toBe(before);
  });

  it("leaves a staff account exactly as it is", () => {
    const nurse = { name: "Emma", role: "nurse", nurse: { licenseNo: "KNC/2019/8842", serviceAreas: ["HSR"] } };
    expect(adminSafeUser(nurse)).toEqual(nurse);
  });

  it("copes with a patient who has no profile yet", () => {
    expect(adminSafeUser({ name: "New patient" })).toEqual({ name: "New patient" });
    expect(adminSafeUser({ name: "x", patient: null }).patient).toBeNull();
  });

  it("only ever lets through the three contact fields", () => {
    expect([...ADMIN_PATIENT_FIELDS]).toEqual(["address", "city", "pincode"]);
  });
});

describe("the booking allow-list", () => {
  const schemaFields = new Set(Object.keys(Booking.schema.paths));

  it("names only fields the booking really has, so a typo cannot hide a real one", () => {
    for (const f of ADMIN_BOOKING_FIELDS) {
      expect(schemaFields.has(f) || f === "createdAt" || f === "updatedAt", f).toBe(true);
    }
  });

  it("contains nothing clinical", () => {
    for (const f of CLINICAL_BOOKING_FIELDS) {
      expect((ADMIN_BOOKING_FIELDS as readonly string[]).includes(f), f).toBe(false);
      expect(ADMIN_BOOKING_SELECT.split(" ").includes(f), f).toBe(false);
    }
  });

  it("still lets the schedule through: who, when, where, status and money", () => {
    for (const f of ["bookingNo", "patientId", "scheduledAt", "status", "nurseId", "amount", "address"]) {
      expect((ADMIN_BOOKING_FIELDS as readonly string[]).includes(f), f).toBe(true);
    }
  });

  it("makes every new booking field a decision: anything not listed is hidden from an Admin", () => {
    // If this fails, a field was added to the booking schema. It is NOT visible to
    // an Admin (the list is an allow-list) -- decide whether it should be: add it
    // to ADMIN_BOOKING_FIELDS if it is scheduling, or to CLINICAL_BOOKING_FIELDS
    // above if it is not.
    const known = new Set<string>([
      ...ADMIN_BOOKING_FIELDS,
      ...CLINICAL_BOOKING_FIELDS,
      "_id",
      "__v",
      "createdAt",
      "updatedAt",
    ]);
    const undecided = [...schemaFields].filter((f) => {
      const top = f.split(".")[0];
      return !known.has(top) && !known.has(f);
    });
    expect(undecided).toEqual([]);
  });
});
