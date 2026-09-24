import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/lib/data/inventory";
import { PATIENT_TABS } from "../tabs";
import { ProfileForm } from "./ProfileForm";
import { geocodingConfigured } from "@/lib/geo/geocode";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function PatientProfilePage() {
  const session = await requireRole("patient", "superadmin");
  await connectDB();

  const me = await User.findById(session.sub).lean<{
    name: string;
    email?: string;
    phone?: string;
    createdAt: Date;
    patient?: {
      dob?: Date;
      gender?: string;
      bloodGroup?: string;
      heightCm?: number;
      weightKg?: number;
      address?: string;
      pincode?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      allergies?: string;
      chronicConditions?: string;
      currentMedications?: string;
      surgeries?: string;
      familyHistory?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      vitalityScore?: number;
    };
  } | null>();

  const p = me?.patient ?? {};
  const initial = {
    name: me?.name ?? "",
    email: me?.email ?? "",
    phone: me?.phone ?? "",
    dob: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
    gender: p.gender ?? "",
    bloodGroup: p.bloodGroup ?? "",
    heightCm: p.heightCm ? String(p.heightCm) : "",
    weightKg: p.weightKg ? String(p.weightKg) : "",
    address: p.address ?? "",
    city: p.city ?? "",
    pincode: p.pincode ?? "",
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    allergies: p.allergies ?? "",
    chronicConditions: p.chronicConditions ?? "",
    currentMedications: p.currentMedications ?? "",
    surgeries: p.surgeries ?? "",
    familyHistory: p.familyHistory ?? "",
  };

  const sections: Array<[string, Array<[string, string]>]> = [
    [
      "You",
      [
        ["Name", me?.name ?? "—"],
        ["Phone", me?.phone ?? "—"],
        ["Email", me?.email ?? "—"],
        ["Date of birth", p.dob ? formatDate(p.dob) : "—"],
        ["Blood group", p.bloodGroup ?? "—"],
      ],
    ],
    [
      "Where a nurse comes",
      [
        ["Address", p.address ?? "—"],
        ["Pincode", p.pincode ?? "—"],
      ],
    ],
    [
      "In an emergency",
      [
        ["Contact", p.emergencyContactName ?? "—"],
        ["Their number", p.emergencyContactPhone ?? "—"],
      ],
    ],
    [
      "What a nurse reads aloud",
      [
        ["Allergies", p.allergies || "None declared"],
        ["Conditions", p.chronicConditions || "None declared"],
        ["Medication", p.currentMedications || "None declared"],
      ],
    ],
    [
      "Body",
      [
        ["Height", p.heightCm ? `${p.heightCm} cm` : "—"],
        ["Weight", p.weightKg ? `${p.weightKg} kg` : "—"],
      ],
    ],
  ];

  return (
    <MobileShell
      title="Profile"
      subtitle={p.vitalityScore ? `Vitality ${p.vitalityScore}` : undefined}
      tabs={PATIENT_TABS}
      activeHref="/app/profile"
    >
      <div className="mb-4">
        <ProfileForm
            initial={initial}
            mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null}
            searchEnabled={geocodingConfigured()}
            zones={servedZones(await getZones())}
          />
      </div>

      <div className="flex flex-col gap-4">
        {sections.map(([title, rows]) => (
          <div
            key={title}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <span className="t-micro">{title}</span>
            <div className="flex flex-col gap-2 mt-3">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)] flex-none">{k}</span>
                  <span className="t-body font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-5 mt-4">
        <span className="t-micro">Your data</span>
        <p className="t-body text-[var(--color-ink-2)] mt-2">
          Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts
          are logged.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <ButtonLink href="/quiz?retake=1" variant="secondary" block>
          Retake the health quiz
        </ButtonLink>
        <ButtonLink href="/app/reports" variant="ghost" block>
          Lab reports
        </ButtonLink>
        <div className="mt-3 pt-5 border-t border-[var(--color-line)]">
          <SignOutButton />
        </div>
      </div>
    </MobileShell>
  );
}
