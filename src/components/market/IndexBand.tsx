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

export function IndexBand({ series }: { series: IndexSeries[] }) {
  if (series.length === 0) {
    return (
      <section aria-label="ดัชนีค่าระวาง">
        <h2 className="text-lead">ดัชนีค่าระวางและ sentiment</h2>
        <div className="panel mt-4 px-6 py-10">
          <p className="max-w-[60ch] text-small leading-relaxed text-ink-soft">
            ยังไม่มีข้อมูลค่าระวาง เริ่มได้สองทาง รัน job ดึงข้อมูล
            หรือกรอกตัวเลขสัปดาห์นี้เองที่หน้า{" "}
            <a href="/admin/indices" className="text-ink underline underline-offset-4">
              กรอกข้อมูล
            </a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="ดัชนีค่าระวางและ sentiment">
      <h2 className="text-lead">ดัชนีค่าระวางและ sentiment</h2>

      <div className="panel mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {series.map((item) => (
          <IndexCell key={`${item.indexCode}-${item.routeCode}`} series={item} />
        ))}
      </div>
    </section>
  );
}

function IndexCell({ series }: { series: IndexSeries }) {
  const { metrics, unit } = series;
  const latest = metrics.latest;

  return (
    <article className="border-line p-5 not-nth-[2n+1]:border-l sm:nth-[n+3]:border-t xl:not-nth-[4n+1]:border-l xl:nth-[n+3]:border-t-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-small font-medium">
          {indexLabel(series.indexCode)}
          {series.routeCode !== "COMPOSITE" && (
            <span className="ml-1.5 font-normal text-ink-faint">
              {routeLabel(series.routeCode)}
            </span>
          )}
        </h3>
        <span className="label">{series.routeCode}</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="fig text-figure leading-none font-semibold">
          {latest ? formatIndexValue(latest.value, unit) : "—"}
        </p>
        <Sparkline values={series.points.map((p) => p.value)} />
      </div>

      <p className="mt-1.5 text-micro text-ink-faint">{unitSuffix(unit)}</p>

      <dl className="mt-4 flex gap-x-7 border-t border-line pt-3 text-small">
        <div className="flex items-baseline gap-2">
          <dt className="label">WoW</dt>
          <dd className="fig font-medium" style={{ color: deltaInk(metrics.wowPct) }}>
            {formatDelta(metrics.wowPct)}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="label">MoM</dt>
          <dd className="fig font-medium" style={{ color: deltaInk(metrics.momPct) }}>
            {formatDelta(metrics.momPct)}
          </dd>
        </div>
      </dl>

      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2 text-micro text-ink-faint">
        {latest && <span>{relativeDaysTh(latest.periodDate)}</span>}
        <span>{SOURCE_LABELS[series.source] ?? series.source}</span>
      </p>

      {/* Two things a reader must not have to infer: that the number is old,
          and that it is unusual. */}
      {metrics.isStale && (
        <p
          className="mt-3 border-l-2 py-0.5 pl-2.5 text-micro leading-snug"
          style={{ borderColor: "var(--color-bad)", color: "var(--color-bad)" }}
        >
          ข้อมูลค้างเกินหนึ่งสัปดาห์ ตัวเลขนี้อาจไม่ใช่ราคาปัจจุบัน
        </p>
      )}
      {metrics.isSpike && !metrics.isStale && (
        <p
          className="mt-3 border-l-2 py-0.5 pl-2.5 text-micro leading-snug"
          style={{ borderColor: "var(--color-warn)", color: "var(--color-warn)" }}
        >
          ห่างจากค่าเฉลี่ย 8 สัปดาห์ {metrics.deviationFromMaPct?.toFixed(1)}% ลู่นี้ผันผวน
        </p>
      )}
    </article>
  );
}

/**
 * Rising freight costs the forwarder money, so up is the warning direction
 * here — the opposite of a stock ticker, and worth saying in code because
 * the next person will assume otherwise.
 */
function deltaInk(pct: number | null): string {
  if (pct === null) return "var(--color-ink-faint)";
  if (pct >= 5) return "var(--color-bad)";
  if (pct > 0) return "var(--color-warn)";
  if (pct <= -5) return "var(--color-ok)";
  return "var(--color-ink)";
}
