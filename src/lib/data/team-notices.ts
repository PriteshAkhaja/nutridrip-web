import type { NotifyType } from "@/lib/notify";

/**
 * Who is told what when a nurse's posting changes.
 *
 * A nurse works under a physician, and that physician dispatches them and answers
 * for their sessions. Until now the only person told anything when a nurse was
 * created was the nurse: the physician met the new name for the first time in the
 * middle of approving somebody. So the team changing is now news to the people it
 * changes for -- and to nobody else. A name being corrected is not news; it would
 * only teach people to stop reading the bell.
 *
 * Pure on purpose: it takes what was and what is, and returns the messages. The
 * routes do the sending, so the rules can be tested without a database.
 */

export type TeamNotice = {
  userId: string;
  title: string;
  body: string;
  type: NotifyType;
  link: string;
};

/** Where every one of these lands: the "Your nurses" section of the physician's home. */
export const TEAM_LINK = "/doctor#team";

const zonesLine = (zones?: string[]) =>
  zones && zones.length ? `Covers ${zones.join(", ")}.` : "Offered for every zone.";

/** What a nurse's account being not-active means, in the words a physician would use. */
const STATUS_WORDS: Record<string, string> = {
  inactive: "is inactive and cannot sign in",
  suspended: "has been suspended and cannot sign in",
  pending: "is pending and cannot sign in yet",
};

/** The message to a physician when a nurse is posted under them. */
export function joinedTeam(nurse: { name: string; zones?: string[] }, doctorId: string): TeamNotice {
  return {
    userId: doctorId,
    title: `${nurse.name} has joined your team`,
    body: zonesLine(nurse.zones),
    type: "info",
    link: TEAM_LINK,
  };
}

/** The body of the new account's own welcome, which now says who they work under. */
export function accountReadyBody(opts: { email?: string; doctorName?: string }): string {
  const signIn = opts.email ? `Sign in with ${opts.email}.` : "Sign in with your phone number.";
  return opts.doctorName ? `${signIn} You will work under ${opts.doctorName}.` : signIn;
}

/**
 * What changed for a nurse who already exists.
 *
 *  - moved to another physician (or to none): the old physician, the new one and
 *    the nurse are each told;
 *  - stopped being active, or came back: the physician they work under is told,
 *    because their team just got smaller or bigger.
 *
 * `doctorNames` maps a physician's id to their name; a missing name reads as
 * "another physician" rather than as the id.
 */
export function noticesForNurseChange(input: {
  nurse: { id: string; name: string; zones?: string[] };
  before: { doctorId?: string | null; status: string };
  after: { doctorId?: string | null; status: string };
  doctorNames: Record<string, string | undefined>;
}): TeamNotice[] {
  const { nurse, before, after, doctorNames } = input;
  const from = before.doctorId || null;
  const to = after.doctorId || null;
  const out: TeamNotice[] = [];

  if (from !== to) {
    if (to) out.push(joinedTeam(nurse, to));
    if (from) {
      out.push({
        userId: from,
        title: `${nurse.name} has left your team`,
        body: to
          ? `Now works under ${doctorNames[to] ?? "another physician"}.`
          : "No longer posted under a physician.",
        type: "info",
        link: TEAM_LINK,
      });
    }
    out.push({
      userId: nurse.id,
      title: to ? `You now work under ${doctorNames[to] ?? "a new physician"}` : "You are no longer posted under a physician",
      body: to ? "They oversee the sessions you are sent." : "Dispatch can still offer you sessions in your zones.",
      type: "info",
      link: "/nurse",
    });
  }

  // Only the physician the nurse works under NOW hears about their status: one
  // who has just lost them was told they left, which says enough.
  if (to && before.status !== after.status) {
    const wasActive = before.status === "active";
    const isActive = after.status === "active";
    if (wasActive !== isActive) {
      out.push(
        isActive
          ? {
              userId: to,
              title: `${nurse.name} is active again`,
              body: `${nurse.name} can sign in and take sessions again.`,
              type: "success",
              link: TEAM_LINK,
            }
          : {
              userId: to,
              title: `${nurse.name} is no longer active`,
              body: `${nurse.name} ${STATUS_WORDS[after.status] ?? "cannot sign in"}.`,
              type: "warning",
              link: TEAM_LINK,
            }
      );
    }
  }

  return out;
}
