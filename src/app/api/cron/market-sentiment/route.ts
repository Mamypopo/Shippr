import { assertCronAuthorized, statusFor, withScrapeRun } from "@/lib/cron";
import { upsertFreightIndices } from "@/lib/ingest";
import { fetchMarketSentiment } from "@/lib/market";

export const maxDuration = 60;

/**
 * Daily market sentiment (Baltic Dry Index, BDRY ETF).
 *
 * Each symbol succeeds or fails on its own. Yahoo's `^BDI` coverage is
 * patchy, and a missing BDI should not blank the sentiment panel when BDRY —
 * a traded ETF, reliably quoted — is available as a proxy.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  return withScrapeRun("market-sentiment", async () => {
    const outcomes = await fetchMarketSentiment();

    let rowsWritten = 0;
    const errors: string[] = [];

    for (const outcome of outcomes) {
      if (!outcome.ok) {
        errors.push(`${outcome.symbol}: ${outcome.error}`);
        continue;
      }

      const result = await upsertFreightIndices(outcome.rows, "YAHOO");
      rowsWritten += result.written;
      if (result.errors.length > 0) errors.push(`${outcome.symbol}: ${result.errors.join("; ")}`);
    }

    const okCount = outcomes.filter((o) => o.ok).length;

    return {
      status: statusFor(okCount, outcomes.length),
      rowsWritten,
      errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
      detail: outcomes.map((o) => ({
        symbol: o.symbol,
        ok: o.ok,
        rows: o.rows.length,
        error: o.error,
      })),
    };
  });
}
