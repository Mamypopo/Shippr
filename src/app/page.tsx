import Link from "next/link";

import { IndexBand } from "@/components/market/IndexBand";
import { MarketSummary } from "@/components/market/MarketSummary";
import { DisruptionList } from "@/components/news/DisruptionList";
import { PortBayPlan } from "@/components/ports/PortBayPlan";
import { WindyEmbed } from "@/components/ports/WindyEmbed";
import { indexLabel, thaiFullDate } from "@/lib/format";
import {
  countRecentAlerts,
  getAllIndexSeries,
  getPortSnapshots,
  getRecentNews,
  getTopAlert,
} from "@/lib/queries";
import { buildMarketSummary } from "@/lib/summary";
import { routeLabel } from "@/lib/benchmark";

/** Ingested data changes under the page; never serve a cached snapshot. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [series, ports, news, alertCount7d, topAlert] = await Promise.all([
    getAllIndexSeries(),
    getPortSnapshots(),
    getRecentNews(20),
    countRecentAlerts(7),
    getTopAlert(7),
  ]);

  const summary = buildMarketSummary({
    indices: series.map((s) => ({
      indexCode: s.indexCode,
      label:
        s.routeCode === "COMPOSITE"
          ? indexLabel(s.indexCode)
          : `${indexLabel(s.indexCode)} ${routeLabel(s.routeCode)}`,
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
    <div className="mx-auto flex max-w-350 flex-col gap-4 px-4 py-5 sm:px-6">
      <MarketSummary bullets={summary} asOf={thaiFullDate(new Date())} />

      <IndexBand series={series} />

      <PortBayPlan ports={ports} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <DisruptionList items={news} />
        <div className="flex flex-col gap-4">
          <WindyEmbed />
          <DecisionPrompt />
        </div>
      </div>
    </div>
  );
}

/** An empty-ish corner is a place to point someone at the next useful action. */
function DecisionPrompt() {
  return (
    <section className="plan px-4 py-5">
      <h2 className="text-small font-medium">มีใบเสนอราคาอยู่ในมือ</h2>
      <p className="mt-2 max-w-[52ch] text-small leading-relaxed text-hull-soft">
        เทียบ 2–5 สายเรือด้วย AHP แล้วได้คะแนน 0–100 พร้อมเหตุผลที่พิมพ์ส่งลูกค้าได้
        ระบบจะเทียบราคาที่กรอกกับค่าระวางตลาดให้ด้วยว่าสูงหรือต่ำกว่าตลาด
      </p>
      <Link
        href="/decisions/new"
        className="mt-4 inline-block border border-rule-heavy bg-plan px-3 py-1.5 text-small hover:bg-plan-sunk"
      >
        เริ่มเปรียบเทียบสายเรือ
      </Link>
    </section>
  );
}
