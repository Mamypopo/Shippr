/**
 * The ingestion jobs themselves, independent of who is allowed to run them.
 *
 * Two callers share this: the `/api/cron/*` routes (gated by `CRON_SECRET`,
 * for Vercel Cron and the GitHub Actions workflow) and the `/api/admin/run/*`
 * routes (gated by a signed-in session, for the "run now" buttons on the
 * ingestion status panel). Keeping the job body here means both paths run
 * the exact same logic — a one-off manual run and the scheduled run cannot
 * quietly drift apart.
 */

import type { RunSummary } from "./cron";
import { upsertFreightIndices, upsertNewsItems } from "./ingest";
import { statusFor } from "./cron";
import { fetchMarketSentiment } from "./market";
import { fetchAllFeeds } from "./rss";
import { runAllAdapters } from "./scraper";

export async function runFreightIndexJob(): Promise<RunSummary> {
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
}

export async function runMarketSentimentJob(): Promise<RunSummary> {
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
}

export async function runNewsJob(): Promise<RunSummary> {
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
}

/** Keyed registry, so a route can resolve "which job" from a URL segment. */
export const JOBS = {
  "freight-index": { label: "ดัชนีค่าระวาง", run: runFreightIndexJob },
  "market-sentiment": { label: "BDI / BDRY", run: runMarketSentimentJob },
  news: { label: "ข่าว RSS", run: runNewsJob },
} as const;

export type JobKey = keyof typeof JOBS;
