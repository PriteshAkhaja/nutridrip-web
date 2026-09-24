import { z } from "zod";
import { User, Zone as ZoneModel } from "@/lib/models";
import { parsePincodes, windowFor, zoneProblems, type Zone } from "@/lib/zones";
import { fail } from "@/lib/api";

export const ZoneBody = z.object({
  name: z.string().max(60),
  pincodes: z.union([z.string().max(2000), z.array(z.string().max(12)).max(200)]),
  opensAt: z.string().max(5),
  closesAt: z.string().max(5),
  slotMinutes: z.coerce.number().int().default(60),
  status: z.enum(["open", "limited", "paused"]),
});
export type ZoneBodyInput = z.infer<typeof ZoneBody>;

/** The zone as it will be stored, or the 422 naming each field that is wrong. */
export function checkZone(input: ZoneBodyInput, others: Zone[]) {
  const problems = zoneProblems(input, others);
  const first = Object.values(problems)[0];
  if (first) return { error: fail(first, 422, { fields: problems }) };
  return {
    zone: {
      name: input.name.trim(),
      pincodes: parsePincodes(input.pincodes),
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      slotMinutes: input.slotMinutes,
      status: input.status,
    },
  };
}

/** For the audit trail: the zone as a person would read it. */
export function auditView(z: { name: string; pincodes: string[]; opensAt: string; closesAt: string; slotMinutes?: number; status: string }) {
  return {
    name: z.name,
    pincodes: z.pincodes.join(", "),
    hours: windowFor(z.opensAt, z.closesAt),
    slotEvery: `${z.slotMinutes ?? 60} min`,
    status: z.status,
  };
}

/** A server started before the slot step existed would drop it without a word. */
export function staleServer() {
  return !ZoneModel.schema.path("slotMinutes")
    ? fail("The server is running an older version and would not keep the slot step. Restart it (stop it and run npm run dev again).", 500)
    : null;
}

/** How many nurses list this zone among the ones they cover. */
export function nursesCovering(name: string): Promise<number> {
  return User.countDocuments({ role: "nurse", "nurse.serviceAreas": name });
}
