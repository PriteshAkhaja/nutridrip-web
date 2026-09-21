import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { AI_STUDIO_ENABLED } from "@/lib/ai/enabled";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { AIModel } from "@/lib/models";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { aiView } from "@/lib/ai/view";
import { StudioActions } from "./StudioActions";
import { StudioForm } from "./StudioForm";

export const metadata: Metadata = { title: "AI Studio" };
export const dynamic = "force-dynamic";

/**
 * Where the settings for a model are kept and switched.
 *
 * The first thing on the page is that nothing uses them yet. Treatment
 * recommendations are produced by the health quiz's scoring rules and reviewed
 * by a physician; no model is called anywhere in the app. An Active badge on a
 * screen like this reads as a control over what patients are told, and until a
 * model is connected it is not one — so the page says so before anything else.
 */
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  // Switched off for now (lib/ai/enabled.ts). A 404 rather than a refusal, so an
  // old link does not write a refused-access row.
  if (!AI_STUDIO_ENABLED) notFound();

  const session = await requirePermission("ai.configure");
  const { edit, new: isNew } = await searchParams;
  const nav = await adminNav();

  await connectDB();
  const rows = await AIModel.find({}).sort({ status: 1, updatedAt: -1 }).lean<Array<Record<string, unknown>>>();
  const models = rows.map(aiView);
  const actives = models.filter((m) => m.status === "active");
  const active = actives[0] ?? null;
  const editing = edit ? (models.find((m) => m.id === edit) ?? null) : null;
  const showForm = Boolean(isNew) || Boolean(editing);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Super admin"
      nav={nav}
      activeHref="/admin/studio"
      breadcrumb={["Admin", "AI Studio"]}
      title="AI Studio"
      meta={`${models.length} model${models.length === 1 ? "" : "s"}`}
    >
      <div className="mb-6">
        <Card tone="caution" padding="p-5">
          <h2 className="t-h3 mb-2">Nothing uses these settings yet</h2>
          <p className="t-body text-[var(--color-ink-2)] max-w-[76ch]" style={{ textWrap: "pretty" }}>
            Treatment recommendations still come from the health quiz&apos;s scoring rules and are reviewed by a
            physician. No model is called anywhere in NutriDrip, so switching one to Active does not change what a
            patient is told. This is where a model&apos;s settings will be kept when one is connected. API keys are
            never stored here — they belong in the server&apos;s environment.
          </p>
        </Card>
      </div>

      {/* The database allows only one Active row, so this should never show.
          If it ever does — an index that was not built, a row edited by hand —
          say so, rather than let the page quietly pick whichever sorts first. */}
      {actives.length > 1 ? (
        <div className="mb-6">
          <Card tone="critical" padding="p-5">
            <h2 className="t-h3 mb-1">More than one model is marked Active</h2>
            <p className="t-body text-[var(--color-ink-2)] max-w-[76ch]">
              Only one should be: {actives.map((m) => m.name).join(", ")}. Move all but one back to Test.
            </p>
          </Card>
        </div>
      ) : null}

      {showForm ? (
        <div className="mb-6">
          {/* Keyed, so opening a different model starts a fresh form rather than
              carrying the last one's text across. */}
          <StudioForm key={editing?.id ?? "new"} editing={editing} />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <p className="t-body text-[var(--color-ink-2)]">
            {active ? (
              <>
                Active: <span className="font-medium text-[var(--color-ink)]">{active.name}</span>
              </>
            ) : (
              "No model is active."
            )}
          </p>
          <ButtonLink href="/admin/studio?new=1">Add a model</ButtonLink>
        </div>
      )}

      {edit && !editing ? (
        <div className="mb-6">
          <Card tone="muted" padding="p-5">
            <span className="t-body text-[var(--color-ink-2)]">
              That model no longer exists — it may have been deleted since the link was made.
            </span>
          </Card>
        </div>
      ) : null}

      {models.length === 0 ? (
        showForm ? null : (
          <EmptyState
            kind="first-run"
            title="No models yet"
            body="Add one to record the settings a model would run with — the model, its temperature and length, and its prompts."
            actionLabel="Add a model"
            actionHref="/admin/studio?new=1"
          />
        )
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Model</TH>
              <TH numeric>Temperature</TH>
              <TH numeric>Max length</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH>{" "}</TH>
            </TR>
          </THead>
          <tbody>
            {models.map((m) => (
              <TR key={m.id}>
                <TD>
                  <div className="flex flex-col min-w-[200px]">
                    <span className="font-medium">{m.name}</span>
                    {m.description ? (
                      <span className="t-small text-[var(--color-ink-3)] max-w-[40ch]">{m.description}</span>
                    ) : null}
                  </div>
                </TD>
                <TD mono nowrap>{m.model}</TD>
                <TD numeric mono>{m.temperature}</TD>
                <TD numeric mono>{m.maxTokens.toLocaleString("en-IN")}</TD>
                <TD nowrap>
                  {m.status === "active" ? (
                    <Pill tone="safe" dot>Active</Pill>
                  ) : (
                    <Pill tone="neutral">Test</Pill>
                  )}
                </TD>
                <TD mono nowrap>{m.updatedAt ? formatDate(m.updatedAt) : "—"}</TD>
                <TD>
                  <StudioActions
                    id={m.id}
                    name={m.name}
                    status={m.status}
                    activeName={active && active.id !== m.id ? active.name : null}
                  />
                </TD>
              </TR>
            ))}
          </tbody>
        </DataTable>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-4 max-w-[76ch]" style={{ textWrap: "pretty" }}>
        One model is active at a time; making another active moves the first back to Test. Every change is written to
        the audit trail, including the old and new text of a prompt.
      </p>
    </ConsoleShell>
  );
}
