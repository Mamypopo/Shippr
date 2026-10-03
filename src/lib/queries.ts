/**
 * Server-side reads for the dashboard and decision pages.
 *
 * Decimal columns are converted to plain numbers here, once, so nothing
 * downstream has to know Prisma returns `Decimal`.
 */

import { prisma, toNumber } from "./db";
import { computeMetrics, type IndexMetrics, type IndexPoint } from "./metrics";
import { riskLevelForWaitDays, type RiskLevelKey } from "./risk";
import type { IndexCode } from "@/generated/prisma/enums";

export interface IndexSeries {
  indexCode: string;
  routeCode: string;
  unit: string;
  source: string;
  points: IndexPoint[];
  metrics: IndexMetrics;
}

/** Readings for one index/lane, oldest first, with derived metrics attached. */
export async function getIndexSeries(
  indexCode: IndexCode,
  routeCode = "COMPOSITE",
  limit = 52,
): Promise<IndexSeries | null> {
  const rows = await prisma.freightIndex.findMany({
    where: { indexCode, routeCode },
    orderBy: { periodDate: "desc" },
    take: limit,
    select: { periodDate: true, value: true, unit: true, source: true },
  });

  if (rows.length === 0) return null;

  const points: IndexPoint[] = rows
    .map((r) => ({ periodDate: r.periodDate, value: toNumber(r.value) }))
    .reverse();

  return {
    indexCode,
    routeCode,
    unit: rows[0].unit,
    source: rows[0].source,
    points,
    metrics: computeMetrics(points),
  };
}

/** Every lane that has data, for the dashboard grid. */
export async function getAllIndexSeries(limit = 52): Promise<IndexSeries[]> {
  const lanes = await prisma.freightIndex.findMany({
    distinct: ["indexCode", "routeCode"],
    orderBy: [{ indexCode: "asc" }, { routeCode: "asc" }],
    select: { indexCode: true, routeCode: true },
  });

  const series = await Promise.all(
    lanes.map((lane) => getIndexSeries(lane.indexCode, lane.routeCode, limit)),
  );

  return series.filter((s): s is IndexSeries => s !== null);
}

export interface PortSnapshot {
  id: string;
  unlocode: string;
  name: string;
  country: string;
  lat: number | null;
  lon: number | null;
  avgWaitDays: number | null;
  vesselsWaiting: number | null;
  riskLevel: RiskLevelKey | null;
  observedOn: Date | null;
  source: string | null;
  note: string | null;
}

/**
 * Latest reading per tracked port.
 *
 * Ports with no reading yet are still returned, with nulls. A hub silently
 * missing from the grid reads as "no congestion" to anyone scanning it.
 */
export async function getPortSnapshots(): Promise<PortSnapshot[]> {
  const ports = await prisma.port.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { statuses: { orderBy: { observedOn: "desc" }, take: 1 } },
  });

  return ports.map((port) => {
    const latest = port.statuses[0];
    const avgWaitDays = latest ? toNumber(latest.avgWaitDays) : null;

    return {
      id: port.id,
      unlocode: port.unlocode,
      name: port.name,
      country: port.country,
      lat: port.lat,
      lon: port.lon,
      avgWaitDays,
      vesselsWaiting: latest?.vesselsWaiting ?? null,
      riskLevel: avgWaitDays === null ? null : riskLevelForWaitDays(avgWaitDays),
      observedOn: latest?.observedOn ?? null,
      source: latest?.source ?? null,
      note: latest?.note ?? null,
    };
  });
}

export interface NewsItemView {
  id: string;
  sourceName: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  tags: string[];
  severity: string;
}

export async function getRecentNews(limit = 25, severity?: string): Promise<NewsItemView[]> {
  const items = await prisma.newsFeedItem.findMany({
    where: severity ? { severity: severity as never } : undefined,
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return items.map((item) => ({
    id: item.id,
    sourceName: item.sourceName,
    title: item.title,
    link: item.link,
    summary: item.summary,
    publishedAt: item.publishedAt,
    tags: item.tags,
    severity: item.severity,
  }));
}

export async function countRecentAlerts(days = 7): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.newsFeedItem.count({ where: { severity: "ALERT", publishedAt: { gte: since } } });
}

export async function getTopAlert(days = 7): Promise<NewsItemView | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const item = await prisma.newsFeedItem.findFirst({
    where: { severity: "ALERT", publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
  });

  if (!item) return null;

  return {
    id: item.id,
    sourceName: item.sourceName,
    title: item.title,
    link: item.link,
    summary: item.summary,
    publishedAt: item.publishedAt,
    tags: item.tags,
    severity: item.severity,
  };
}

/**
 * The market figure to benchmark a quote against: the newest reading on the
 * requested lane, falling back to the composite when that lane has none.
 */
export async function getBenchmarkForRoute(
  routeCode: string | null | undefined,
): Promise<{ value: number; periodDate: Date; routeCode: string; isFallback: boolean } | null> {
  const lanes = routeCode && routeCode !== "COMPOSITE" ? [routeCode, "COMPOSITE"] : ["COMPOSITE"];

  for (const lane of lanes) {
    const row = await prisma.freightIndex.findFirst({
      where: { indexCode: "WCI", routeCode: lane },
      orderBy: { periodDate: "desc" },
      select: { value: true, periodDate: true, routeCode: true },
    });

    if (row) {
      return {
        value: toNumber(row.value),
        periodDate: row.periodDate,
        routeCode: row.routeCode,
        isFallback: lane !== routeCode,
      };
    }
  }

  return null;
}

export interface TrackedVesselView {
  id: string;
  mmsi: number;
  label: string;
  destinationPort: { name: string; lat: number | null; lon: number | null } | null;
  latestPosition: {
    lat: number;
    lon: number;
    speedKnots: number | null;
    navStatus: string | null;
    observedAt: Date;
  } | null;
}

/** Active tracked vessels with their most recent known position, for the dashboard card. */
export async function getTrackedVessels(): Promise<TrackedVesselView[]> {
  const vessels = await prisma.trackedVessel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      destinationPort: { select: { name: true, lat: true, lon: true } },
      positions: { orderBy: { observedAt: "desc" }, take: 1 },
    },
  });

  return vessels.map((v) => {
    const latest = v.positions[0];
    return {
      id: v.id,
      mmsi: v.mmsi,
      label: v.label,
      destinationPort: v.destinationPort,
      latestPosition: latest
        ? {
            lat: latest.lat,
            lon: latest.lon,
            speedKnots: latest.speedKnots,
            navStatus: latest.navStatus,
            observedAt: latest.observedAt,
          }
        : null,
    };
  });
}
