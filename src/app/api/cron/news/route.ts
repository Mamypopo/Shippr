import { assertCronAuthorized, statusFor, withScrapeRun } from "@/lib/cron";
import { upsertNewsItems } from "@/lib/ingest";
import { fetchAllFeeds } from "@/lib/rss";

export const maxDuration = 60;

/**
 * Disruption news ingestion from the logistics RSS feeds.
 *
 * Runs every four hours. Items are deduped on a hash of the feed guid or
 * link, so a rerun inside the same window adds nothing new.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("news", async () => {
    const outcomes = await fetchAllFeeds();

    let rowsWritten = 0;
    const errors: string[] = [];

    for (const outcome of outcomes) {
      if (!outcome.ok) {
        errors.push(`${outcome.name}: ${outcome.error}`);
        continue;
      }

      const result = await upsertNewsItems(outcome.items);
      rowsWritten += result.written;
      if (result.errors.length > 0) errors.push(`${outcome.name}: ${result.errors.join("; ")}`);
    }

    const okCount = outcomes.filter((o) => o.ok).length;

    return {
      status: statusFor(okCount, outcomes.length),
      rowsWritten,
      errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
      detail: outcomes.map((o) => ({
        feed: o.name,
        ok: o.ok,
        items: o.items.length,
        alerts: o.items.filter((i) => i.severity === "ALERT").length,
        error: o.error,
      })),
    };
  });
}
