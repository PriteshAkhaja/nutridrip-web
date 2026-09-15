import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, Lead, Order, ProductMaster, User } from "@/lib/models";
import { getAlerts } from "@/lib/inventory/alerts";
import type { NavItem } from "@/components/layout/ConsoleShell";

/**
 * Nav badges are live counts, never static. A badge with nothing to count is
 * omitted rather than shown as a zero.
 */
export async function adminNav(activeCounts = true): Promise<NavItem[]> {
  if (!activeCounts) {
    return [
      { label: "Overview", href: "/admin" },
      { label: "Approvals", href: "/admin/approvals" },
      { label: "Availability", href: "/admin/inventory/availability" },
      { label: "Products & batches", href: "/admin/inventory" },
      { label: "Drip builder", href: "/admin/inventory/drips" },
      { label: "Preparation orders", href: "/admin/inventory/orders" },
      { label: "Alerts", href: "/admin/inventory/alerts" },
      { label: "Recall trace", href: "/admin/inventory/recall" },
      { label: "People", href: "/admin/users" },
      { label: "Quiz builder", href: "/admin/quiz" },
      { label: "Site copy", href: "/admin/content" },
      { label: "Enquiries", href: "/admin/leads" },
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

  return [
    { label: "Overview", href: "/admin" },
    { label: "Approvals", href: "/admin/approvals", badge: pendingQuizzes || undefined, badgeTone: "caution" },
    { label: "Availability", href: "/admin/inventory/availability" },
    { label: "Products & batches", href: "/admin/inventory", badge: products },
    { label: "Drip builder", href: "/admin/inventory/drips" },
    { label: "Preparation orders", href: "/admin/inventory/orders", badge: openOrders || undefined },
    {
      label: "Alerts",
      href: "/admin/inventory/alerts",
      badge: alertCount || undefined,
      badgeTone: alerts.counts.expired > 0 ? "critical" : "caution",
    },
    { label: "Recall trace", href: "/admin/inventory/recall" },
    { label: "People", href: "/admin/users", badge: users },
    { label: "Quiz builder", href: "/admin/quiz" },
    { label: "Site copy", href: "/admin/content" },
    { label: "Enquiries", href: "/admin/leads", badge: newLeads || undefined, badgeTone: "caution" },
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
    { label: "Approvals queue", href: "/doctor", badge: pendingQuizzes || undefined, badgeTone: "caution" },
    { label: "Patients", href: "/doctor/patients" },
    { label: "Treatment plans", href: "/doctor/plans" },
    { label: "Schedule", href: "/doctor/schedule", badge: todaySessions || undefined },
    { label: "Escalations", href: "/doctor/adverse", badge: escalations || undefined, badgeTone: "critical" },
  ];
}

export async function clinicNav(clinicId: string): Promise<NavItem[]> {
  await connectDB();
  const [openOrders, bookings] = await Promise.all([
    Order.countDocuments({ clinicId, status: { $in: ["DRAFT", "CONFIRMED"] } }),
    Booking.countDocuments({ clinicId, status: { $nin: ["completed", "cancelled"] } }),
  ]);

  return [
    { label: "Today", href: "/clinic" },
    { label: "Orders", href: "/clinic/orders", badge: openOrders || undefined },
    { label: "Bookings", href: "/clinic/bookings", badge: bookings || undefined },
    { label: "Profile", href: "/clinic/profile" },
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
