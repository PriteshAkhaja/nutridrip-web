"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** [role, email, password] — the shape of one seeded demo account. */
export type DemoAccount = readonly [role: string, email: string, password: string];

export type Mode = "phone" | "email";

type LoginStateValue = {
  mode: Mode;
  setMode: (m: Mode) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string | null;
  setError: (v: string | null) => void;
  /** Email of the account last picked from the demo panel; marks its row. */
  picked: string | null;
  applyDemo: (email: string, password: string) => void;
};

const LoginStateContext = createContext<LoginStateValue | null>(null);

export function useLoginState() {
  const ctx = useContext(LoginStateContext);
  if (!ctx) throw new Error("useLoginState must be used inside <LoginStateProvider>");
  return ctx;
}

/**
 * The sign-in form and the demo account list are in two different columns of a
 * server component, so the state they share — the open tab, and the email and
 * password in it — lives here rather than inside the form. Filling the form
 * from a demo row is then an ordinary event handler, not an effect reaching
 * across components. The phone/OTP flow keeps its own state in the form:
 * nothing outside it ever writes there.
 */
export function LoginStateProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const value = useMemo<LoginStateValue>(
    () => ({
      mode,
      setMode,
      email,
      setEmail,
      password,
      setPassword,
      error,
      setError,
      picked,
      // All six seeded accounts carry a password hash, so every role — the
      // patient included — signs in through the email tab.
      applyDemo: (demoEmail: string, demoPassword: string) => {
        setMode("email");
        setEmail(demoEmail);
        setPassword(demoPassword);
        setError(null);
        setPicked(demoEmail);
      },
    }),
    [mode, email, password, error, picked],
  );

  return <LoginStateContext.Provider value={value}>{children}</LoginStateContext.Provider>;
}
