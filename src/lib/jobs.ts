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
import type { DataSource } from "@/generated/prisma/enums";
import { fetchVesselPositions } from "./ais";
import { prisma } from "./db";
import { insertVesselPositions, upsertFreightIndices, upsertNewsItems } from "./ingest";
import { statusFor } from "./cron";
import { fetchMarketSentiment } from "./market";
import { fetchAllFeeds } from "./rss";
import { BUNKER_ADAPTERS, runAllAdapters, type ParsedIndex } from "./scraper";

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

    // A successful scrape that writes nothing because a human already
    // entered this period is not a problem — but staying silent about it
    // makes "0 rows written" next to a green status read as a bug report.
    if (result.skippedManual.length > 0) {
      errors.push(
        `${outcome.label}: ดึงได้ค่าปกติ แต่ไม่บันทึกทับข้อมูลที่กรอกมือไว้แล้วสำหรับ ${result.skippedManual.join(", ")}`,
      );
    }
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

/** A Yahoo symbol read and a bunker-fuel scrape, reduced to one shape so the loop below doesn't care which produced a given outcome. */
interface SentimentOutcome {
  label: string;
  ok: boolean;
  rows: ParsedIndex[];
  source: DataSource;
  error?: string;
}

/**
 * Daily market-context readings: Yahoo Finance symbols (BDRY, crude oil,
 * ZIM) plus bunker fuel's own price, scraped directly rather than proxied
 * through a commodity future. Bunker is an HTML scrape, not a Yahoo quote,
 * but it moves daily like the others, so it runs in the same job rather
 * than the weekly WCI/SCFI one.
 */
export async function runMarketSentimentJob(): Promise<RunSummary> {
  const [yahoo, bunker] = await Promise.all([fetchMarketSentiment(), runAllAdapters(BUNKER_ADAPTERS)]);

  const outcomes: SentimentOutcome[] = [
    ...yahoo.map((o) => ({ label: o.symbol, ok: o.ok, rows: o.rows, source: "YAHOO" as const, error: o.error })),
    ...bunker.map((o) => ({ label: o.label, ok: o.ok, rows: o.rows, source: "SCRAPER" as const, error: o.error })),
  ];

  let rowsWritten = 0;
  const errors: string[] = [];

  for (const outcome of outcomes) {
    if (!outcome.ok) {
      errors.push(`${outcome.label}: ${outcome.error}`);
      continue;
    }

    const result = await upsertFreightIndices(outcome.rows, outcome.source);
    rowsWritten += result.written;
    if (result.errors.length > 0) errors.push(`${outcome.label}: ${result.errors.join("; ")}`);

    if (result.skippedManual.length > 0) {
      errors.push(
        `${outcome.label}: ดึงได้ค่าปกติ แต่ไม่บันทึกทับข้อมูลที่กรอกมือไว้แล้วสำหรับ ${result.skippedManual.join(", ")}`,
      );
    }
  }

  const okCount = outcomes.filter((o) => o.ok).length;

  return {
    status: statusFor(okCount, outcomes.length),
    rowsWritten,
    errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
    detail: outcomes.map((o) => ({
      symbol: o.label,
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

/**
 * A short listen-and-close burst against aisstream.io for whichever vessels
 * are currently tracked — see `ais.ts` for why this isn't a held-open
 * connection. Running on a schedule, this answers "where was the vessel
 * last seen," not "where is it exactly right now."
 */
export async function runVesselTrackingJob(): Promise<RunSummary> {
  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    return {
      status: "FAILED",
      rowsWritten: 0,
      errorMessage: "AISSTREAM_API_KEY is not configured on this deployment.",
    };
  }

  const vessels = await prisma.trackedVessel.findMany({
    where: { isActive: true },
    select: { id: true, mmsi: true },
  });

  if (vessels.length === 0) {
    return { status: "SUCCESS", rowsWritten: 0, errorMessage: "ไม่มีเรือที่กำลังติดตามอยู่" };
  }

  const mmsiToVesselId = new Map(vessels.map((v) => [v.mmsi, v.id]));

  try {
    const reports = await fetchVesselPositions(vessels.map((v) => v.mmsi), apiKey);
    const result = await insertVesselPositions(reports, mmsiToVesselId);

    const silent = vessels.filter((v) => !reports.some((r) => r.mmsi === v.mmsi));
    const note =
      silent.length > 0
        ? `ไม่มีสัญญาณจากเรือในช่วงนี้: MMSI ${silent.map((v) => v.mmsi).join(", ")} (ปกติถ้าเรืออยู่กลางทะเลไกลสถานีรับสัญญาณ)`
        : undefined;

    return {
      status: reports.length > 0 ? "SUCCESS" : "PARTIAL",
      rowsWritten: result.written,
      errorMessage: [note, ...result.errors].filter(Boolean).join(" | ") || undefined,
      detail: { tracked: vessels.length, reported: reports.length },
    };
  } catch (error) {
    return {
      status: "FAILED",
      rowsWritten: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Keyed registry, so a route can resolve "which job" from a URL segment. */
export const JOBS = {
  "freight-index": { label: "ดัชนีค่าระวาง", run: runFreightIndexJob },
  "market-sentiment": { label: "BDRY / น้ำมันดิบ / ZIM / VLSFO", run: runMarketSentimentJob },
  news: { label: "ข่าว RSS", run: runNewsJob },
  "vessel-tracking": { label: "ตำแหน่งเรือที่ติดตาม", run: runVesselTrackingJob },
} as const;

export type JobKey = keyof typeof JOBS;
