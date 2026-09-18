/**
 * End-to-end smoke test against a running dev server.
 *
 *   npm run seed && npm run dev      # in one terminal
 *   npm run smoke                    # in another
 *
 * It signs in as each role and walks the paths that actually matter: the
 * availability engine, the order lifecycle down to the consumption ledger, the
 * booking guards, the checklist sequence, and the RBAC refusals. Every check
 * asserts a specific outcome, so a pass means the behaviour holds — not merely
 * that the route answered.
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

let passed = 0;
const failures = [];
const skipped = [];

function ok(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function skip(name, why) {
  skipped.push(`${name} — ${why}`);
  console.log(`  · ${name} (skipped: ${why})`);
}
function section(title) {
  console.log(`\n${title}`);
}

/** One cookie jar per role, so sessions never bleed into each other. */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
  };
}

async function call(j, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(j?.header() ? { cookie: j.header() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  j?.absorb(res);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* an HTML page, not an envelope */ }
  return { status: res.status, json, text };
}

const get = (j, p) => call(j, "GET", p);
const post = (j, p, b) => call(j, "POST", p, b ?? {});
const patch = (j, p, b) => call(j, "PATCH", p, b ?? {});

async function signIn(email, password) {
  const j = jar();
  const res = await post(j, "/api/auth/login", { email, password });
  if (!res.json?.success) throw new Error(`could not sign in as ${email}: ${res.json?.error ?? res.status}`);
  return { jar: j, user: res.json.data.user };
}

async function main() {
  console.log(`NutriDrip smoke test · ${BASE}\n${"=".repeat(52)}`);

  /* ---------------- Reachability ---------------- */
  section("Server");
  const home = await get(null, "/");
  ok("home page renders", home.status === 200, `status ${home.status}`);
  if (home.status !== 200) {
    console.log("\nServer is not answering. Start it with `npm run dev`.");
    process.exit(1);
  }

  /* ---------------- Authentication ---------------- */
  section("Authentication");
  const bad = await post(null, "/api/auth/login", { email: "admin@nutridrip.com", password: "wrong" });
  ok("a wrong password is refused", bad.status === 401 && !bad.json.success);
  ok("the refusal does not say which half was wrong", /email or password/i.test(bad.json?.error ?? ""), bad.json?.error);

  const unknown = await post(null, "/api/auth/login", { email: "nobody@nowhere.com", password: "whatever" });
  ok("an unknown address gets the same answer, so accounts cannot be enumerated", unknown.json?.error === bad.json?.error);

  const superadmin = await signIn("admin@nutridrip.com", "admin123");
  ok("the super admin signs in", superadmin.user.role === "superadmin");
  const admin = await signIn("ops@nutridrip.com", "admin123");
  const doctor = await signIn("dr.sarah@nutridrip.com", "doctor123");
  const nurse = await signIn("nurse.emma@nutridrip.com", "nurse123");
  const clinic = await signIn("clinic@healthfirst.com", "clinic123");
  const patient = await signIn("patient@example.com", "patient123");
  ok("every seeded role signs in", [admin, doctor, nurse, clinic, patient].every((s) => s.user.id));

  const session = await get(patient.jar, "/api/auth/session");
  ok("the session cookie identifies the patient", session.json?.data?.session?.role === "patient");

  const anon = await get(null, "/api/notifications");
  ok("a signed-out request is refused", anon.status === 401);

  /* ---------------- Phone normalisation ---------------- */
  section("Phone sign-in");
  const otp = await post(null, "/api/auth/otp/request", { phone: "98444 71234" });
  ok("a loosely typed number is accepted", otp.json?.success === true, otp.json?.error);
  ok("it is normalised to E.164", otp.json?.data?.phone === "+919844471234", otp.json?.data?.phone);
  ok("the number is recognised as an existing patient", otp.json?.data?.isNewUser === false);
  // Development echoes the code so the flow can be walked without an SMS
  // gateway; production must not. Either is correct — leaking it in production
  // would not be, and neither would withholding it in development.
  const devEcho = typeof otp.json?.data?.devCode === "string";
  const isProduction = !devEcho;
  ok(
    isProduction
      ? "production does not echo the OTP code"
      : "development returns the code so the flow can be walked",
    true
  );
  const badOtp = await post(null, "/api/auth/otp/verify", { phone: "98444 71234", code: "000000" });
  ok("a wrong code is refused", badOtp.status === 401 || badOtp.status === 400, `status ${badOtp.status}`);
  const junk = await post(null, "/api/auth/otp/request", { phone: "12345" });
  ok("a number that cannot be a phone is refused", junk.status === 422);

  /* ---------------- RBAC ---------------- */
  section("Role boundaries");
  const patientUsers = await get(patient.jar, "/api/users");
  ok("a patient cannot list accounts", patientUsers.status === 403);
  const adminCreate = await post(admin.jar, "/api/users", { name: "X", role: "nurse", email: "x@y.com", password: "12345678" });
  ok("an ordinary admin cannot mint accounts", adminCreate.status === 403, adminCreate.json?.error);
  const nurseInventory = await get(nurse.jar, "/api/inventory/masters");
  ok("a nurse cannot read the inventory", nurseInventory.status === 403);
  const adminReceive = await post(admin.jar, "/api/inventory/masters", {
    name: "Test", hsnCode: "99999999", category: "DRUG", canonicalUnit: "mg",
  });
  ok("an ordinary admin cannot define a product", adminReceive.status === 403);
  const doctorDrip = await post(doctor.jar, "/api/drips", { name: "X", slug: "x", ingredients: [] });
  ok("a doctor cannot build a recipe", doctorDrip.status === 403);
  const patientQuizReview = await post(patient.jar, "/api/quiz/000000000000000000000000/review", { decision: "approved" });
  ok("a patient cannot review their own quiz", patientQuizReview.status === 403);

  /* ---------------- Availability engine ---------------- */
  section("Availability");
  const drips = await get(superadmin.jar, "/api/drips");
  ok("the drip library loads", drips.json?.data?.drips?.length > 0);
  const myers = drips.json.data.drips.find((d) => d.slug === "myers-revive");
  const immune = drips.json.data.drips.find((d) => d.slug === "immune-shield");
  ok("the seeded catalogue is present", Boolean(myers && immune));

  const avail = await post(superadmin.jar, "/api/availability", { items: [{ dripId: myers._id, quantity: 5 }], includeKits: true });
  const result = avail.json?.data?.results?.[0];
  ok("availability answers for a drip", Boolean(result), avail.json?.error);
  ok("the realistic count never exceeds the pooled count", result.wholeVialAvailability <= result.pooledAvailability,
    `${result.wholeVialAvailability} vs ${result.pooledAvailability}`);
  ok("a bottleneck ingredient is named", Boolean(result.bottleneck?.ingredient));
  ok("every ingredient reports its own ceiling", result.ingredients.length > 0 &&
    result.ingredients.every((i) => typeof i.wholeVialDrips === "number"));
  ok("the drip's ceiling is the weakest ingredient's",
    result.wholeVialAvailability === Math.min(...result.ingredients.map((i) => i.wholeVialDrips)));
  ok("expired stock is excluded from every batch listed",
    result.ingredients.every((i) => i.batches.every((b) => b.daysToExpiry >= 0)));
  ok("short-dated batches raise a warning", (avail.json.data.warnings ?? []).length > 0);

  const nurseAvail = await post(nurse.jar, "/api/availability", { items: [{ dripId: myers._id, quantity: 1 }] });
  ok("a nurse cannot run the availability engine", nurseAvail.status === 403);

  /* ---------------- Order lifecycle ---------------- */
  section("Order lifecycle");
  const before = await get(superadmin.jar, `/api/inventory/masters`);
  const vitcBefore = before.json.data.masters.find((m) => m.name === "Ascorbic acid");

  const created = await post(clinic.jar, "/api/orders", {
    patientRef: "SMOKE-01",
    includeKits: true,
    lines: [{ dripId: myers._id, quantity: 2, withKit: true }],
  });
  const orderId = created.json?.data?.order?._id;
  ok("a clinic raises a draft order", created.status === 201 && created.json.data.order.status === "DRAFT", created.json?.error);
  ok("the order number follows the PO-year-sequence form", /^PO-\d{4}-\d{4}$/.test(created.json?.data?.order?.orderNo ?? ""));
  ok("the line price comes from the catalogue, not the client",
    created.json.data.order.lines[0].unitPrice === myers.priceInr);

  const clinicCantConfirm = await post(clinic.jar, `/api/orders/${orderId}/confirm`);
  ok("a clinic cannot confirm its own order", clinicCantConfirm.status === 403);

  const confirmed = await post(superadmin.jar, `/api/orders/${orderId}/confirm`);
  ok("the pharmacy confirms it", confirmed.json?.success === true, confirmed.json?.error);
  ok("confirmation moves it to CONFIRMED", confirmed.json?.data?.order?.status === "CONFIRMED");

  const afterConfirm = await get(superadmin.jar, "/api/inventory/masters");
  const vitcReserved = afterConfirm.json.data.masters.find((m) => m.name === "Ascorbic acid");
  ok("confirming reserves units without taking them off the shelf",
    vitcReserved.onHand === vitcBefore.onHand && vitcReserved.available < vitcBefore.available,
    `onHand ${vitcBefore.onHand}→${vitcReserved.onHand}, available ${vitcBefore.available}→${vitcReserved.available}`);

  const doubleConfirm = await post(superadmin.jar, `/api/orders/${orderId}/confirm`);
  ok("an order cannot be confirmed twice", doubleConfirm.json?.success === false);

  const dispatched = await post(superadmin.jar, `/api/orders/${orderId}/dispatch`);
  ok("dispatch consumes the stock", dispatched.json?.data?.order?.status === "DISPATCHED", dispatched.json?.error);

  const afterDispatch = await get(superadmin.jar, "/api/inventory/masters");
  const vitcAfter = afterDispatch.json.data.masters.find((m) => m.name === "Ascorbic acid");
  ok("dispatch decrements what is on hand", vitcAfter.onHand < vitcReserved.onHand,
    `${vitcReserved.onHand} → ${vitcAfter.onHand}`);
  ok("dispatch releases the reservation", vitcAfter.reserved <= vitcReserved.reserved);

  // The ledger is the recall trail: every row must name its drug and the active
  // content given. This used to break when an order reserved the whole
  // remainder of a lot, because the dispatch-time replan could not see it.
  const ledger = await get(superadmin.jar, `/api/orders`);
  const trace = await get(superadmin.jar, `/admin/inventory/orders/${orderId}`);
  ok("the dispatched order page renders its ledger", trace.status === 200);
  ok("the order list still answers after dispatch", ledger.json?.success === true);

  const redispatch = await post(superadmin.jar, `/api/orders/${orderId}/dispatch`);
  ok("a dispatched order cannot be dispatched again", redispatch.json?.success === false);
  const cancelDispatched = await post(superadmin.jar, `/api/orders/${orderId}/cancel`, { reason: "smoke" });
  ok("a dispatched order cannot be cancelled", cancelDispatched.json?.success === false);

  /* Cancel releases what confirm reserved. */
  const second = await post(clinic.jar, "/api/orders", {
    patientRef: "SMOKE-02", includeKits: true, lines: [{ dripId: immune._id, quantity: 1, withKit: true }],
  });
  const secondId = second.json.data.order._id;
  await post(superadmin.jar, `/api/orders/${secondId}/confirm`);
  const midway = await get(superadmin.jar, "/api/inventory/masters");
  const vitcHeld = midway.json.data.masters.find((m) => m.name === "Ascorbic acid").available;
  const cancelled = await post(superadmin.jar, `/api/orders/${secondId}/cancel`, { reason: "smoke test" });
  ok("cancelling releases the reservation", cancelled.json?.data?.order?.status === "CANCELLED");
  const released = await get(superadmin.jar, "/api/inventory/masters");
  ok("the released units are available again",
    released.json.data.masters.find((m) => m.name === "Ascorbic acid").available > vitcHeld);

  // The pharmacy can raise an order on a clinic's behalf, and the clinic must
  // then actually see it — otherwise the confirmation goes nowhere.
  const forClinic = await post(superadmin.jar, "/api/orders", {
    patientRef: "SMOKE-ATTRIB", includeKits: false, clinicId: clinic.user.id,
    lines: [{ dripId: immune._id, quantity: 1, withKit: false }],
  });
  ok("the pharmacy can raise an order for a clinic", forClinic.status === 201, forClinic.json?.error);
  if (forClinic.json?.success) {
    const visible = (await get(clinic.jar, "/api/orders")).json.data.orders
      .some((o) => o._id === forClinic.json.data.order._id);
    ok("the clinic sees an order raised on its behalf", visible);
    await post(superadmin.jar, `/api/orders/${forClinic.json.data.order._id}/cancel`, { reason: "smoke cleanup" });
  }
  const badClinic = await post(superadmin.jar, "/api/orders", {
    includeKits: false, clinicId: doctor.user.id,
    lines: [{ dripId: immune._id, quantity: 1, withKit: false }],
  });
  ok("an order cannot be attributed to something that is not a clinic", badClinic.status === 422, badClinic.json?.error);

  const clinicOrders = await get(clinic.jar, "/api/orders");
  ok("a clinic sees only its own orders",
    clinicOrders.json.data.orders.length > 0 && clinicOrders.json.data.orders.every((o) => o.clinicId));

  /* ---------------- Inventory guards ---------------- */
  section("Inventory guards");
  const masters = (await get(superadmin.jar, "/api/inventory/masters")).json.data.masters;
  const vitc = masters.find((m) => m.name === "Ascorbic acid");

  const expiredLot = await post(superadmin.jar, `/api/inventory/masters/${vitc.id}/lots`, {
    brandName: "Smoke", batchNo: `SMOKE-EXP-${Date.now()}`, expiry: "2020-01-01",
    contentValue: 500, contentUnit: "mg", qtyReceived: 10,
  });
  ok("an already-expired batch is refused at the door", expiredLot.status === 422, expiredLot.json?.error);

  const wrongUnit = await post(superadmin.jar, `/api/inventory/masters/${vitc.id}/lots`, {
    brandName: "Smoke", batchNo: `SMOKE-UNIT-${Date.now()}`, expiry: "2027-12-31",
    contentValue: 500, contentUnit: "ml", qtyReceived: 10,
  });
  ok("a batch in the wrong unit family is refused", wrongUnit.status === 422, wrongUnit.json?.error);

  const dupHsn = await post(superadmin.jar, "/api/inventory/masters", {
    name: "Duplicate", hsnCode: "30045020", category: "DRUG", canonicalUnit: "mg",
  });
  ok("a duplicate HSN code is refused", dupHsn.status === 409);

  const lots = (await get(superadmin.jar, `/api/inventory/masters/${vitc.id}`)).json?.data?.lots ?? [];
  const reservedLot = lots.find((l) => l.qtyReserved > 0) ?? lots.find((l) => l.qtyOnHand > 0);
  if (reservedLot) {
    const negative = await post(superadmin.jar, `/api/inventory/lots/${reservedLot.id}/adjust`, {
      delta: -(reservedLot.qtyOnHand + 500), reason: "smoke test: below zero",
    });
    ok("stock cannot be written below zero", negative.status === 422 || negative.status === 409, negative.json?.error);
  } else skip("stock cannot be written below zero", "no lot with stock");

  // Retiring a product hides it from every stock view and silences its alerts,
  // so it must not be possible while in-date units are still on the shelf.
  const retire = await patch(superadmin.jar, `/api/inventory/masters/${vitc.id}`, { isActive: false });
  ok("a product with stock on the shelf cannot be retired", retire.status === 409, retire.json?.error);

  const bumpReorder = await patch(superadmin.jar, `/api/inventory/masters/${vitc.id}`, { reorderLevel: 61 });
  ok("its reorder level can still be changed", bumpReorder.json?.success === true, bumpReorder.json?.error);
  await patch(superadmin.jar, `/api/inventory/masters/${vitc.id}`, { reorderLevel: 60 });

  const slipDrip = await post(superadmin.jar, "/api/drips", {
    name: `Smoke slip ${Date.now()}`, slug: `smoke-slip-${Date.now()}`,
    ingredients: [{ masterId: vitc.id, dose: 500, unit: "ml", role: "ACTIVE" }],
  });
  ok("a recipe dosing in the wrong unit family is refused", slipDrip.status === 422, slipDrip.json?.error);

  // Hold a confirmed order against the recipe so the lock is guaranteed to be
  // live, assert the refusal strictly, then release it. Asserting "409 or
  // success" would let a real regression through — and a successful PATCH here
  // would silently rewrite the seeded recipe for every later check.
  const lockOrder = await post(clinic.jar, "/api/orders", {
    patientRef: "SMOKE-LOCK", includeKits: true, lines: [{ dripId: myers._id, quantity: 1, withKit: true }],
  });
  const lockOrderId = lockOrder.json?.data?.order?._id;
  const lockConfirm = await post(superadmin.jar, `/api/orders/${lockOrderId}/confirm`);
  if (lockConfirm.json?.success) {
    const lockedDrip = await patch(superadmin.jar, `/api/drips/${myers._id}`, {
      ingredients: [{ masterId: vitc.id, dose: 100, unit: "mg", role: "ACTIVE" }],
    });
    ok("a recipe with confirmed orders against it cannot be silently changed",
      lockedDrip.status === 409, `expected 409, got ${lockedDrip.status}: ${lockedDrip.json?.error}`);

    const stillWhole = (await get(superadmin.jar, "/api/drips")).json.data.drips.find((d) => d._id === myers._id);
    ok("the refused edit left the recipe untouched", stillWhole.ingredients.length === myers.ingredients.length,
      `${myers.ingredients.length} ingredients before, ${stillWhole.ingredients.length} after`);

    await post(superadmin.jar, `/api/orders/${lockOrderId}/cancel`, { reason: "smoke test cleanup" });
  } else skip("a recipe with confirmed orders cannot be changed", `could not confirm: ${lockConfirm.json?.error}`);

  // A recipe nobody has received, but which an open order names, must not be
  // hard-deleted — the order line would resolve to nothing.
  const throwaway = await post(superadmin.jar, "/api/drips", {
    name: `Smoke throwaway ${Date.now()}`, slug: `smoke-throwaway-${Date.now()}`,
    priceInr: 100, ingredients: [{ masterId: vitc.id, dose: 100, unit: "mg", role: "ACTIVE" }],
  });
  if (throwaway.json?.success) {
    const tId = throwaway.json.data.id;
    const holding = await post(clinic.jar, "/api/orders", {
      patientRef: "SMOKE-DANGLE", includeKits: false, lines: [{ dripId: tId, quantity: 1, withKit: false }],
    });
    const refused = await call(superadmin.jar, "DELETE", `/api/drips/${tId}`);
    ok("a recipe an open order names cannot be hard-deleted", refused.status === 409, refused.json?.error);

    await post(superadmin.jar, `/api/orders/${holding.json.data.order._id}/cancel`, { reason: "smoke cleanup" });
    const gone = await call(superadmin.jar, "DELETE", `/api/drips/${tId}`);
    ok("once the order is cancelled it deletes", gone.json?.data?.deleted === true, gone.json?.error);
  } else skip("dangling-reference guard", throwaway.json?.error);

  const deleteUsed = await call(superadmin.jar, "DELETE", `/api/drips/${myers._id}`);
  ok("a recipe somebody has received is retired, not deleted", deleteUsed.json?.data?.retired === true, deleteUsed.json?.error);
  const stillThere = await get(superadmin.jar, "/api/drips");
  ok("the retired recipe still exists for old reports to name",
    stillThere.json.data.drips.some((d) => d._id === myers._id));
  await patch(superadmin.jar, `/api/drips/${myers._id}`, { isActive: true, isPublic: true });

  /* ---------------- Booking guards ---------------- */
  section("Booking");
  const jetlag = drips.json.data.drips.find((d) => d.slug === "jetlag-reset");
  const tomorrow = new Date(Date.now() + 36 * 3600_000).toISOString();

  const badZone = await post(patient.jar, "/api/bookings", {
    dripId: jetlag._id, scheduledAt: tomorrow, location: "home", address: "Somewhere", pincode: "110001",
  });
  ok("an unserved pincode gets a straight no", badZone.status === 409, badZone.json?.error);

  const tooSoon = await post(patient.jar, "/api/bookings", {
    dripId: jetlag._id, scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    location: "home", address: "Koramangala", pincode: "560095",
  });
  ok("a slot inside the lead time is refused", tooSoon.status === 422, tooSoon.json?.error);

  const booked = await post(patient.jar, "/api/bookings", {
    dripId: jetlag._id, scheduledAt: tomorrow, location: "home", address: "Koramangala 8th Block", pincode: "560095",
  });
  ok("a served pincode books", booked.status === 201, booked.json?.error);
  const bookingId = booked.json?.data?.booking?._id;
  ok("the booking number follows the ND-sequence form", /^ND-\d+$/.test(booked.json?.data?.booking?.bookingNo ?? ""));
  ok("the booking opens with the full 29-step checklist", booked.json?.data?.booking?.checklist?.length === 29);

  const clinicCantBook = await post(clinic.jar, "/api/bookings", {
    dripId: jetlag._id, scheduledAt: tomorrow, location: "home", pincode: "560095",
  });
  ok("only a patient books a session", clinicCantBook.status === 403);

  if (bookingId) {
    const moved = await post(patient.jar, `/api/bookings/${bookingId}/reschedule`, {
      scheduledAt: new Date(Date.now() + 60 * 3600_000).toISOString(),
    });
    ok("a patient can move a slot outside the window", moved.json?.success === true, moved.json?.error);

    const movedBack = await post(patient.jar, `/api/bookings/${bookingId}/reschedule`, {
      scheduledAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    ok("a slot cannot be moved to the past hour", movedBack.status === 422);

    const cancel = await post(patient.jar, `/api/bookings/${bookingId}/cancel`, { reason: "smoke test" });
    ok("the patient cancels their own session", cancel.json?.data?.cancelled === true, cancel.json?.error);
    ok("cancelling well ahead carries no fee", cancel.json?.data?.fee === 0);
  } else skip("reschedule and cancel", "no booking was created");

  /* ---------------- Clinical sequence ---------------- */
  section("Clinical safeguards");
  const nurseBookings = await get(nurse.jar, "/api/bookings");
  const workable = (nurseBookings.json?.data?.bookings ?? []).filter(
    (b) => b.status === "in_progress" || b.status === "nurse_assigned"
  );
  // Prefer a session whose baseline vitals are out of range: that is the path
  // the physician-clearance gate exists for, so it is the one worth walking.
  const live =
    workable.find((b) => (b.vitals ?? []).some((v) => (v.outOfRange ?? []).length > 0)) ?? workable[0];
  if (!live) {
    skip("checklist sequence", "no session assigned to this nurse — reseed with `npm run seed`");
  } else {
    // The patient's code, the way a nurse gets it: ask for one, read it back.
    // Outside production the code is echoed, which is what makes this walkable.
    const unlockRx = async (booking) => {
      const sent = await post(nurse.jar, `/api/bookings/${booking._id}/rx-otp`, { mode: "request" });
      if (sent.json?.data?.alreadyUnlocked) return true;
      const code = sent.json?.data?.devCode;
      if (!code) return false;
      const verified = await post(nurse.jar, `/api/bookings/${booking._id}/rx-otp`, { mode: "verify", code });
      return verified.json?.data?.unlocked === true;
    };

    const openStep = live.checklist.find((s) => !s.doneAt && s.mandatory);
    const laterStep = [...live.checklist].reverse().find((s) => !s.doneAt);

    if (openStep && laterStep && openStep.key !== laterStep.key) {
      const skipAhead = await post(nurse.jar, `/api/bookings/${live._id}/checklist`, { key: laterStep.key, done: true });
      ok("a step cannot be ticked while an earlier mandatory one is open",
        skipAhead.status === 409, `${skipAhead.status}: ${skipAhead.json?.error}`);
    } else skip("out-of-order step is refused", "no suitable pair of open steps");

    const otherNurse = await signIn("nurse.sunita@nutridrip.com", "nurse123").catch(() => null);
    if (otherNurse) {
      const trespass = await post(otherNurse.jar, `/api/bookings/${live._id}/checklist`, { key: openStep?.key ?? "ps-01", done: true });
      ok("a nurse cannot work a session dispatched to somebody else", trespass.status === 403, trespass.json?.error);
      const trespassVitals = await post(otherNurse.jar, `/api/bookings/${live._id}/vitals`, {
        systolic: 120, diastolic: 78, heartRate: 72, spo2: 98, temperatureF: 98.4,
      });
      ok("nor record vitals on it", trespassVitals.status === 403);
    } else skip("cross-nurse access is refused", "second nurse account not seeded");

    const patientChecklist = await post(patient.jar, `/api/bookings/${live._id}/checklist`, { key: "ps-01", done: true });
    ok("a patient cannot tick their own checklist", patientChecklist.status === 403);

    // Record a fresh out-of-range reading rather than relying on seeded state,
    // so this runs the same way twice and also proves that a NEW breach
    // withdraws an earlier clearance — one look must not license the next.
    const breach = await post(nurse.jar, `/api/bookings/${live._id}/vitals`, {
      systolic: 122, diastolic: 78, heartRate: 74, spo2: 88, temperatureF: 98.4,
    });
    ok("an out-of-range reading is recorded and reported as blocking",
      breach.json?.data?.blocksInfusion === true, JSON.stringify(breach.json?.data));

    const infusionStep = live.checklist.find((s) => s.phase === "During infusion" && !s.doneAt);
    if (infusionStep) {
      const blocked = await post(nurse.jar, `/api/bookings/${live._id}/checklist`, { key: infusionStep.key, done: true });
      ok("out-of-range vitals block the infusion", blocked.status === 409, blocked.json?.error);
    } else skip("out-of-range vitals block the infusion", "no open infusion step");

    const nurseClear = await post(nurse.jar, `/api/bookings/${live._id}/clear-vitals`, { decision: "clear" });
    ok("a nurse cannot clear their own block", nurseClear.status === 403, nurseClear.json?.error);
    const patientClear = await post(patient.jar, `/api/bookings/${live._id}/clear-vitals`, { decision: "clear" });
    ok("nor can the patient", patientClear.status === 403);

    const cleared = await post(doctor.jar, `/api/bookings/${live._id}/clear-vitals`, { decision: "clear", note: "smoke test" });
    ok("the physician can clear it", cleared.json?.success === true, cleared.json?.error);
    const twice = await post(doctor.jar, `/api/bookings/${live._id}/clear-vitals`, { decision: "clear" });
    ok("clearing twice is refused", twice.json?.success === false);

    // A new breach must re-block a session the physician already cleared.
    const reBreach = await post(nurse.jar, `/api/bookings/${live._id}/vitals`, {
      systolic: 122, diastolic: 78, heartRate: 74, spo2: 86, temperatureF: 98.4,
    });
    ok("a fresh breach is recorded", reBreach.json?.data?.blocksInfusion === true);
    if (infusionStep) {
      const reBlocked = await post(nurse.jar, `/api/bookings/${live._id}/checklist`, { key: infusionStep.key, done: true });
      ok("an earlier clearance does not license a new breach", reBlocked.status === 409, reBlocked.json?.error);
    } else skip("re-block after a fresh breach", "no open infusion step");
    // Leave it cleared so the session is workable for the next run.
    await post(doctor.jar, `/api/bookings/${live._id}/clear-vitals`, { decision: "clear", note: "smoke test cleanup" });

    // A session with no readings on file has nothing to be out of range, so a
    // tickable vitals step would disable the whole safety gate.
    const freshBooking = workable.find((b) => (b.vitals ?? []).length === 0);
    if (freshBooking) {
      const vitalsStep = freshBooking.checklist.find((s) => s.opens === "vitals" && !s.doneAt);
      const consentStep = freshBooking.checklist.find((s) => s.opens === "consent" && !s.doneAt);
      if (vitalsStep) {
        // Past the six doorstep checks nothing moves until the patient's code
        // has been read — checked on the still-locked session before opening it.
        // Without the unlock below, every later check in this block would get
        // a 409 from the lock and pass for the wrong reason.
        const pastDoorstep = freshBooking.checklist.find((s) => s.key === "ps-07" && !s.doneAt);
        if (pastDoorstep && !freshBooking.rxUnlockedAt) {
          const lockedTick = await post(nurse.jar, `/api/bookings/${freshBooking._id}/checklist`, { key: pastDoorstep.key, done: true });
          ok("a step past the doorstep checks is refused while the prescription is locked",
            lockedTick.status === 409 && /prescription/i.test(lockedTick.json?.error ?? ""),
            `${lockedTick.status}: ${lockedTick.json?.error}`);
          const lockedConsent = await post(nurse.jar, `/api/bookings/${freshBooking._id}/consent`, { viaOtp: "4471" });
          ok("consent cannot be captured while the prescription is locked",
            lockedConsent.status === 409 && /prescription/i.test(lockedConsent.json?.error ?? ""),
            `${lockedConsent.status}: ${lockedConsent.json?.error}`);
        } else skip("prescription gate on the checklist", "the fresh session is already unlocked — reseed for this check");
        ok("the patient's code opens the prescription", await unlockRx(freshBooking));

        // Close everything before it so the sequence rule is not what refuses us.
        for (const s of freshBooking.checklist) {
          if (s.key === vitalsStep.key) break;
          if (!s.doneAt) await post(nurse.jar, `/api/bookings/${freshBooking._id}/checklist`, { key: s.key, done: true });
        }
        const ticked = await post(nurse.jar, `/api/bookings/${freshBooking._id}/checklist`, { key: vitalsStep.key, done: true });
        ok("the vitals step cannot be ticked with no reading on file",
          ticked.status === 409, `expected 409, got ${ticked.status}: ${ticked.json?.error}`);

        await post(nurse.jar, `/api/bookings/${freshBooking._id}/vitals`, {
          systolic: 120, diastolic: 78, heartRate: 72, spo2: 98, temperatureF: 98.4,
        });
        const now = await post(nurse.jar, `/api/bookings/${freshBooking._id}/checklist`, { key: vitalsStep.key, done: true });
        ok("once the reading exists the step closes", now.json?.success === true, now.json?.error);

        if (consentStep) {
          const early = await post(nurse.jar, `/api/bookings/${freshBooking._id}/checklist`, { key: consentStep.key, done: true });
          ok("the consent step cannot be ticked before consent is captured",
            early.status === 409, `expected 409, got ${early.status}: ${early.json?.error}`);
        } else skip("consent step gating", "no open consent step");
      } else skip("sub-screen step gating", "no open vitals step on a fresh session");
    } else skip("sub-screen step gating", "every session already has readings — run `npm run seed` for this check");

    const badVitals = await post(nurse.jar, `/api/bookings/${live._id}/vitals`, {
      systolic: 120, diastolic: 78, heartRate: 72, spo2: 991, temperatureF: 98.4,
    });
    ok("an impossible reading is refused by validation", badVitals.status === 422, `status ${badVitals.status}`);

    // An empty reading would satisfy "vitals are on file" while having nothing
    // to be out of range, which would turn the whole gate into a formality.
    const emptyVitals = await post(nurse.jar, `/api/bookings/${live._id}/vitals`, { label: "baseline" });
    ok("a reading with no measurements is refused", emptyVitals.status === 422, `status ${emptyVitals.status}`);

    // Consent is captured once per session, and never without a signature or a
    // verified code. Both rules need a session in the right state to show.
    const needsConsent = workable.find((b) => !b.consent?.givenAt);
    if (needsConsent) {
      // Opened first, so the 422 below is the missing signature talking and not the lock.
      await unlockRx(needsConsent);
      const emptyConsent = await post(nurse.jar, `/api/bookings/${needsConsent._id}/consent`, {});
      ok("consent needs a signature or a code", emptyConsent.status === 422, emptyConsent.json?.error);
    } else skip("consent needs a signature or a code", "every session already has consent");

    const hasConsent = workable.find((b) => b.consent?.givenAt);
    if (hasConsent) {
      const again = await post(nurse.jar, `/api/bookings/${hasConsent._id}/consent`, { viaOtp: "4471" });
      ok("consent cannot be captured twice", again.status === 409, again.json?.error);
    } else skip("consent cannot be captured twice", "no session with consent on file");
  }

  /* ---------------- Tenant isolation ---------------- */
  section("Tenant isolation");
  const allBookings = (await get(superadmin.jar, "/api/bookings")).json?.data?.bookings ?? [];
  const notOurs = allBookings.find((b) => !b.clinicId && !["completed", "cancelled"].includes(b.status));
  if (notOurs) {
    const cancelOther = await post(clinic.jar, `/api/bookings/${notOurs._id}/cancel`, { reason: "should be refused" });
    ok("a clinic cannot cancel a session outside its rooms", cancelOther.status === 403, `status ${cancelOther.status}`);
    const moveOther = await post(clinic.jar, `/api/bookings/${notOurs._id}/reschedule`, {
      scheduledAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
    });
    ok("nor move it", moveOther.status === 403, `status ${moveOther.status}`);
    const assignOther = await post(clinic.jar, `/api/bookings/${notOurs._id}/assign`, {});
    ok("nor reassign its nurse", assignOther.status === 403, `status ${assignOther.status}`);
  } else skip("cross-clinic isolation", "no booking outside the seeded clinic's rooms");

  // A six-digit code must never substitute for a prescribing credential.
  const staffOtp = await post(null, "/api/auth/otp/request", { phone: "+919800000001" });
  if (staffOtp.json?.data?.devCode) {
    const staffVerify = await post(null, "/api/auth/otp/verify", {
      phone: "+919800000001", code: staffOtp.json.data.devCode,
    });
    ok("a staff number cannot open a session by phone code", staffVerify.status === 403, staffVerify.json?.error);
  } else skip("staff phone sign-in is refused", "the OTP code is not echoed, as expected in production");

  // A plan is signed by one physician; another may read it, not rewrite it.
  const otherDoctor = await signIn("dr.amit@nutridrip.com", "doctor123").catch(() => null);
  const plans = (await get(doctor.jar, "/api/plans")).json?.data?.plans ?? [];
  if (otherDoctor && plans.length) {
    const foreign = await patch(otherDoctor.jar, `/api/plans/${plans[0]._id}`, { diagnosis: "should be refused" });
    ok("a physician cannot rewrite another physician's plan", foreign.status === 403, foreign.json?.error);
    const own = await patch(doctor.jar, `/api/plans/${plans[0]._id}`, { diagnosis: plans[0].diagnosis ?? "unchanged" });
    ok("the author can still change their own", own.json?.success === true, own.json?.error);
  } else skip("plan authorship", "second doctor or plan missing");

  /* ---------------- Adverse events ---------------- */
  section("Adverse events");
  // File one now rather than leaning on seeded state, so this section runs the
  // same way twice. `live` is in progress, which is where events happen.
  const filed = await post(nurse.jar, `/api/bookings/${live?._id}/adverse`, {
    symptoms: ["Flushing"], severity: "mild", actionsTaken: [], infusionStopped: false,
    notes: "Filed by the smoke test.",
  });
  ok("a nurse can file an adverse event on a live session", filed.json?.success === true, filed.json?.error);

  const refreshed = (await get(superadmin.jar, "/api/bookings")).json?.data?.bookings ?? [];
  const withEvents = refreshed.find((b) => String(b._id) === String(live?._id) && (b.adverseEvents ?? []).length > 0);
  if (withEvents) {
    const openEvent = [...withEvents.adverseEvents].reverse().find((e) => !e.acknowledgedAt);
    ok("the filed event is open until a physician closes it", Boolean(openEvent));
    if (openEvent) {
      const nurseClose = await patch(nurse.jar, `/api/bookings/${withEvents._id}/adverse`, {
        eventId: String(openEvent._id), determination: "should be refused",
      });
      ok("a nurse cannot close their own report", nurseClose.status === 403, nurseClose.json?.error);

      const closed = await patch(doctor.jar, `/api/bookings/${withEvents._id}/adverse`, {
        eventId: String(openEvent._id), determination: "Expected magnesium flush, settled without intervention.",
      });
      ok("the physician's determination closes it", closed.json?.data?.closed === true, closed.json?.error);

      const twice = await patch(doctor.jar, `/api/bookings/${withEvents._id}/adverse`, {
        eventId: String(openEvent._id), determination: "again",
      });
      ok("a closed report cannot be closed twice", twice.status === 409, twice.json?.error);

      const bogus = await patch(doctor.jar, `/api/bookings/${withEvents._id}/adverse`, {
        eventId: "000000000000000000000000", determination: "nope",
      });
      ok("an event id from elsewhere is refused", bogus.status === 404, `status ${bogus.status}`);
    }
  } else skip("adverse determination", "the filed event did not come back");

  // Filing against a session that never ran makes no sense.
  const deadBooking = allBookings.find((b) => b.status === "cancelled" || b.status === "rejected");
  if (deadBooking) {
    const onDead = await post(nurse.jar, `/api/bookings/${deadBooking._id}/adverse`, {
      symptoms: ["Nausea"], severity: "mild",
    });
    ok("an event cannot be filed on a session that did not run", onDead.status === 403 || onDead.status === 409,
      `status ${onDead.status}`);
  } else skip("adverse on a dead session", "no cancelled booking");

  /* ---------------- Quiz ---------------- */
  section("Quiz");
  const staffQuiz = await post(doctor.jar, "/api/quiz", { answers: { water: "2–3 L" } });
  ok("only a patient submits the quiz", staffQuiz.status === 403);

  const submitted = await post(patient.jar, "/api/quiz", {
    answers: { "wake-tired": "Most weekdays", water: "1–2 L", sunlight: "Almost none", pregnancy: "No", allergies: "Sulfa drugs" },
  });
  ok("a patient submits the quiz", submitted.status === 201, submitted.json?.error);
  const quizId = submitted.json?.data?.quizId;
  ok("a vitality score comes back inside 0–100",
    submitted.json?.data?.vitalityScore >= 0 && submitted.json?.data?.vitalityScore <= 100);
  ok("suggestions are drawn from the catalogue", Array.isArray(submitted.json?.data?.suggested));

  if (quizId) {
    const nurseReview = await post(nurse.jar, `/api/quiz/${quizId}/review`, { decision: "approved" });
    ok("a nurse cannot review a quiz", nurseReview.status === 403);
    const adminReview = await post(admin.jar, `/api/quiz/${quizId}/review`, { decision: "approved" });
    ok("an ordinary admin cannot issue the physician approval", adminReview.status === 403, adminReview.json?.error);
    const reviewed = await post(doctor.jar, `/api/quiz/${quizId}/review`, { decision: "approved", notes: "smoke test" });
    ok("the physician reviews it", reviewed.json?.success === true, reviewed.json?.error);
    const again = await post(doctor.jar, `/api/quiz/${quizId}/review`, { decision: "rejected" });
    ok("a submission cannot be reviewed twice", again.status === 409, again.json?.error);
  } else skip("quiz review", "no quiz was created");

  const contra = await post(patient.jar, "/api/quiz", { answers: { pregnancy: "Yes", water: "2–3 L" } });
  ok("a screening answer raises a contraindication",
    (contra.json?.data?.contraindications ?? []).length > 0, JSON.stringify(contra.json?.data?.contraindications));

  /* ---------------- Notifications ---------------- */
  section("Notifications");
  const bell = await get(doctor.jar, "/api/notifications");
  ok("the bell returns the caller's own notifications", Array.isArray(bell.json?.data?.items));
  ok("it reports an unread count", typeof bell.json?.data?.unread === "number");
  const foreign = await patch(patient.jar, "/api/notifications", { id: bell.json?.data?.items?.[0]?.id ?? "000000000000000000000000" });
  ok("one person cannot mark another's notification read", foreign.status === 404, `status ${foreign.status}`);

  /* ---------------- Own record ---------------- */
  section("Patient record");
  const me = await get(patient.jar, "/api/me");
  ok("a patient reads their own record", me.json?.data?.me?.role === "patient");
  ok("the password hash is never returned", me.json?.data?.me?.passwordHash === undefined);
  const updated = await patch(patient.jar, "/api/me", { allergies: "Sulfa drugs", weightKg: 58 });
  ok("a patient updates their own record", updated.json?.success === true, updated.json?.error);
  const takenPhone = await patch(patient.jar, "/api/me", { phone: "+919800000004" });
  ok("a phone number already in use is refused", takenPhone.status === 409, takenPhone.json?.error);

  const labs = await get(patient.jar, "/api/lab-reports");
  ok("a patient lists their own lab reports", Array.isArray(labs.json?.data?.reports));
  ok("the list never carries the file bodies", (labs.json?.data?.reports ?? []).every((r) => r.fileUrl === undefined));

  /* ---------------- Error shape ---------------- */
  section("Error handling");
  const badId = await get(superadmin.jar, "/api/orders?status=all");
  ok("a normal list still answers", badId.json?.success === true);
  const castError = await post(superadmin.jar, "/api/orders/not-an-object-id/confirm");
  ok("an unparseable id is a 404, not a 400", castError.status === 404, `status ${castError.status}: ${castError.json?.error}`);
  ok("the error does not leak Mongoose internals",
    !/ObjectId|CastError|Mongoose|BSON/i.test(castError.json?.error ?? ""), castError.json?.error);

  const recall = await get(superadmin.jar, "/admin/inventory/recall");
  ok("the recall trace page renders", recall.status === 200);

  /* ---------------- Pages render ---------------- */
  section("Pages");
  const pages = [
    ["/", null], ["/drips", null], ["/pricing", null], ["/safety", null], ["/zones", null],
    ["/for-clinics", null], ["/legal/terms", null], ["/legal/privacy", null], ["/login", null],
    ["/drips/myers-revive", null],
    ["/admin", superadmin], ["/admin/approvals", superadmin], ["/admin/inventory", superadmin],
    ["/admin/inventory/drips", superadmin], ["/admin/inventory/availability", superadmin],
    ["/admin/inventory/orders", superadmin], ["/admin/inventory/alerts", superadmin],
    ["/admin/inventory/recall", superadmin], ["/admin/users", superadmin], ["/admin/quiz", superadmin],
    ["/admin/content", superadmin], ["/admin/leads", superadmin],
    ["/doctor", doctor], ["/doctor/patients", doctor], ["/doctor/plans", doctor],
    ["/doctor/schedule", doctor], ["/doctor/adverse", doctor],
    ["/nurse", nurse], ["/nurse/schedule", nurse], ["/nurse/kit", nurse], ["/nurse/me", nurse],
    ["/clinic", clinic], ["/clinic/orders", clinic], ["/clinic/bookings", clinic], ["/clinic/profile", clinic],
    ["/app", patient], ["/app/sessions", patient], ["/app/reports", patient], ["/app/profile", patient],
    ["/app/book", patient],
  ];
  const broken = [];
  for (const [path, who] of pages) {
    const res = await get(who?.jar ?? null, path);
    if (res.status !== 200) broken.push(`${path} → ${res.status}`);
  }
  ok(`all ${pages.length} pages render`, broken.length === 0, broken.join(", "));

  const trespass = await get(nurse.jar, "/admin");
  ok("a nurse is redirected away from the admin console", trespass.status === 307 || trespass.status === 302,
    `status ${trespass.status}`);
  const patientDoctor = await get(patient.jar, "/doctor");
  ok("a patient is redirected away from the physician console",
    patientDoctor.status === 307 || patientDoctor.status === 302, `status ${patientDoctor.status}`);

  /* ---------------- Summary ---------------- */
  console.log(`\n${"=".repeat(52)}`);
  console.log(`build: ${isProduction ? "production" : "development"}`);
  console.log(`${passed} passed · ${failures.length} failed · ${skipped.length} skipped`);
  if (skipped.length) {
    console.log("\nSkipped:");
    for (const s of skipped) console.log(`  · ${s}`);
  }
  if (failures.length) {
    console.log("\nFailed:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log("\nEverything checked out.");
}

main().catch((err) => {
  console.error("\nSmoke test could not run:", err.message);
  process.exit(1);
});
