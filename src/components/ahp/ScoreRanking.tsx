"use client";

import { CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";
import type { BenchmarkResult } from "@/lib/benchmark";
import { BENCHMARK_VERDICT_LABELS } from "@/lib/benchmark";
import { formatUsd } from "@/lib/format";

const VERDICT_INK: Record<string, string> = {
  BELOW_MARKET: "var(--color-ok)",
  AT_MARKET: "var(--color-ink-faint)",
  ABOVE_MARKET: "var(--color-bad)",
};

/**
 * The weighted ranking.
 *
 * One measure, so one hue: a sequential blue with the leader at the darkest
 * step and the rest a step back. Identity comes from the carrier's name on
 * the row, so the bars do not have to carry it as well.
 *
 * Rows carry `rank-row` and slide to their new position when a weight
 * changes — the one piece of motion on the site, and the only place it earns
 * its keep, because it shows the user what their adjustment did.
 */
export function ScoreRanking({
  ranking,
  benchmarks,
  isConsistent,
}: {
  ranking: RankedAlternative<CriterionKey>[];
  benchmarks?: Record<string, BenchmarkResult | null>;
  isConsistent: boolean;
}) {
  if (ranking.length === 0) {
    return (
      <section className="panel px-5 py-7">
        <p className="text-small text-ink-soft">
          กรอกใบเสนอราคาอย่างน้อยสองสายเรือ แล้วอันดับจะคำนวณให้ทันที
        </p>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="อันดับสายเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <h3 className="text-small font-medium">อันดับสายเรือ</h3>
        <span className="label">คะแนน 0–100</span>
      </div>

      {!isConsistent && (
        <p
          className="border-b border-line px-5 py-2.5 text-micro leading-snug"
          style={{ color: "var(--color-bad)" }}
        >
          อันดับนี้คำนวณจากน้ำหนักที่ยังขัดแย้งกันเอง ปรับความสอดคล้องก่อนนำไปใช้อ้างอิง
        </p>
      )}

      <ol className="divide-line">
        {ranking.map((entry) => {
          const benchmark = benchmarks?.[entry.id];
          const isLeader = entry.rank === 1;

          return (
            <li key={entry.id} className="rank-row px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-body font-medium">
                  <span className="fig mr-2.5 text-ink-faint">{entry.rank}</span>
                  {entry.label}
                </h4>
                <span className="fig text-figure-sm leading-none font-semibold">
                  {entry.score100.toFixed(1)}
                </span>
              </div>

              <div
                className="mt-2.5 h-2.5 w-full bg-surface-sunk"
                role="img"
                aria-label={`คะแนน ${entry.score100.toFixed(1)} จาก 100`}
              >
                <div
                  className="h-full rounded-r-sm"
                  style={{
                    width: `${Math.max(1.5, entry.score100)}%`,
                    background: isLeader ? "var(--color-seq-600)" : "var(--color-seq-350)",
                  }}
                />
              </div>

              {/* The per-criterion figures double as the table view that the
                  contrast relief rule asks for — nothing is gated on colour. */}
              <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-micro text-ink-faint">
                {(Object.keys(entry.localScores) as CriterionKey[]).map((key) => (
                  <div key={key} className="flex gap-1.5">
                    <dt>{CRITERION_LABELS[key].th}</dt>
                    <dd className="fig text-ink-soft">
                      {(entry.localScores[key] * 100).toFixed(0)}
                    </dd>
                  </div>
                ))}
              </dl>

              {benchmark && (
                <p className="mt-2 text-micro" style={{ color: VERDICT_INK[benchmark.verdict] }}>
                  {BENCHMARK_VERDICT_LABELS[benchmark.verdict].th}{" "}
                  {formatUsd(Math.abs(benchmark.deltaUsd))} ({benchmark.deltaPct > 0 ? "+" : ""}
                  {benchmark.deltaPct.toFixed(1)}%) เทียบค่าระวางตลาด{" "}
                  {formatUsd(benchmark.marketUsd)}/FEU
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
