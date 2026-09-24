"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { StatusPill } from "@/components/ui/Pill";

type Decision = "approved" | "modified" | "rejected" | "info_needed";

const STRENGTHS = [
  { value: "strong", label: "Strongly recommended" },
  { value: "recommended", label: "Recommended" },
  { value: "optional", label: "Optional" },
] as const;

const DECLINE_REASONS = [
  "Contraindicated — renal function",
  "Contraindicated — cardiac history",
  "Contraindicated — pregnancy",
  "Recent labs required before approval",
  "Drug interaction with current medication",
  "Needs an in-person consultation first",
];

export type NurseChoice = {
  id: string;
  name: string;
  /** The reason in pieces, so a narrow column wraps between them. */
  detailBits: string[];
  atCapacity: boolean;
};

/**
 * Approve, adjust or decline, and say who attends.
 *
 * A decline must carry a reason — it is shown to the patient and recorded
 * against the physician's registration number. The nurse choice is optional by
 * design: leaving it alone dispatches the nearest free nurse, exactly as this
 * screen did before the choice existed.
 */
export function ReviewDecision({
  quizId,
  reviewStatus,
  suggestedDrips,
  allDrips = [],
  nurses,
  bookedSessions = [],
}: {
  quizId: string;
  /** Sessions already confirmed under an earlier approval; a decline calls them off. */
  bookedSessions?: Array<{ bookingNo: string; dripName: string | null; when: string }>;
  reviewStatus: string;
  suggestedDrips: Array<{ id: string; name: string; slug: string }>;
  /** The whole catalogue, so a physician can recommend something else. */
  allDrips?: Array<{ id: string; name: string }>;
  /**
   * This physician's own nurses, ranked for the patient's address. `others`
   * comes through unused on this screen on purpose — the reassign flow shows
   * every nurse, and the two would drift if they ranked separately.
   */
  nurses?: {
    zoneName: string | null;
    mine: NurseChoice[];
    others: NurseChoice[];
    noTeam: boolean;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [declining, setDeclining] = useState(false);
  /** "" means let dispatch choose, which is what it did before there was a choice. */
  const [nurseId, setNurseId] = useState("");

  /* What the physician recommends, seeded from the quiz's own suggestion so
     "approve as submitted" needs no interaction at all. */
  const [dripIds, setDripIds] = useState<string[]>(suggestedDrips.map((d) => d.id));
  const [strength, setStrength] = useState<string>("recommended");
  const [patientNote, setPatientNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [infoRequest, setInfoRequest] = useState("");

  const toggleDrip = (id: string) =>
    setDripIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const suggestedIds = suggestedDrips.map((d) => d.id).sort().join(",");
  const changedDrips = [...dripIds].sort().join(",") !== suggestedIds;

  const decided = reviewStatus !== "pending";

  const submit = async (decision: Decision) => {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: decision === "rejected" ? `${reason}${notes ? ` — ${notes}` : ""}` : notes || undefined,
          patientNote: patientNote.trim() || undefined,
          ...(decision === "rejected" ? { declineReason: reason } : {}),
          // A decline or a question dispatches nobody, and recommends nothing.
          ...(decision === "approved" || decision === "modified"
            ? { dripIds, strength, nurseId: nurseId || undefined }
            : {}),
          ...(decision === "info_needed" ? { infoRequest: infoRequest.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was recorded.");
    } finally {
      setBusy(null);
    }
  };

  if (decided) {
    return (
      <Card padding="p-5">
        <span className="t-micro">Decision</span>
        <div className="mt-3">
          <StatusPill status={reviewStatus} dot />
        </div>
        <p className="t-small text-[var(--color-ink-2)] mt-3">
          {reviewStatus === "superseded"
            ? "Nothing to decide here: the patient answered again before a decision, and the newer answers are in the queue."
            : "Recorded against your registration number. Reopening a decision creates a new review entry rather than editing this one."}
        </p>
      </Card>
    );
  }

  return (
    <Card padding="p-5">
      <span className="t-micro">Your decision</span>

      {suggestedDrips.length > 0 && (
        <div className="mt-3">
          <span className="t-small text-[var(--color-ink-2)]">
            The quiz suggests {suggestedDrips.map((d) => d.name).join(" and ")}.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {/* What is actually recommended. Seeded from the quiz, so approving as
            submitted needs no interaction — but it is editable, which is what
            "approve with changes" never meant until now. */}
        {!declining && !asking && allDrips.length > 0 && (
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-micro">What you recommend</span>
              <span className="t-small text-[var(--color-ink-3)]">
                {changedDrips ? "changed from the quiz" : "as the quiz suggested"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allDrips.map((d) => {
                const on = dripIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDrip(d.id)}
                    className="rounded-full px-[12px] py-[6px] border cursor-pointer"
                    style={{
                      font: "500 12.5px/1.4 var(--font-sans)",
                      borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                      background: on ? "var(--color-primary)" : "var(--color-surface)",
                      color: on ? "#fff" : "var(--color-ink-2)",
                    }}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            {dripIds.length === 0 && (
              <span className="t-small text-[var(--color-caution-text)]">
                Nothing selected — the patient will be approved with no protocol to book.
              </span>
            )}
          </div>
        )}

        {!declining && !asking && (
          <Select label="How firmly" value={strength} onChange={(e) => setStrength(e.target.value)}>
            {STRENGTHS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}

        {/* Said before the choice, not after: approving keeps these, declining
            stops them, and the physician should know which before deciding. */}
        {bookedSessions.length > 0 && (
          <div
            className={`rounded-[var(--radius-md)] border px-4 py-3 ${
              declining
                ? "border-[var(--color-critical)] bg-[var(--color-critical-soft)]"
                : "border-[var(--color-caution)] bg-[var(--color-caution-soft)]"
            }`}
          >
            <span className="t-body font-semibold">
              {declining
                ? `Declining also calls off ${bookedSessions.length === 1 ? "this booked session" : `these ${bookedSessions.length} booked sessions`}`
                : `Already booked under an earlier approval`}
            </span>
            <ul className="mt-1 flex flex-col gap-[2px]">
              {bookedSessions.map((b) => (
                <li key={b.bookingNo} className="t-small text-[var(--color-ink-2)]">
                  <span className="t-data">{b.bookingNo}</span> · {b.dripName ?? "Drip"} · {b.when}
                </li>
              ))}
            </ul>
            {!declining && (
              <span className="t-small text-[var(--color-ink-2)] block mt-1">
                Approving keeps {bookedSessions.length === 1 ? "it" : "them"}. Declining calls{" "}
                {bookedSessions.length === 1 ? "it" : "them"} off and tells the patient and the nurse.
              </span>
            )}
          </div>
        )}

        {declining ? (
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {DECLINE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        ) : null}

        {/* Who attends. Left alone it behaves exactly as it did before this
            existed — dispatch picks the nearest nurse under capacity — so an
            approval is never held up by one physician's team being busy. */}
        {!declining && nurses && (
          <div className="flex flex-col gap-[7px]">
            {/* A dropdown, but not a native one: every choice carries a
                reason, and an <option> cannot show one — it will not wrap and
                a long one is simply cut off. Closed this is one row, so thirty
                nurses cost no more page height than two. */}
            <SelectMenu
              label="Who attends"
              hint={nurses.zoneName ? `patient is in ${nurses.zoneName}` : "area not served"}
              value={nurseId}
              onChange={setNurseId}
              options={[
                {
                  value: "",
                  label: "Choose automatically",
                  detail: ["nearest free nurse", "any team"],
                },
                /* ONLY this physician's own nurses. Somebody else's nurse can
                   still end up here through automatic dispatch, which draws from
                   everyone — that is deliberate, so a patient is never left
                   unattended because one physician's team is busy. */
                ...nurses.mine.map((n) => ({
                  value: n.id,
                  label: n.name,
                  detail: n.detailBits,
                  warn: n.atCapacity,
                })),
              ]}
            />

            {nurses.noTeam && (
              <span className="t-small text-[var(--color-caution-text)]">
                No nurses are linked to you yet, so there is nobody to choose. Approving still dispatches the nearest
                free nurse. An admin links nurses to you on their account.
              </span>
            )}
            {nurseId && nurses.mine.find((n) => n.id === nurseId)?.atCapacity && (
              <span className="t-small text-[var(--color-caution-text)]">
                That nurse is already at capacity. If they cannot take it, the nearest free nurse goes instead and you
                will be told.
              </span>
            )}
          </div>
        )}

        {asking && (
          <Textarea
            label="What do you need from them?"
            hint="the patient reads this"
            placeholder="Which blood pressure medication are you on, and at what dose?"
            value={infoRequest}
            onChange={(e) => setInfoRequest(e.target.value)}
            rows={2}
          />
        )}

        {/* The one thing the patient actually reads. Separate from the nurse
            note, which is rates and additives and means nothing to them. */}
        {!asking && (
          <Textarea
            label="What the patient should know"
            hint="they see this on their report"
            placeholder={
              declining
                ? "Why this is not right for you, and what to do instead."
                : "Why you changed it, or what to expect. Plain words, not clinical shorthand."
            }
            value={patientNote}
            onChange={(e) => setPatientNote(e.target.value)}
            rows={3}
          />
        )}

        {!asking && (
        <Textarea
          label={declining ? "Anything to add" : "Notes for the nurse"}
          placeholder={
            declining
              ? "Private. The patient is shown the reason above and whatever you write for them."
              : "Rate, order of additives, anything the nurse must know."
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        )}

        {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

        {declining ? (
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setDeclining(false)}>
              Back
            </Button>
            <Button variant="danger" block loading={busy === "rejected"} onClick={() => submit("rejected")}>
              Decline
            </Button>
          </div>
        ) : asking ? (
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setAsking(false)}>
              Back
            </Button>
            <Button
              block
              loading={busy === "info_needed"}
              disabled={infoRequest.trim().length < 5}
              onClick={() => submit("info_needed")}
            >
              Send the question
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button block size="lg" loading={busy === "approved"} onClick={() => submit("approved")}>
              {changedDrips ? "Approve what you chose" : "Approve as submitted"}
            </Button>
            <Button variant="secondary" block loading={busy === "modified"} onClick={() => submit("modified")}>
              Approve with changes
            </Button>
            {/* A missing detail should not cost the patient their slot. */}
            <Button variant="secondary" block onClick={() => setAsking(true)}>
              Ask for more information
            </Button>
            <Button variant="ghost" block onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
