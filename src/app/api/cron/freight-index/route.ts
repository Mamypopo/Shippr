import { assertCronAuthorized, withScrapeRun } from "@/lib/cron";
import { runFreightIndexJob } from "@/lib/jobs";

/** Scraping two sites with retries can outrun the default budget. */
export const maxDuration = 60;

/**
 * Weekly freight index ingestion (Drewry WCI, SCFI).
 *
 * Scheduled for Friday, after both indices publish. The job body lives in
 * lib/jobs.ts, shared with the signed-in "run now" route — a manual run and
 * the scheduled run must do exactly the same thing.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("freight-index", runFreightIndexJob);
}
