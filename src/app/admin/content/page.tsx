import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getContent, CONTENT_DEFAULTS, CONTENT_GROUPS } from "@/lib/content";
import { ContentEditor } from "./ContentEditor";

export const metadata: Metadata = { title: "Site copy" };
export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const content = await getContent();

  const changed = Object.keys(CONTENT_DEFAULTS).filter(
    (k) => content[k as keyof typeof content] !== CONTENT_DEFAULTS[k as keyof typeof CONTENT_DEFAULTS]
  ).length;

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/content"
      breadcrumb={["Platform", "Site copy"]}
      title="Site copy"
      meta={changed ? `${changed} edited` : "All default"}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        The words on the public site, editable without a deploy. Clearing a field puts the original back rather than
        leaving a blank — so nothing you do here can empty a page.
      </p>

      <ContentEditor
        groups={CONTENT_GROUPS}
        content={content}
        defaults={CONTENT_DEFAULTS as Record<string, string>}
      />
    </ConsoleShell>
  );
}
