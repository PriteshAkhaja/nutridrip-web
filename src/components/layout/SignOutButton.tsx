"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="t-small text-[var(--color-ink-2)] hover:text-[var(--color-ink)] bg-transparent border-0 p-0 cursor-pointer underline"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
