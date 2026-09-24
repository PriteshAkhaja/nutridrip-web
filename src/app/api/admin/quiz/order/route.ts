import { z } from "zod";
import { AuditLog } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { applyOrder, loadQuestions } from "@/lib/clinical/quiz-store";
import { groupBySection, newProblems } from "@/lib/clinical/quiz-rules";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The whole questionnaire's order, saved in one request.
 *
 * The old builder moved a question by swapping it with its neighbour in two
 * separate writes, so a failure between them left two questions sharing a
 * position. Sending the complete order instead makes a move one change that
 * either happens or does not.
 *
 * A move that would put a question before one its rule depends on is refused
 * with the reason: a patient would meet the follow-up before the question it
 * follows, and it would never be asked.
 */
const Input = z.object({ qids: z.array(z.string().max(40)).min(1).max(500) });

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.manage")) return fail("Not permitted", 403);

    const { qids } = Input.parse(await req.json());
    const before = await loadQuestions(true);
    const byId = new Map(before.map((q) => [q.id, q]));

    // Every question exactly once: a list that drops or repeats one is a stale
    // screen, not an order, and saving it would lose a question's place.
    const unique = new Set(qids);
    if (unique.size !== qids.length || qids.length !== before.length || qids.some((id) => !byId.has(id))) {
      return fail("The questionnaire changed while you were reordering it. Reload the page and try again.", 409);
    }

    // Grouped by section as the editor shows it, whatever order the sections came in.
    const after = groupBySection(qids.map((id) => byId.get(id)!));
    const broken = newProblems(before, after);
    if (broken.length) return fail(broken[0], 409, { problems: broken });

    const changed = await applyOrder(after.map((q) => q.id));

    if (changed > 0) {
      // Per section, before and after, as the names a person would recognise.
      const sections = [...new Set(after.map((q) => q.section))];
      const listed = (list: typeof before, section: string) =>
        list
          .filter((q) => q.section === section)
          .map((q) => q.id)
          .join(", ");
      const moved = sections.filter((s) => listed(before, s) !== listed(after, s));
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "quiz.reorder",
        entity: "QuizQuestion",
        before: Object.fromEntries(moved.map((s) => [s, listed(before, s)])),
        after: Object.fromEntries(moved.map((s) => [s, listed(after, s)])),
      });
    }

    return ok({ changed });
  } catch (err) {
    return handleError(err);
  }
}
