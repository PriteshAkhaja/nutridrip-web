import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSecretFor, jwtSecretProblem } from "@/lib/auth/secret";
import { openCode, sealCode } from "@/lib/auth/code-box";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const PLACEHOLDER = /^JWT_SECRET="([^"]+)"/m.exec(read(".env.example"))![1];
const REAL = "a3f9c1d27b4e8a6f0d5c2b7e9a1f4d83c6b0e5a29f7d1c4b8e3a6f2d0c9b7e51";

afterEach(() => vi.unstubAllEnvs());

describe("what may be the production signing secret", () => {
  it("accepts a private value of 16 characters or more", () => {
    expect(jwtSecretProblem(REAL)).toBeNull();
    expect(jwtSecretProblem("0123456789abcdef")).toBeNull();
  });
  it("refuses a missing, empty or short one", () => {
    for (const v of [undefined, null, "", "   ", "short", "123456789012345"])
      expect(jwtSecretProblem(v), String(v)).toMatch(/at least 16 characters/);
  });
  it("refuses the example's own value, which is public, exactly as written in .env.example", () => {
    expect(PLACEHOLDER.length).toBeGreaterThanOrEqual(16); // it passes the length rule on its own: the gap this closes
    expect(jwtSecretProblem(PLACEHOLDER)).toMatch(/example value/);
    expect(jwtSecretProblem(` ${PLACEHOLDER} `)).toMatch(/example value/);
  });
  it("refuses the development stand-in and anything that still says change-me", () => {
    expect(jwtSecretProblem("dev-only-insecure-secret-change-me-32chars")).toMatch(/example value/);
    for (const v of ["please-change-me-before-launch-ok", "CHANGEME-CHANGEME-CHANGEME", "my-change-me-secret-value"]) {
      expect(jwtSecretProblem(v), v).toMatch(/example value/);
    }
  });
});

describe("the key that seals session codes", () => {
  it("in production, refuses the example value, a short one and none at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const v of [PLACEHOLDER, "short", ""]) {
      vi.stubEnv("JWT_SECRET", v);
      expect(() => sealCode("123456"), JSON.stringify(v)).toThrow(/JWT_SECRET/);
    }
    vi.stubEnv("JWT_SECRET", PLACEHOLDER);
    expect(() => sealCode("123456")).toThrow(/node -e/); // and says how to make a good one
  });
  it("in production, works with a private secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", REAL);
    expect(openCode(sealCode("482913"))).toBe("482913");
  });
  it("in development, still runs from a fresh clone: with the example's value, or with none", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", PLACEHOLDER);
    expect(openCode(sealCode("111222"))).toBe("111222");
    vi.stubEnv("JWT_SECRET", "");
    expect(openCode(sealCode("333444"))).toBe("333444");
  });
});

describe("the check both keys make", () => {
  it("in production, throws for the example value, a short one and none, and says how to make a good one", () => {
    for (const v of [PLACEHOLDER, "short", undefined, ""]) {
      expect(() => assertSecretFor(v, "production"), JSON.stringify(v)).toThrow(/JWT_SECRET/);
    }
    expect(() => assertSecretFor(PLACEHOLDER, "production")).toThrow(/randomBytes/);
  });
  it("in production, lets a private secret through", () => {
    expect(() => assertSecretFor(REAL, "production")).not.toThrow();
  });
  it("outside production, never throws, so a fresh clone runs", () => {
    for (const env of ["development", "test", undefined]) {
      for (const v of [PLACEHOLDER, "short", undefined])
        expect(() => assertSecretFor(v, env), `${env} ${v}`).not.toThrow();
    }
  });
});

describe("the session signing key and the code-sealing key", () => {
  const call = /assertSecretFor\(raw, process\.env\.NODE_ENV\);/;
  it("both make that one call, with the real environment, before using the secret", () => {
    const session = read("src/lib/auth/session.ts");
    const box = read("src/lib/auth/code-box.ts");
    expect(session).toMatch(call);
    expect(box).toMatch(call);
    // The development stand-in is only reached after the call.
    expect(session.indexOf("assertSecretFor(")).toBeLessThan(session.indexOf("encode(DEV_SECRET)"));
    expect(box.indexOf("assertSecretFor(")).toBeLessThan(box.indexOf('createHash("sha256")'));
  });
  it("neither throws a secret error of its own, which could drift from the shared one (the development fallback is not one)", () => {
    for (const p of ["src/lib/auth/session.ts", "src/lib/auth/code-box.ts"]) {
      expect(read(p), p).not.toMatch(/throw new Error\([^)]*JWT_SECRET/);
    }
  });
});
