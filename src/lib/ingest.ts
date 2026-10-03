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
  const result: UpsertResult = { written: 0, failed: 0, errors: [] };

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
  const result: UpsertResult = { written: 0, failed: 0, errors: [] };

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

/**
 * The most recent successful run per source, for the staleness indicators.
 */
export async function latestRunsBySource(): Promise<
  Record<string, { status: string; startedAt: Date; rowsWritten: number } | undefined>
> {
  const runs = await prisma.scrapeRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    select: { source: true, status: true, startedAt: true, rowsWritten: true },
  });

  const bySource: Record<string, { status: string; startedAt: Date; rowsWritten: number }> = {};
  for (const run of runs) {
    if (!bySource[run.source]) {
      bySource[run.source] = {
        status: run.status,
        startedAt: run.startedAt,
        rowsWritten: run.rowsWritten,
      };
    }
  }

  return bySource;
}
