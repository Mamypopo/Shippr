import { assertCronAuthorized, withScrapeRun } from "@/lib/cron";
import { runNewsJob } from "@/lib/jobs";

export const maxDuration = 60;

/**
 * Disruption news ingestion from the logistics RSS feeds.
 *
 * The job body lives in lib/jobs.ts, shared with the signed-in "run now"
 * route — a manual run and the scheduled run must do exactly the same thing.
 * Items are deduped on a hash of the feed guid or link, so a rerun inside
 * the same window adds nothing new.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("news", runNewsJob);
}
