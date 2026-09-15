"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { OtpBoxes } from "@/components/ui/OtpBoxes";
import { useLoginState } from "./LoginState";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // The open tab and the email credentials are shared with the demo account
  // panel in the next column, so they live in <LoginStateProvider>.
  const { mode, setMode, email, setEmail, password, setPassword, error, setError } = useLoginState();

  // Phone flow
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [name, setName] = useState("");

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const requestCode = () =>
    run(async () => {
      const res = await post("/api/auth/otp/request", { phone });
      if (!res.success) return setError(res.error ?? "Could not send the code");
      setCodeSent(true);
      setDevCode((res.data?.devCode as string) ?? null);
      setIsNewUser(Boolean(res.data?.isNewUser));
    });

  const verifyCode = () =>
    run(async () => {
      const res = await post("/api/auth/otp/verify", { phone, code, name: name || undefined });
      if (!res.success) return setError(res.error ?? "Could not verify the code");
      router.push(next ?? (res.data?.redirectTo as string) ?? "/app");
      router.refresh();
    });

  const signIn = () =>
    run(async () => {
      const res = await post("/api/auth/login", { email, password });
      if (!res.success) return setError(res.error ?? "Could not sign in");
      router.push(next ?? (res.data?.redirectTo as string) ?? "/");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Mode switch */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)]">
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 min-h-[36px] rounded-[6px] text-[13px] font-semibold transition-colors duration-150 ${
              mode === m
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(10,12,14,.06)]"
                : "text-[var(--color-ink-2)]"
            }`}
          >
            {m === "phone" ? "Patient · phone" : "Staff · email"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {mode === "phone" ? (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeSent) verifyCode();
            else requestCode();
          }}
        >
          <Input
            label="Mobile number"
            mono
            type="tel"
            autoComplete="tel"
            placeholder="+91 98•• ••4471"
            value={phone}
            disabled={codeSent}
            onChange={(e) => setPhone(e.target.value)}
          />

          {codeSent && (
            <>
              <div className="flex flex-col gap-[7px]">
                <span className="t-micro">Enter the code</span>
                <OtpBoxes value={code} onChange={setCode} />
                <span className="t-small text-[var(--color-ink-3)]">
                  Sent to {phone}.{" "}
                  <button
                    type="button"
                    onClick={requestCode}
                    className="text-[var(--color-primary)] underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Resend
                  </button>
                </span>
                {devCode && (
                  <span className="t-small text-[var(--color-ink-2)]">
                    Development build — your code is <span className="t-data text-[13px]">{devCode}</span>
                  </span>
                )}
              </div>

              {isNewUser && (
                <Input
                  label="Your name"
                  hint="As per ID"
                  placeholder="Riya Mehta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </>
          )}

          <Button
            type="submit"
            size="lg"
            block
            loading={busy}
            disabled={codeSent ? code.length !== 6 : phone.length < 10}
          >
            {codeSent ? "Verify and continue" : "Send code"}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@nutridrip.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" size="lg" block loading={busy} disabled={!email || !password}>
            Sign in
          </Button>
        </form>
      )}
    </div>
  );
}
