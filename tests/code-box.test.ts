import { describe, expect, it } from "vitest";
import { openCode, sealCode } from "@/lib/auth/code-box";

describe("sealed session codes", () => {
  it("opens to the code it sealed", () => {
    expect(openCode(sealCode("482913"))).toBe("482913");
  });

  it("seals the same code differently each time, so equal codes do not look equal", () => {
    expect(sealCode("482913")).not.toBe(sealCode("482913"));
  });

  it("never reveals the code in the sealed text", () => {
    expect(sealCode("482913")).not.toContain("482913");
  });

  it("opens nothing it did not seal, and nothing that was tampered with", () => {
    expect(openCode(null)).toBeNull();
    expect(openCode("")).toBeNull();
    expect(openCode("not.a.box")).toBeNull();
    const box = sealCode("482913").split(".");
    box[2] = Buffer.from("999999").toString("base64url");
    expect(openCode(box.join("."))).toBeNull();
  });
});
