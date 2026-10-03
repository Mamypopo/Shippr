import { Sparkline } from "./Sparkline";
import type { IndexSeries } from "@/lib/queries";
import {
  formatDelta,
  formatIndexValue,
  indexLabel,
  relativeDaysTh,
  SOURCE_LABELS,
  thaiShortDate,
  unitSuffix,
} from "@/lib/format";
import { routeLabel } from "@/lib/benchmark";

/**
 * The index readings as one band of cells, divided by hairlines — a row of
 * slots on the plan rather than a set of floating cards.
 */
export function IndexBand({ series }: { series: IndexSeries[] }) {
  if (series.length === 0) {
    return (
      <section className="plan px-4 py-6">
        <p className="text-small text-hull-soft">
          ยังไม่มีข้อมูลค่าระวาง เริ่มได้สองทาง — รัน job ดึงข้อมูล
          หรือกรอกตัวเลขสัปดาห์นี้เองที่หน้า{" "}
          <a href="/admin/indices" className="underline underline-offset-4">
            กรอกข้อมูล
          </a>
        </p>
      </section>
    );
  }

  return (
    <section
      className="plan grid grid-cols-1 plan-divide-y sm:grid-cols-2 sm:plan-divide-y-0 xl:grid-cols-4"
      aria-label="ดัชนีค่าระวางและ sentiment"
    >
      {series.map((item) => (
        <IndexCell key={`${item.indexCode}-${item.routeCode}`} series={item} />
      ))}
    </section>
  );
}

function IndexCell({ series }: { series: IndexSeries }) {
  const { metrics, unit } = series;
  const latest = metrics.latest;

  const tone = metrics.isSpike ? "hazard" : metrics.wowPct && metrics.wowPct > 0 ? "watch" : "ink";

  return (
    <article className="relative border-t border-rule px-4 py-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 xl:border-l xl:first:border-l-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-small font-medium">
          {indexLabel(series.indexCode)}
          {series.routeCode !== "COMPOSITE" && (
            <span className="ml-2 text-micro font-normal text-hull-faint">
              {routeLabel(series.routeCode)}
            </span>
          )}
        </h3>
        <span className="slot-address">{series.routeCode}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="tnum text-figure leading-none font-medium">
            {latest ? formatIndexValue(latest.value, unit) : "—"}
          </p>
          <p className="mt-1 text-micro text-hull-faint">{unitSuffix(unit)}</p>
        </div>
        <Sparkline values={series.points.map((p) => p.value)} tone={tone} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-small">
        <div className="flex justify-between gap-2">
          <dt className="text-hull-faint">WoW</dt>
          <dd className="tnum" style={{ color: deltaColor(metrics.wowPct) }}>
            {formatDelta(metrics.wowPct)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-hull-faint">MoM</dt>
          <dd className="tnum" style={{ color: deltaColor(metrics.momPct) }}>
            {formatDelta(metrics.momPct)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-micro text-hull-faint">
        {latest && <span className="tnum">{thaiShortDate(latest.periodDate)}</span>}
        {latest && <span>{relativeDaysTh(latest.periodDate)}</span>}
        <span>{SOURCE_LABELS[series.source] ?? series.source}</span>
      </p>

      {/* Two things a reader must not have to infer: that the number is old,
          and that it is unusual. */}
      {metrics.isStale && (
        <p className="mt-2 text-micro text-hazard">
          ข้อมูลค้างเกินหนึ่งสัปดาห์ — ตัวเลขนี้อาจไม่ใช่ราคาปัจจุบัน
        </p>
      )}
      {metrics.isSpike && !metrics.isStale && (
        <p className="mt-2 text-micro text-watch">
          ห่างจากค่าเฉลี่ย 8 สัปดาห์ {metrics.deviationFromMaPct?.toFixed(1)}% — ลู่นี้ผันผวน
        </p>
      )}
    </article>
  );
}

function deltaColor(pct: number | null): string {
  if (pct === null) return "var(--color-hull-faint)";
  // Rising freight rates cost the forwarder money, so up is the warning
  // direction here — the opposite of a stock ticker.
  if (pct >= 5) return "var(--color-hazard)";
  if (pct > 0) return "var(--color-watch)";
  if (pct <= -5) return "var(--color-clear)";
  return "var(--color-hull)";
}
