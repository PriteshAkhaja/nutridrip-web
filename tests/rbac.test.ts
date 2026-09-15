import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { ROLES, riskBand, riskColor } from "@/lib/models/types";

describe("role permissions", () => {
  it("refuses everything to a signed-out visitor", () => {
    for (const p of Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>) {
      expect(can(undefined, p)).toBe(false);
    }
  });

  it("keeps account creation with the super admin alone", () => {
    // A doctor login is a prescribing credential, so minting one is not an
    // ordinary admin's to do.
    expect(can("superadmin", "users.manage")).toBe(true);
    expect(can("admin", "users.manage")).toBe(false);
    expect(can("doctor", "users.manage")).toBe(false);
  });

  it("keeps receiving stock and building recipes with the super admin", () => {
    expect(can("superadmin", "inventory.manage")).toBe(true);
    expect(can("admin", "inventory.manage")).toBe(false);
    expect(can("superadmin", "drips.build")).toBe(true);
    expect(can("admin", "drips.build")).toBe(false);
  });

  it("lets only a physician write a plan and only a nurse run one", () => {
    expect(can("doctor", "plans.create")).toBe(true);
    expect(can("nurse", "plans.create")).toBe(false);
    expect(can("nurse", "infusion.prepare")).toBe(true);
    expect(can("doctor", "infusion.prepare")).toBe(false);
    expect(can("patient", "infusion.prepare")).toBe(false);
  });

  it("keeps a patient out of every staff capability", () => {
    for (const p of ["users.view", "inventory.view", "orders.view", "quiz.review", "approvals.act"] as const) {
      expect(can("patient", p)).toBe(false);
    }
    expect(can("patient", "quiz.take")).toBe(true);
    expect(can("patient", "bookings.create")).toBe(true);
  });

  it("sends every role somewhere real after sign-in", () => {
    for (const r of ROLES) {
      expect(HOME_FOR_ROLE[r]).toMatch(/^\//);
    }
  });
});

describe("risk banding", () => {
  it("bands by the documented thresholds", () => {
    expect(riskBand(10)).toBe("Critical");
    expect(riskBand(34)).toBe("Critical");
    expect(riskBand(35)).toBe("Low");
    expect(riskBand(59)).toBe("Low");
    expect(riskBand(60)).toBe("Adequate");
    expect(riskBand(100)).toBe("Adequate");
  });

  it("colours each band distinctly", () => {
    expect(new Set([riskColor(10), riskColor(50), riskColor(90)]).size).toBe(3);
  });
});
