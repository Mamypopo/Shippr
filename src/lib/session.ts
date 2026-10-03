import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "./db";

/**
 * Session cookies.
 *
 * The cookie carries a random token; the database stores only its SHA-256.
 * A leaked database dump therefore cannot be replayed as a live session, and
 * because sessions are rows rather than self-signed tokens, revoking one
 * actually revokes it.
 */

export const SESSION_COOKIE = "shippr_session";
const SESSION_DAYS = 30;
/** Renew when less than this is left, so an active user is never kicked out. */
const RENEW_WITHIN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax rather than Strict: Strict would drop the cookie when arriving from
    // an external link, signing the user out for no security gain here.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionRecord {
  userId: string;
  sessionId: string;
}

/** Resolve the cookie to a live session, renewing it when it is close to expiry. */
export async function readSession(): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Clean up as we go rather than relying on a sweeper job existing.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < RENEW_WITHIN_DAYS * DAY_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await prisma.session
      .update({ where: { id: session.id }, data: { expiresAt, lastSeenAt: new Date() } })
      .catch(() => {});

    // Server Components cannot set cookies; this runs in route handlers and
    // Server Actions, and silently does nothing elsewhere.
    try {
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    } catch {
      // Expiry is already extended server-side; the cookie catches up on the
      // next request that can write one.
    }
  }

  return { userId: session.userId, sessionId: session.id };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Sign a user out everywhere — used after a password change. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
