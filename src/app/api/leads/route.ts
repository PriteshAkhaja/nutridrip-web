import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Lead } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notifyRole } from "@/lib/notify";
import { normalisePhone } from "@/lib/auth/phone";
import { ok, fail, handleError } from "@/lib/api";

const CreateLead = z.object({
  kind: z.enum(["clinic", "consult", "general"]).default("general"),
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(6).max(20).optional().or(z.literal("")),
  organisation: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  message: z.string().max(2000).optional(),
  rooms: z.number().int().min(0).max(200).optional(),
  monthlyVolume: z.number().int().min(0).max(10000).optional(),
});

/** Public — anyone can raise an enquiry. */
export async function POST(req: Request) {
  try {
    const input = CreateLead.parse(await req.json());
    if (!input.email && !input.phone) {
      return fail("Leave an email address or a phone number so we can reply", 422);
    }

    const phone = input.phone ? normalisePhone(input.phone) : undefined;
    if (input.phone && !phone) return fail("That phone number does not look right", 422);

    await connectDB();
    const lead = await Lead.create({
      ...input,
      email: input.email || undefined,
      phone: phone || undefined,
    });

    await notifyRole(
      ["admin", "superadmin"],
      input.kind === "clinic" ? "New clinic enquiry" : "New enquiry",
      `${input.name}${input.organisation ? ` · ${input.organisation}` : ""}${input.city ? ` · ${input.city}` : ""}`,
      "info",
      "/admin/leads"
    );

    return ok({ id: String(lead._id) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "users.view")) return fail("Not permitted", 403);

    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    const filter = status && status !== "all" ? { status } : {};
    const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return ok({ leads });
  } catch (err) {
    return handleError(err);
  }
}
