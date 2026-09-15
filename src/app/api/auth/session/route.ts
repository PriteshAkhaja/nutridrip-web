import { getSession } from "@/lib/auth/session";
import { ok } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  return ok({ session });
}
