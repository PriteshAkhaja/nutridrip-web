import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, Lead, Order, ProductMaster, User } from "@/lib/models";
import { getAlerts } from "@/lib/inventory/alerts";
import type { NavItem } from "@/components/layout/ConsoleShell";
import { AI_STUDIO_ENABLED } from "@/lib/ai/enabled";

/**
 * Nav badges are live counts, never static. A badge with nothing to count is
 * omitted rather than shown as a zero.
 */
export async function adminNav(activeCounts = true): Promise<NavItem[]> {
  if (!activeCounts) {
    return [
      { section: "Platform", label: "Overview", href: "/admin" },
      { section: "Platform", label: "Approvals", href: "/admin/approvals" },
      { section: "Platform", label: "People", href: "/admin/users" },
      { section: "Platform", label: "Quiz builder", href: "/admin/quiz" },
      { section: "Platform", label: "Site copy", href: "/admin/content" },
      { section: "Platform", label: "Service zones", href: "/admin/zones", permission: "zones.manage" },
      { section: "Platform", label: "Enquiries", href: "/admin/leads" },
      { section: "Inventory", label: "Availability", href: "/admin/inventory/availability" },
      { section: "Inventory", label: "Products & batches", href: "/admin/inventory" },
      { section: "Inventory", label: "Drip builder", href: "/admin/inventory/drips" },
      { section: "Inventory", label: "Preparation orders", href: "/admin/inventory/orders" },
      { section: "Inventory", label: "Alerts", href: "/admin/inventory/alerts" },
      { section: "Inventory", label: "Recall trace", href: "/admin/inventory/recall" },
      { section: "Admin", label: "Billing", href: "/admin/billing" },
      ...(AI_STUDIO_ENABLED ? [{ section: "Admin", label: "AI Studio", href: "/admin/studio", permission: "ai.configure" } as const] : []),
      { section: "Admin", label: "Audit trail", href: "/admin/audit" },
    ];
  }

  await connectDB();
  const [products, openOrders, alerts, users, newLeads, pendingQuizzes] = await Promise.all([
    ProductMaster.countDocuments({ isActive: true }),
    Order.countDocuments({ status: { $in: ["DRAFT", "CONFIRMED"] } }),
    getAlerts(90),
    User.countDocuments({ status: "active" }),
    Lead.countDocuments({ status: "new" }),
    HealthQuiz.countDocuments({ reviewStatus: "pending" }),
  ]);

  const alertCount =
    alerts.counts.expired + alerts.counts.expiringSoon + alerts.counts.lowStock + alerts.counts.outOfStock;

  // Grouped by the areas the breadcrumbs already name — Platform, Inventory,
  // Admin — and ordered within each as before.
  return [
    { section: "Platform", label: "Overview", href: "/admin" },
    { section: "Platform", label: "Approvals", href: "/admin/approvals", badge: pendingQuizzes || undefined, badgeTone: "caution" },
    { section: "Platform", label: "People", href: "/admin/users", badge: users },
    { section: "Platform", label: "Quiz builder", href: "/admin/quiz" },
    { section: "Platform", label: "Site copy", href: "/admin/content" },
    { section: "Platform", label: "Service zones", href: "/admin/zones", permission: "zones.manage" },
    { section: "Platform", label: "Enquiries", href: "/admin/leads", badge: newLeads || undefined, badgeTone: "caution" },
    { section: "Inventory", label: "Availability", href: "/admin/inventory/availability" },
    { section: "Inventory", label: "Products & batches", href: "/admin/inventory", badge: products },
    { section: "Inventory", label: "Drip builder", href: "/admin/inventory/drips" },
    { section: "Inventory", label: "Preparation orders", href: "/admin/inventory/orders", badge: openOrders || undefined },
    {
      section: "Inventory",
      label: "Alerts",
      href: "/admin/inventory/alerts",
      badge: alertCount || undefined,
      badgeTone: alerts.counts.expired > 0 ? "critical" : "caution",
    },
    { section: "Inventory", label: "Recall trace", href: "/admin/inventory/recall" },
    { section: "Admin", label: "Billing", href: "/admin/billing" },
    ...(AI_STUDIO_ENABLED ? [{ section: "Admin", label: "AI Studio", href: "/admin/studio", permission: "ai.configure" } as const] : []),
    { section: "Admin", label: "Audit trail", href: "/admin/audit" },
  ];
}

export async function doctorNav(doctorId: string): Promise<NavItem[]> {
  await connectDB();
  const [pendingQuizzes, todaySessions, blockedVitals, openAdverse] = await Promise.all([
    HealthQuiz.countDocuments({ reviewStatus: "pending" }),
    Booking.countDocuments({
      doctorId,
      scheduledAt: { $gte: startOfToday(), $lt: endOfToday() },
    }),
    Booking.countDocuments({
      "vitals.outOfRange.0": { $exists: true },
      vitalsClearedAt: null,
      status: { $in: ["nurse_assigned", "en_route", "in_progress"] },
    }),
    // An event that stopped an infusion sets the session to completed, so
    // filtering on status hid exactly the most serious ones. What makes an
    // event open is that no physician has closed it.
    Booking.countDocuments({ adverseEvents: { $elemMatch: { acknowledgedAt: null } } }),
  ]);
  const escalations = blockedVitals + openAdverse;

  return [
    { section: "Clinical", label: "Approvals queue", href: "/doctor", badge: pendingQuizzes || undefined, badgeTone: "caution" },
    { section: "Clinical", label: "Patients", href: "/doctor/patients" },
    { section: "Clinical", label: "Treatment plans", href: "/doctor/plans" },
    { section: "Clinical", label: "Schedule", href: "/doctor/schedule", badge: todaySessions || undefined },
    { section: "Clinical", label: "Escalations", href: "/doctor/adverse", badge: escalations || undefined, badgeTone: "critical" },
    { section: "Account", label: "Letterhead", href: "/doctor/letterhead", permission: "letterhead.edit" },
  ];
}

export async function clinicNav(clinicId: string): Promise<NavItem[]> {
  await connectDB();
  const [openOrders, bookings] = await Promise.all([
    Order.countDocuments({ clinicId, status: { $in: ["DRAFT", "CONFIRMED"] } }),
    Booking.countDocuments({ clinicId, status: { $nin: ["completed", "cancelled"] } }),
  ]);

  return [
    { section: "Clinic", label: "Today", href: "/clinic" },
    { section: "Clinic", label: "Orders", href: "/clinic/orders", badge: openOrders || undefined },
    { section: "Clinic", label: "Bookings", href: "/clinic/bookings", badge: bookings || undefined },
    { section: "Clinic", label: "Billing", href: "/clinic/billing" },
    { section: "Clinic", label: "Profile", href: "/clinic/profile" },
  ];
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
