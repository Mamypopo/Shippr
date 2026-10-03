import { describe, expect, it } from "vitest";

import {
  checkPasswordStrength,
  checkUsername,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  verifyPassword,
} from "./password";

describe("hashPassword / verifyPassword", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse batterz", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same password here");
    const b = await hashPassword("same password here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password here", a)).toBe(true);
    expect(await verifyPassword("same password here", b)).toBe(true);
  });

  it("stores the parameters so the cost can be raised later", async () => {
    const hash = await hashPassword("some password x");
    expect(hash.split("$").slice(0, 4)).toEqual(["scrypt", "16384", "8", "1"]);
  });

  it("never stores the password in the hash", async () => {
    const hash = await hashPassword("hunter2hunter2");
    expect(hash).not.toContain("hunter2");
  });

  it("treats a corrupt stored hash as a wrong password, not an error", async () => {
    expect(await verifyPassword("anything at all", "garbage")).toBe(false);
    expect(await verifyPassword("anything at all", "")).toBe(false);
    expect(await verifyPassword("anything at all", "bcrypt$1$2$3$4$5")).toBe(false);
  });

  it("normalizes unicode so the same typed password always matches", async () => {
    // "é" composed vs decomposed — different bytes, same password to a human.
    const hash = await hashPassword("caf\u00e9 password");
    expect(await verifyPassword("cafe\u0301 password", hash)).toBe(true);
  });
});

describe("checkPasswordStrength", () => {
  it("rejects anything under the minimum length", () => {
    expect(checkPasswordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1)).ok).toBe(false);
  });

  it("accepts a long passphrase with no symbols", () => {
    expect(checkPasswordStrength("ten green bottles standing").ok).toBe(true);
  });

  it("rejects an absurdly long input", () => {
    expect(checkPasswordStrength("a".repeat(500)).ok).toBe(false);
  });
});

describe("normalizeUsername / checkUsername", () => {
  it("lowercases and trims so case cannot create a second account", () => {
    expect(normalizeUsername("  NaPat  ")).toBe("napat");
  });

  it("accepts the allowed shape", () => {
    expect(checkUsername("napat.s").ok).toBe(true);
    expect(checkUsername("ops_01").ok).toBe(true);
  });

  it("rejects spaces, symbols and the wrong length", () => {
    expect(checkUsername("na pat").ok).toBe(false);
    expect(checkUsername("na@pat").ok).toBe(false);
    expect(checkUsername("ab").ok).toBe(false);
    expect(checkUsername("a".repeat(33)).ok).toBe(false);
  });
});
