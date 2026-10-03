"use client";

import { CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";
import type { BenchmarkResult } from "@/lib/benchmark";
import { BENCHMARK_VERDICT_LABELS } from "@/lib/benchmark";
import { formatUsd } from "@/lib/format";

const VERDICT_INK: Record<string, string> = {
  BELOW_MARKET: "var(--color-clear)",
  AT_MARKET: "var(--color-hull-soft)",
  ABOVE_MARKET: "var(--color-hazard)",
};

/**
 * The ranking, as filled bars on the plan grid.
 *
 * Rows carry `rank-row` so they slide to their new position when a weight
 * changes — the one piece of motion on the site, and the only place it earns
 * its keep: it shows the user what their adjustment did.
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
      <section className="plan px-4 py-6">
        <p className="text-small text-hull-soft">
          กรอกใบเสนอราคาอย่างน้อยสองสายเรือ แล้วอันดับจะคำนวณให้ทันที
        </p>
      </section>
    );
  }

  return (
    <section className="plan" aria-label="อันดับสายเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-hull px-4 py-2.5">
        <h3 className="text-base">อันดับสายเรือ</h3>
        <span className="addr">คะแนน 0–100 เทียบกับอันดับหนึ่ง</span>
      </div>

      {!isConsistent && (
        <p className="border-b-2 border-hull px-4 py-2.5 text-micro text-hazard">
          อันดับนี้คำนวณจากน้ำหนักที่ยังขัดแย้งกันเอง (CR เกิน 0.1) —
          ปรับความสอดคล้องก่อนนำไปใช้อ้างอิง
        </p>
      )}

      <ol>
        {ranking.map((entry) => {
          const benchmark = benchmarks?.[entry.id];

          return (
            <li
              key={entry.id}
              className="rank-row border-t border-rule px-4 py-3 first:border-t-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-base font-medium">
                  <span className="fig mr-2 text-hull-faint">{entry.rank}</span>
                  {entry.label}
                </h4>
                <span className="fig text-figure-sm leading-none font-medium">
                  {entry.score100.toFixed(1)}
                </span>
              </div>

              <div
                className="mt-2 h-2 w-full"
                style={{ background: "var(--color-plan-sunk)" }}
                role="img"
                aria-label={`คะแนน ${entry.score100.toFixed(1)} จาก 100`}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(1, entry.score100)}%`,
                    background:
                      entry.rank === 1 ? "var(--color-clear)" : "var(--color-hull-faint)",
                  }}
                />
              </div>

              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-micro text-hull-faint">
                {(Object.keys(entry.localScores) as CriterionKey[]).map((key) => (
                  <div key={key} className="flex gap-1">
                    <dt>{CRITERION_LABELS[key].th}</dt>
                    <dd className="fig text-hull-soft">
                      {(entry.localScores[key] * 100).toFixed(0)}
                    </dd>
                  </div>
                ))}
              </dl>

              {benchmark && (
                <p className="mt-2 text-micro" style={{ color: VERDICT_INK[benchmark.verdict] }}>
                  {BENCHMARK_VERDICT_LABELS[benchmark.verdict].th} {formatUsd(Math.abs(benchmark.deltaUsd))}{" "}
                  ({benchmark.deltaPct > 0 ? "+" : ""}
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
