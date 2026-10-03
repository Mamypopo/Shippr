import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * `promisify` drops the options overload, so this is wrapped by hand to keep
 * the cost parameters type-checked rather than silently ignored.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and in core, so there is no native build to go wrong
 * on Windows or on Vercel and no dependency to keep patched. The parameters
 * are stored alongside the hash so they can be raised later without
 * invalidating existing passwords.
 */

/** OWASP's floor for scrypt: N=2^14, r=8, p=1. */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** scrypt's memory use is roughly 128 * N * r, so the default cap is too low. */
const MAX_MEMORY = 256 * N * R;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a password. Never throws on a malformed stored hash — a corrupt row
 * must read as "wrong password", not as a 500 that tells an attacker the
 * account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");

    const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEMORY,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burn roughly the time a real verification takes, for a username that does
 * not exist. Without it, "no such user" returns far faster than "wrong
 * password" and the response time alone reveals which usernames are real.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await scrypt("decoy", randomBytes(SALT_LENGTH), KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });
}

export interface PasswordRule {
  ok: boolean;
  message?: string;
}

/**
 * Length is what actually matters; composition rules push people toward
 * "Passw0rd!" and are no longer recommended.
 */
export const MIN_PASSWORD_LENGTH = 10;

export function checkPasswordStrength(password: string): PasswordRule {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
    };
  }
  if (password.length > 200) {
    return { ok: false, message: "รหัสผ่านยาวเกินไป" };
  }
  return { ok: true };
}

/** Lowercase, trimmed, no spaces — so case cannot create a second account. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function checkUsername(username: string): PasswordRule {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return {
      ok: false,
      message: "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 จุด ขีดล่าง ขีดกลาง ยาว 3 ถึง 32 ตัว",
    };
  }
  return { ok: true };
}
