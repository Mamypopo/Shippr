import Link from "next/link";

import { IndexBand } from "@/components/market/IndexBand";
import { MarketSummary, type HeadlineFigure } from "@/components/market/MarketSummary";
import { DisruptionList } from "@/components/news/DisruptionList";
import { LiveShipMap } from "@/components/ports/LiveShipMap";
import { PortBayPlan } from "@/components/ports/PortBayPlan";
import { WindyEmbed } from "@/components/ports/WindyEmbed";
import { formatDelta, formatIndexValue, indexLabel, thaiFullDate, unitSuffix } from "@/lib/format";
import { fetchUsdThbRate } from "@/lib/fx";
import {
  countRecentAlerts,
  getAllIndexSeries,
  getPortSnapshots,
  getRecentNews,
  getTopAlert,
  type IndexSeries,
} from "@/lib/queries";
import { buildMarketSummary } from "@/lib/summary";
import { routeLabel } from "@/lib/benchmark";

/** Ingested data changes under the page; never serve a cached snapshot. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [series, ports, news, alertCount7d, topAlert, usdThbRate] = await Promise.all([
    getAllIndexSeries(),
    getPortSnapshots(),
    getRecentNews(20),
    countRecentAlerts(7),
    getTopAlert(7),
    fetchUsdThbRate(),
  ]);

  const summary = buildMarketSummary({
    indices: series.map((s) => ({
      indexCode: s.indexCode,
      label: seriesLabel(s),
      unit: s.unit,
      metrics: s.metrics,
    })),
    ports: ports
      .filter((p) => p.avgWaitDays !== null && p.riskLevel !== null)
      .map((p) => ({ name: p.name, avgWaitDays: p.avgWaitDays!, riskLevel: p.riskLevel! })),
    alertCount7d,
    topAlertHeadline: topAlert?.title ?? null,
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <MarketSummary
        bullets={summary}
        headline={buildHeadline(series)}
        asOf={thaiFullDate(new Date())}
      />

      {/* The mosaic leads: "what is blocked right now" is the question this
          page exists to answer at a glance, and it is the one thing here that
          reads as a shape before it reads as data. */}
      <PortBayPlan ports={ports} />

      <IndexBand series={series} usdThbRate={usdThbRate} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <DisruptionList items={news} />
        <div className="flex flex-col gap-4">
          <LiveShipMap />
          <WindyEmbed />
          <DecisionPrompt />
        </div>
      </div>
    </div>
  );
}

function seriesLabel(s: IndexSeries): string {
  return s.routeCode === "COMPOSITE"
    ? indexLabel(s.indexCode)
    : `${indexLabel(s.indexCode)} ${routeLabel(s.routeCode)}`;
}

/**
 * The one figure that goes in the title block.
 *
 * The WCI composite if we hold it — it is the number a forwarder quotes in
 * conversation — otherwise whatever reading we do have, so the block is
 * never empty while any data exists.
 */
function buildHeadline(series: IndexSeries[]): HeadlineFigure | null {
  const pick =
    series.find((s) => s.indexCode === "WCI" && s.routeCode === "COMPOSITE") ??
    series.find((s) => s.indexCode === "WCI") ??
    series[0];

  if (!pick?.metrics.latest) return null;

  const wow = pick.metrics.wowPct;
  const tone = pick.metrics.isStale
    ? "critical"
    : wow === null
      ? "neutral"
      : wow >= 5
        ? "critical"
        : wow > 0
          ? "warning"
          : wow <= -5
            ? "positive"
            : "neutral";

  return {
    label: seriesLabel(pick),
    value: formatIndexValue(pick.metrics.latest.value, pick.unit),
    unit: unitSuffix(pick.unit),
    deltaText: wow === null ? "ไม่มีสัปดาห์ก่อนให้เทียบ" : `${formatDelta(wow)} จากสัปดาห์ก่อน`,
    tone,
  };
}

/** An empty-ish corner is a place to point someone at the next useful action. */
function DecisionPrompt() {
  return (
    <section className="panel px-5 py-5">
      <h2 className="text-base">มีใบเสนอราคาอยู่ในมือ</h2>
      <p className="mt-2 max-w-[52ch] text-small leading-relaxed text-ink-soft">
        เทียบ 2 ถึง 5 สายเรือด้วย AHP แล้วได้คะแนน 0 ถึง 100 พร้อมเหตุผลที่พิมพ์ส่งลูกค้าได้
        ระบบจะเทียบราคาที่กรอกกับค่าระวางตลาดให้ด้วยว่าสูงหรือต่ำกว่าตลาด
      </p>
      <Link href="/decisions/new" className="btn mt-4 inline-block px-3.5 py-2 text-small">
        เริ่มเปรียบเทียบสายเรือ
      </Link>
    </section>
  );
}
