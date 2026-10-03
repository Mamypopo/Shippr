"use client";

import { CRITERIA, CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";

/**
 * Carrier strengths, criterion by criterion.
 *
 * This replaced an overlaid radar. Two reasons, in order of weight:
 *
 * 1. Five overlapping series cannot be told apart safely. Validating the
 *    palette against this surface, five slots clear the adjacent-pair gate
 *    that grouped bars are judged on, but only three clear the all-pairs gate
 *    an overlay needs. Grouped bars let all five carriers keep a distinct
 *    colour; a radar would have forced a cap at three.
 * 2. A radar asks the reader to compare polygon areas, which is the hardest
 *    comparison there is, and its shape changes with the arbitrary order of
 *    the axes. Length against a shared baseline is read accurately.
 *
 * Plotted before weighting, deliberately: the ranking already answers "who
 * wins under my priorities". This answers the separate question of where each
 * carrier is actually strong.
 */

/** Slot by entry order, never by rank — re-sorting must not repaint a series. */
const SERIES = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
];

export function CarrierCriterionChart({
  ranking,
  /** Carrier ids in quote-entry order, so colour is stable across re-ranking. */
  seriesOrder,
}: {
  ranking: RankedAlternative<CriterionKey>[];
  seriesOrder: string[];
}) {
  if (ranking.length === 0) return null;

  const colorFor = (id: string) => {
    const index = seriesOrder.indexOf(id);
    return SERIES[(index === -1 ? 0 : index) % SERIES.length];
  };

  // Keep the bar order stable inside every group, for the same reason.
  const ordered = seriesOrder
    .map((id) => ranking.find((r) => r.id === id))
    .filter((r): r is RankedAlternative<CriterionKey> => Boolean(r));

  return (
    <section className="panel" aria-label="จุดแข็งรายเกณฑ์ของแต่ละสายเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
        <h3 className="text-small font-medium">จุดแข็งรายเกณฑ์</h3>
        <span className="label">ก่อนถ่วงน้ำหนัก · 0–100</span>
      </div>

      {/* The legend is the dependable identity channel; the bar labels
          supplement it rather than replace it. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-b border-line px-5 py-2.5">
        {ordered.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-micro text-ink-soft">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-xs"
              style={{ background: colorFor(entry.id) }}
            />
            {entry.label}
          </li>
        ))}
      </ul>

      <div className="divide-line flex flex-col px-5 py-1">
        {CRITERIA.map((criterion) => {
          const best = Math.max(...ordered.map((e) => e.localScores[criterion] ?? 0));

          return (
            <div key={criterion} className="py-3.5">
              <p className="text-micro text-ink-soft">{CRITERION_LABELS[criterion].th}</p>

              <div className="mt-2 flex flex-col gap-0.5">
                {ordered.map((entry) => {
                  const score = (entry.localScores[criterion] ?? 0) * 100;
                  const isBest = (entry.localScores[criterion] ?? 0) >= best - 1e-9;

                  return (
                    <div
                      key={entry.id}
                      className="group grid grid-cols-[1fr_2.5rem] items-center gap-3"
                      title={`${entry.label} — ${CRITERION_LABELS[criterion].th} ${score.toFixed(0)}`}
                    >
                      {/* Track, then mark. Bar capped at 10px with a 4px
                          rounded data-end and a square start at the baseline. */}
                      <div className="h-2.5 w-full bg-surface-sunk">
                        <div
                          className="h-full rounded-r-sm transition-[width] duration-200"
                          style={{
                            width: `${Math.max(1.5, score)}%`,
                            background: colorFor(entry.id),
                            opacity: isBest ? 1 : 0.72,
                          }}
                        />
                      </div>
                      <span className="fig text-right text-micro text-ink-soft">
                        {score.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
