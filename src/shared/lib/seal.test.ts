import { describe, expect, it } from "vitest";
import { z } from "zod";
import { randomToken, seal, sha256, unseal } from "./seal.ts";

const schema = z.object({ userId: z.string() });

describe("seal", () => {
  it("round-trips data for the same type", () => {
    const token = seal("access", { userId: "abc" }, 60);
    const opened = unseal("access", token, schema);
    expect(opened?.data).toEqual({ userId: "abc" });
    expect(opened?.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects a token sealed for another type", () => {
    const token = seal("refresh", { userId: "abc" });
    expect(unseal("access", token, schema)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const token = seal("access", { userId: "abc" });
    const tampered = `${token.slice(0, -2)}${token.endsWith("A") ? "B" : "A"}`;
    expect(unseal("access", tampered, schema)).toBeNull();
    expect(unseal("access", "garbage", schema)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = seal("code", { userId: "abc" }, -1);
    expect(unseal("code", token, schema)).toBeNull();
  });

  it("rejects payloads that do not match the schema", () => {
    const token = seal("access", { other: 1 });
    expect(unseal("access", token, schema)).toBeNull();
  });

  it("produces unique random tokens and stable hashes", () => {
    expect(randomToken()).not.toEqual(randomToken());
    expect(sha256("x")).toEqual(sha256("x"));
    expect(sha256("x")).toHaveLength(64);
  });
});
