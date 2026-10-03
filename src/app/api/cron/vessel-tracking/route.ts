import { assertCronAuthorized, withScrapeRun } from "@/lib/cron";
import { runVesselTrackingJob } from "@/lib/jobs";

export const maxDuration = 60;

/**
 * A short listen-and-close burst against aisstream.io for every actively
 * tracked vessel — see lib/ais.ts for why this can't be a held-open
 * connection on a serverless function. Needs to run every 15-30 minutes to
 * be useful, which Vercel's Hobby plan cron cannot do (once a day only) —
 * same constraint the news job hit, same fix: scheduled from GitHub Actions
 * instead (see .github/workflows/), not listed in vercel.json.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("vessel-tracking", runVesselTrackingJob);
}
