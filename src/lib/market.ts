/**
 * Daily market sentiment from Yahoo Finance.
 *
 * Three symbols, fetched independently on purpose, so one failing never
 * blanks the others:
 *
 * - BDRY — a traded dry-bulk shipping ETF, always quoted.
 * - WTI and Brent crude (`CL=F` / `BZ=F`) — bunker fuel is a direct, major
 *   input to ocean freight rates, so crude is a relevant leading indicator
 *   even though it isn't a shipping index itself.
 *
 * The Baltic Dry Index (`^BDI`) was tried first and dropped entirely, not
 * just left to fail quietly: Yahoo has zero data for it, confirmed with both
 * a direct quote and a symbol search turning up nothing — it was never
 * "unreliable," it simply isn't carried on Yahoo's free feed at all (Baltic
 * Exchange sells it as a commercial product). BDRY was already standing in
 * for it as a correlated proxy, so nothing here is actually a regression.
 */

import YahooFinance from "yahoo-finance2";

import { describeError } from "./http";
import { MARKET_SYMBOLS } from "./scraper-config";
import type { IndexCodeKey, IndexUnitKey, ParsedIndex } from "./scraper";

const yahooFinance = new YahooFinance({
  // These symbols routinely return partial payloads; a schema complaint about
  // a field we never read should not fail the job.
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false, logOptionsErrors: false },
});

export interface SymbolOutcome {
  symbol: string;
  indexCode: IndexCodeKey;
  ok: boolean;
  rows: ParsedIndex[];
  error?: string;
}

/** Midnight UTC for the day a quote belongs to, so one day means one row. */
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Daily closes for one symbol over the trailing window.
 *
 * Backfilling a window rather than taking only today's quote means a missed
 * cron run heals itself on the next invocation instead of leaving a hole in
 * the chart.
 */
export async function fetchSymbolHistory(
  symbol: string,
  indexCode: IndexCodeKey,
  unit: IndexUnitKey,
  lookbackDays = 90,
): Promise<ParsedIndex[]> {
  const period1 = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const result = await yahooFinance.chart(symbol, { period1, interval: "1d" });
  const quotes = result?.quotes ?? [];

  const rows: ParsedIndex[] = [];

  for (const quote of quotes) {
    const close = quote.close ?? quote.adjclose;
    // Yahoo pads the series with null closes for non-trading days.
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
    if (!quote.date) continue;

    rows.push({
      indexCode,
      routeCode: "COMPOSITE",
      periodDate: toUtcDate(new Date(quote.date)),
      value: close,
      unit,
      rawSnapshot: { symbol, source: "yahoo-finance2" },
    });
  }

  if (rows.length === 0) {
    throw new Error(`no usable closes returned for ${symbol}`);
  }

  return rows;
}

/**
 * Fetch both sentiment symbols, isolating failures.
 *
 * Callers should treat a partial result as a success worth writing, and
 * record the failed symbol on the run log.
 */
export async function fetchMarketSentiment(lookbackDays = 90): Promise<SymbolOutcome[]> {
  const targets: Array<{ symbol: string; indexCode: IndexCodeKey; unit: IndexUnitKey }> = [
    { symbol: MARKET_SYMBOLS.BDRY, indexCode: "BDRY", unit: "USD" },
    { symbol: MARKET_SYMBOLS.WTI, indexCode: "WTI", unit: "USD" },
    { symbol: MARKET_SYMBOLS.BRENT, indexCode: "BRENT", unit: "USD" },
    { symbol: MARKET_SYMBOLS.ZIM, indexCode: "ZIM", unit: "USD" },
  ];

  const settled = await Promise.allSettled(
    targets.map((t) => fetchSymbolHistory(t.symbol, t.indexCode, t.unit, lookbackDays)),
  );

  return settled.map((result, i) => {
    const target = targets[i];
    if (result.status === "fulfilled") {
      return { symbol: target.symbol, indexCode: target.indexCode, ok: true, rows: result.value };
    }
    return {
      symbol: target.symbol,
      indexCode: target.indexCode,
      ok: false,
      rows: [],
      error: describeError(result.reason),
    };
  });
}
