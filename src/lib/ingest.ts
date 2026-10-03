/**
 * Writing ingested data to the database.
 *
 * Every write is an upsert on a natural key, so re-running a job — a cron
 * retry, a manual kick, a backfill — converges on the same rows instead of
 * duplicating them.
 */

import { prisma } from "./db";
import type { VesselPositionReport } from "./ais";
import type { ParsedNewsItem } from "./rss";
import type { ParsedIndex } from "./scraper";
import type { DataSource, IndexCode, IndexUnit } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface UpsertResult {
  written: number;
  failed: number;
  errors: string[];
  /**
   * Rows the scraper read successfully but did not write, because a human
   * had already entered that exact period. Tracked separately from `failed`:
   * the fetch worked, so folding this into "failed" would make a correctly
   * protected manual entry look like a broken scraper, and folding it into
   * `written` would make a no-op look like new data landed.
   */
  skippedManual: string[];
}

/**
 * Upsert index readings on (indexCode, routeCode, periodDate).
 *
 * A manually entered figure is not overwritten by a later scrape of the same
 * week: if someone took the trouble to key in the real number, a scraper
 * result for that slot is the less trustworthy of the two.
 */
/** `indexCode|routeCode|periodDate` — stable key for matching rows to the bulk MANUAL check. */
function freightIndexKey(row: { indexCode: string; routeCode: string; periodDate: Date }): string {
  return `${row.indexCode}|${row.routeCode}|${row.periodDate.getTime()}`;
}

export async function upsertFreightIndices(
  rows: ParsedIndex[],
  source: DataSource,
): Promise<UpsertResult> {
  const result: UpsertResult = { written: 0, failed: 0, errors: [], skippedManual: [] };
  if (rows.length === 0) return result;

  // One query for every slot this batch touches, instead of a find-then-write
  // round trip per row: with Supabase several hundred kilometres away, that
  // was averaging ~250ms/round-trip, so a 90-day backfill across a few
  // symbols (close to 200 rows x 2 queries) was the entire 60-100s this job
  // used to take through the API route.
  const existing =
    source === "MANUAL"
      ? []
      : await prisma.freightIndex.findMany({
          where: {
            OR: rows.map((row) => ({
              indexCode: row.indexCode as IndexCode,
              routeCode: row.routeCode,
              periodDate: row.periodDate,
            })),
          },
          select: { indexCode: true, routeCode: true, periodDate: true, source: true },
        });
  const manualKeys = new Set(
    existing.filter((e) => e.source === "MANUAL").map((e) => freightIndexKey(e)),
  );

  const outcomes = await Promise.allSettled(
    rows.map(async (row) => {
      if (manualKeys.has(freightIndexKey(row))) return "skipped" as const;

      await prisma.freightIndex.upsert({
        where: {
          indexCode_routeCode_periodDate: {
            indexCode: row.indexCode as IndexCode,
            routeCode: row.routeCode,
            periodDate: row.periodDate,
          },
        },
        create: {
          indexCode: row.indexCode as IndexCode,
          routeCode: row.routeCode,
          periodDate: row.periodDate,
          value: row.value,
          unit: row.unit as IndexUnit,
          source,
          rawSnapshot: (row.rawSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          value: row.value,
          unit: row.unit as IndexUnit,
          source,
          rawSnapshot: (row.rawSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return "written" as const;
    }),
  );

  outcomes.forEach((outcome, i) => {
    const row = rows[i];
    const label = `${row.indexCode}/${row.routeCode}@${row.periodDate.toISOString().slice(0, 10)}`;

    if (outcome.status === "rejected") {
      result.failed++;
      result.errors.push(
        `${label}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`,
      );
    } else if (outcome.value === "skipped") {
      result.skippedManual.push(label);
    } else {
      result.written++;
    }
  });

  return result;
}

/** Upsert news on the feed guid. Re-running a feed adds only what is new. */
export async function upsertNewsItems(items: ParsedNewsItem[]): Promise<UpsertResult> {
  const result: UpsertResult = { written: 0, failed: 0, errors: [], skippedManual: [] };
  if (items.length === 0) return result;

  // Parallel, not sequential, for the same reason as `upsertFreightIndices`:
  // one item at a time across a ~250ms round trip to Supabase turns a feed's
  // worth of items into a job that can run long enough to threaten the
  // platform's execution-time limit.
  const outcomes = await Promise.allSettled(
    items.map((item) =>
      prisma.newsFeedItem.upsert({
        where: { guid: item.guid },
        create: {
          guid: item.guid,
          sourceName: item.sourceName,
          title: item.title,
          link: item.link,
          summary: item.summary,
          publishedAt: item.publishedAt,
          tags: item.tags,
          severity: item.severity,
          matchedKeywords: item.matchedKeywords,
        },
        // Feeds edit headlines and bodies after publication, and the tags
        // derive from them, so both are refreshed.
        update: {
          title: item.title,
          summary: item.summary,
          tags: item.tags,
          severity: item.severity,
          matchedKeywords: item.matchedKeywords,
        },
      }),
    ),
  );

  outcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      result.written++;
    } else {
      result.failed++;
      result.errors.push(
        `${items[i].guid}: ${
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        }`,
      );
    }
  });

  return result;
}

export interface LatestRun {
  status: string;
  startedAt: Date;
  rowsWritten: number;
  /**
   * Carried through from `ScrapeRun.errorMessage`. This is not only failure
   * text — a "SUCCESS" or "PARTIAL" run can still have something here (e.g.
   * a scrape that worked but wrote nothing because the period was already
   * entered by hand), and dropping it after the toast closes was exactly
   * what made "partial success, 0 rows written" look unexplained on reload.
   */
  errorMessage: string | null;
}

/**
 * Insert AIS position reports for tracked vessels, keyed by MMSI.
 *
 * `mmsiToVesselId` is looked up once by the caller rather than per report,
 * for the same reason the other upserts here were changed from per-row
 * round trips to a single batched one: this can report positions for many
 * vessels in one listening window, and a vessel a report doesn't match (one
 * no longer tracked) is skipped rather than erroring the batch.
 */
export async function insertVesselPositions(
  reports: VesselPositionReport[],
  mmsiToVesselId: Map<number, string>,
): Promise<UpsertResult> {
  const result: UpsertResult = { written: 0, failed: 0, errors: [], skippedManual: [] };
  if (reports.length === 0) return result;

  const rows = reports.flatMap((report) => {
    const vesselId = mmsiToVesselId.get(report.mmsi);
    if (!vesselId) return [];
    return [
      {
        vesselId,
        observedAt: report.observedAt,
        lat: report.lat,
        lon: report.lon,
        speedKnots: report.speedKnots,
        courseDeg: report.courseDeg,
        navStatus: report.navStatus,
      },
    ];
  });

  if (rows.length === 0) return result;

  try {
    // A retry hitting the exact same (vesselId, observedAt) pair again is
    // expected, not an error — `skipDuplicates` makes that a no-op instead
    // of a thrown unique-constraint violation.
    const created = await prisma.vesselPosition.createMany({ data: rows, skipDuplicates: true });
    result.written = created.count;
  } catch (error) {
    result.failed = rows.length;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * The most recent run per source, for the ingestion status panel.
 */
export async function latestRunsBySource(): Promise<Record<string, LatestRun | undefined>> {
  const runs = await prisma.scrapeRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    select: { source: true, status: true, startedAt: true, rowsWritten: true, errorMessage: true },
  });

  const bySource: Record<string, LatestRun> = {};
  for (const run of runs) {
    if (!bySource[run.source]) {
      bySource[run.source] = {
        status: run.status,
        startedAt: run.startedAt,
        rowsWritten: run.rowsWritten,
        errorMessage: run.errorMessage,
      };
    }
  }

  return bySource;
}
