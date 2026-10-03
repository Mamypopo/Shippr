import { Sparkline } from "./Sparkline";
import type { IndexSeries } from "@/lib/queries";
import {
  formatDelta,
  formatIndexValue,
  indexLabel,
  relativeDaysTh,
  SOURCE_LABELS,
  unitSuffix,
} from "@/lib/format";
import { routeLabel } from "@/lib/benchmark";

/**
 * The index readings as one band of slots on the sheet.
 *
 * Each cell carries a painted top edge in its status colour, so the band
 * reads as a strip of marks before any figure is read — the same logic as
 * the port mosaic, at a smaller scale.
 */
export function IndexBand({ series }: { series: IndexSeries[] }) {
  if (series.length === 0) {
    return (
      <section className="plan px-5 py-7">
        <p className="max-w-[60ch] text-small leading-relaxed text-hull-soft">
          ยังไม่มีข้อมูลค่าระวาง เริ่มได้สองทาง รัน job ดึงข้อมูล หรือกรอกตัวเลขสัปดาห์นี้เองที่หน้า{" "}
          <a href="/admin/indices" className="underline decoration-2 underline-offset-4">
            กรอกข้อมูล
          </a>
        </p>
      </section>
    );
  }

  return (
    <section
      className="plan grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
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
  const paint = deltaPaint(metrics.wowPct, metrics.isSpike);

  return (
    <article className="relative border-b-2 border-l-2 border-hull p-4 first:border-l-0 sm:nth-[2n+1]:border-l-0 xl:nth-[2n+1]:border-l-2 xl:nth-[4n+1]:border-l-0">
      {/* The mark: a painted edge that states the week's direction. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ background: paint }} />

      <div className="flex items-baseline justify-between gap-2 pt-1.5">
        <h3 className="text-small">
          {indexLabel(series.indexCode)}
          {series.routeCode !== "COMPOSITE" && (
            <span className="ml-1.5 font-sans text-micro font-normal text-hull-soft">
              {routeLabel(series.routeCode)}
            </span>
          )}
        </h3>
        <span className="addr">{series.routeCode}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="fig text-figure leading-none font-bold">
            {latest ? formatIndexValue(latest.value, unit) : "—"}
          </p>
          <p className="mt-1 text-micro text-hull-soft">{unitSuffix(unit)}</p>
        </div>
        <Sparkline values={series.points.map((p) => p.value)} />
      </div>

      <dl className="mt-3 flex gap-x-6 border-t-2 border-hull pt-2 text-small">
        <div className="flex items-baseline gap-2">
          <dt className="text-micro text-hull-soft">WoW</dt>
          <dd className="fig font-semibold" style={{ color: deltaInk(metrics.wowPct) }}>
            {formatDelta(metrics.wowPct)}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-micro text-hull-soft">MoM</dt>
          <dd className="fig font-semibold" style={{ color: deltaInk(metrics.momPct) }}>
            {formatDelta(metrics.momPct)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-micro text-hull-faint">
        {latest && <span>{relativeDaysTh(latest.periodDate)}</span>}
        <span>{SOURCE_LABELS[series.source] ?? series.source}</span>
      </p>

      {/* Two things a reader must not have to infer: that the number is old,
          and that it is unusual. Both get a painted strip, not fine print. */}
      {metrics.isStale && (
        <p
          className="mt-2.5 px-2 py-1 text-micro"
          style={{ background: "var(--color-hazard)", color: "var(--color-hazard-ink)" }}
        >
          ข้อมูลค้างเกินหนึ่งสัปดาห์ ตัวเลขนี้อาจไม่ใช่ราคาปัจจุบัน
        </p>
      )}
      {metrics.isSpike && !metrics.isStale && (
        <p
          className="mt-2.5 px-2 py-1 text-micro"
          style={{ background: "var(--color-watch)", color: "var(--color-watch-ink)" }}
        >
          ห่างจากค่าเฉลี่ย 8 สัปดาห์ {metrics.deviationFromMaPct?.toFixed(1)}% ลู่นี้ผันผวน
        </p>
      )}
    </article>
  );
}

/**
 * Rising freight costs the forwarder money, so up is the warning direction
 * here — the opposite of a stock ticker, and worth stating in code because
 * the next person will assume otherwise.
 */
function deltaPaint(pct: number | null, isSpike: boolean): string {
  if (isSpike) return "var(--color-hazard)";
  if (pct === null) return "var(--color-rule)";
  if (pct >= 5) return "var(--color-hazard)";
  if (pct > 0) return "var(--color-watch)";
  if (pct <= -5) return "var(--color-clear)";
  return "var(--color-hull)";
}

function deltaInk(pct: number | null): string {
  if (pct === null) return "var(--color-hull-faint)";
  if (pct >= 5) return "var(--color-hazard)";
  if (pct > 0) return "var(--color-watch)";
  if (pct <= -5) return "var(--color-clear)";
  return "var(--color-hull)";
}
