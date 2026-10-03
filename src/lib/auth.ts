/**
 * Sign-in and authorisation.
 *
 * Accounts are created by an admin through the CLI; there is no self-serve
 * signup and no email. That removes the parts of authentication that are
 * genuinely hard to get right — verification mail, reset tokens, account
 * recovery — and leaves checking a password and issuing a session, which has
 * a known-good recipe.
 */

import { prisma } from "./db";
import { fakeVerifyDelay, normalizeUsername, verifyPassword } from "./password";
import { createSession, readSession } from "./session";
import type { UserRole } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string | null;
  orgName: string | null;
  role: UserRole;
}

/** Wrong password this many times and the account locks. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "INVALID" | "LOCKED" | "DISABLED"; retryAfterMinutes?: number };

/**
 * Check credentials and start a session.
 *
 * Every failure path returns the same generic `INVALID` and takes roughly the
 * same time, so neither the message nor the response time reveals whether a
 * username exists. The exception is `LOCKED`, which has to be distinguishable
 * or the user cannot tell why a correct password is being refused.
 */
export async function signIn(
  rawUsername: string,
  password: string,
  userAgent?: string | null,
): Promise<SignInResult> {
  const username = normalizeUsername(rawUsername);

  const user = await prisma.userProfile.findUnique({ where: { username } });

  if (!user) {
    // Burn comparable time so a missing account is not faster than a wrong
    // password, which would otherwise enumerate valid usernames.
    await fakeVerifyDelay();
    return { ok: false, reason: "INVALID" };
  }

  if (!user.isActive) {
    await fakeVerifyDelay();
    return { ok: false, reason: "DISABLED" };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      reason: "LOCKED",
      retryAfterMinutes: Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
      ),
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedAttempts = user.failedAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        failedAttempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });

    return shouldLock
      ? { ok: false, reason: "LOCKED", retryAfterMinutes: LOCKOUT_MINUTES }
      : { ok: false, reason: "INVALID" };
  }

  await prisma.userProfile.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id, userAgent);

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      orgName: user.orgName,
      role: user.role,
    },
  };
}

/**
 * The signed-in user, or null.
 *
 * Returns null rather than throwing on any failure. Every caller renders a
 * signed-out state, and failing closed to "signed out" is both safe and
 * better than a 500 on a page whose read half needs no account.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await readSession();
    if (!session) return null;

    const user = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        orgName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user?.isActive) return null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      orgName: user.orgName,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export interface AuthFailure {
  response: Response;
}

/**
 * Guard for route handlers that write data. Returns the signed-in user, or a
 * ready-made 401 response.
 *
 * There is exactly one person running this system, so there is nothing for a
 * role to distinguish: every account that exists is trusted with every write.
 * The `role` column stays on the schema as inert metadata rather than being
 * migrated away, in case a second person with narrower access is ever
 * actually needed, but no code branches on it.
 */
export async function requireAuth(): Promise<{ user: SessionUser } | AuthFailure> {
  const user = await getSessionUser();

  if (!user) {
    return { response: Response.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 }) };
  }

  return { user };
}

export function isAuthFailure(
  result: { user: SessionUser } | AuthFailure,
): result is AuthFailure {
  return "response" in result;
}

/** Display name for a byline: the person's name if set, else their username. */
export function displayName(user: SessionUser | null): string {
  if (!user) return "";
  return user.fullName?.trim() || user.username;
}
