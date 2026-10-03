import { isAuthFailure, requireAuth } from "@/lib/auth";
import { withScrapeRun } from "@/lib/cron";
import { JOBS, type JobKey } from "@/lib/jobs";

/** Scraping and RSS fetches can run long; same budget as the cron routes. */
export const maxDuration = 60;

/**
 * Manual "run now" for an ingestion job, gated by session rather than the
 * cron secret.
 *
 * The cron secret must never reach the browser — embedding it in client code
 * so a button could call it would hand anyone who opens devtools the same
 * key Vercel Cron uses, letting them hit the real cron endpoint directly.
 * This route exists so the button can use the login the person already has
 * instead, and it runs the identical job body from lib/jobs.ts, recorded in
 * the same ScrapeRun log as a scheduled run.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ job: string }> },
): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  const { job } = await context.params;

  if (!(job in JOBS)) {
    return Response.json(
      { error: `ไม่รู้จัก job "${job}" ที่รองรับ: ${Object.keys(JOBS).join(", ")}` },
      { status: 404 },
    );
  }

  const key = job as JobKey;
  return withScrapeRun(key, JOBS[key].run);
}
