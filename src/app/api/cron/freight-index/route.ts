import { assertCronAuthorized, statusFor, withScrapeRun } from "@/lib/cron";
import { upsertFreightIndices } from "@/lib/ingest";
import { runAllAdapters } from "@/lib/scraper";

/** Scraping two sites with retries can outrun the default budget. */
export const maxDuration = 60;

/**
 * Weekly freight index ingestion (Drewry WCI, SCFI).
 *
 * Scheduled for Friday, after both indices publish. A failing source writes
 * nothing and is recorded on the run log; the dashboard then shows the lane
 * as stale rather than presenting last week's figure as current.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("freight-index", async () => {
    const outcomes = await runAllAdapters();

    let rowsWritten = 0;
    const errors: string[] = [];

    for (const outcome of outcomes) {
      if (!outcome.ok) {
        errors.push(`${outcome.label}: ${outcome.error}`);
        continue;
      }

      const result = await upsertFreightIndices(outcome.rows, "SCRAPER");
      rowsWritten += result.written;
      if (result.errors.length > 0) errors.push(`${outcome.label}: ${result.errors.join("; ")}`);
    }

    const okCount = outcomes.filter((o) => o.ok).length;

    return {
      status: statusFor(okCount, outcomes.length),
      rowsWritten,
      errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
      detail: outcomes.map((o) => ({
        source: o.label,
        ok: o.ok,
        rows: o.rows.length,
        error: o.error,
      })),
    };
  });
}
