/**
 * Writing ingested data to the database.
 *
 * Every write is an upsert on a natural key, so re-running a job — a cron
 * retry, a manual kick, a backfill — converges on the same rows instead of
 * duplicating them.
 */

import { prisma } from "./db";
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
export async function upsertFreightIndices(
  rows: ParsedIndex[],
  source: DataSource,
): Promise<UpsertResult> {
  const result: UpsertResult = { written: 0, failed: 0, errors: [], skippedManual: [] };

  for (const row of rows) {
    const where = {
      indexCode_routeCode_periodDate: {
        indexCode: row.indexCode as IndexCode,
        routeCode: row.routeCode,
        periodDate: row.periodDate,
      },
    };

    try {
      const existing = await prisma.freightIndex.findUnique({ where, select: { source: true } });
      if (existing?.source === "MANUAL" && source !== "MANUAL") {
        result.skippedManual.push(
          `${row.indexCode}/${row.routeCode}@${row.periodDate.toISOString().slice(0, 10)}`,
        );
        continue;
      }

      await prisma.freightIndex.upsert({
        where,
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

      result.written++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `${row.indexCode}/${row.routeCode}@${row.periodDate.toISOString().slice(0, 10)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return result;
}

/** Upsert news on the feed guid. Re-running a feed adds only what is new. */
export async function upsertNewsItems(items: ParsedNewsItem[]): Promise<UpsertResult> {
  const result: UpsertResult = { written: 0, failed: 0, errors: [], skippedManual: [] };

  for (const item of items) {
    try {
      await prisma.newsFeedItem.upsert({
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
      });

      result.written++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `${item.guid}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

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
