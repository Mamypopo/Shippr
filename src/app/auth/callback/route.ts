import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exchanges the magic-link code for a session cookie, then returns the user
 * to wherever they were headed.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/signin?error=missing-code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/signin?error=exchange-failed", url.origin));
  }

  // Only same-origin paths, so a crafted link cannot bounce a freshly
  // authenticated user off to someone else's site.
  const destination = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(destination, url.origin));
}
