import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** The response envelope every endpoint uses: { success, data } or { success, error }. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/** Turns thrown errors into the same envelope, without leaking internals. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(`${first.path.join(".") || "input"}: ${first.message}`, 422, {
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof Error) {
    console.error("[api]", err);
    // An id that is not an ObjectId means the thing does not exist — that is a
    // 404, and the caller has no use for Mongoose's description of why the
    // cast failed.
    if (err.name === "CastError") return fail("Not found", 404);
    // A unique-index collision is a conflict, not a bad request.
    if ((err as { code?: number }).code === 11000) {
      return fail("That already exists", 409);
    }
    if (err.name === "ValidationError") return fail("Some of those values are not valid", 422);
    return fail(err.message, 400);
  }
  console.error("[api]", err);
  return fail("Something went wrong", 500);
}

export type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: string };
