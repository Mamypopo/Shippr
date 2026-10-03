/**
 * Session and role resolution.
 *
 * Supabase owns authentication; `UserProfile` owns the role. Keeping the role
 * in our own table means an authorisation check is a local query rather than
 * a round trip, and the role can be audited alongside the decisions a user
 * made with it.
 */

import { prisma } from "./db";
import { createSupabaseServerClient } from "./supabase/server";
import type { UserRole } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  orgName: string | null;
  role: UserRole;
}

const ROLE_RANK: Record<UserRole, number> = { VIEWER: 0, ANALYST: 1, ADMIN: 2 };

/**
 * The signed-in user, with their profile row created on first sight.
 *
 * `getUser()` rather than `getSession()`: the former verifies the JWT with
 * Supabase, the latter trusts a cookie the browser could have forged.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const profile = await prisma.userProfile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      // First account in an empty instance becomes the admin; everyone after
      // starts as a viewer and is promoted deliberately.
      role: (await prisma.userProfile.count()) === 0 ? "ADMIN" : "VIEWER",
    },
    update: { email: user.email },
  });

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    orgName: profile.orgName,
    role: profile.role,
  };
}

export function hasRole(user: SessionUser | null, required: UserRole): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[required];
}

export interface AuthFailure {
  response: Response;
}

/**
 * Guard for route handlers. Returns the user, or a ready-made response.
 *
 * 401 and 403 are kept distinct: "sign in" and "your account cannot do this"
 * need different handling in the UI.
 */
export async function requireRole(
  required: UserRole,
): Promise<{ user: SessionUser } | AuthFailure> {
  const user = await getSessionUser();

  if (!user) {
    return { response: Response.json({ error: "Sign in required." }, { status: 401 }) };
  }

  if (!hasRole(user, required)) {
    return {
      response: Response.json(
        { error: `This action requires the ${required} role; your account is ${user.role}.` },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export function isAuthFailure(
  result: { user: SessionUser } | AuthFailure,
): result is AuthFailure {
  return "response" in result;
}
