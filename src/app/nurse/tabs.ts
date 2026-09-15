import type { Tab } from "@/components/layout/MobileShell";

/** The nurse app's four tabs, in the order the day runs. */
export const NURSE_TABS: Tab[] = [
  { label: "Today", href: "/nurse" },
  { label: "Schedule", href: "/nurse/schedule" },
  { label: "Kit", href: "/nurse/kit" },
  { label: "Me", href: "/nurse/me" },
];
