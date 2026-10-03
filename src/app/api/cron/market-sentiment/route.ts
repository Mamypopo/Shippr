import { assertCronAuthorized, withScrapeRun } from "@/lib/cron";
import { runMarketSentimentJob } from "@/lib/jobs";

export const maxDuration = 60;

/**
 * Daily market sentiment (Baltic Dry Index, BDRY ETF).
 *
 * The job body lives in lib/jobs.ts, shared with the signed-in "run now"
 * route — a manual run and the scheduled run must do exactly the same thing.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("market-sentiment", runMarketSentimentJob);
}
