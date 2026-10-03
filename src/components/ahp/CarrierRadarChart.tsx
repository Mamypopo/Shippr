"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { CRITERIA, CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";

/**
 * Per-criterion profile of each carrier.
 *
 * Deliberately plots the *local* scores rather than the weighted ones: the
 * bar ranking already answers "who wins", and this answers the different
 * question of where each carrier is actually strong, independently of how
 * the user happens to have weighted the criteria today.
 */

/** Carriers are distinguished by line style, not hue — colour means risk here. */
const SERIES_STYLE = [
  { dash: undefined, width: 2 },
  { dash: "5 3", width: 1.5 },
  { dash: "2 2", width: 1.5 },
  { dash: "8 3 2 3", width: 1.5 },
  { dash: "1 3", width: 1.5 },
];

export function CarrierRadarChart({
  ranking,
}: {
  ranking: RankedAlternative<CriterionKey>[];
}) {
  if (ranking.length === 0) return null;

  const data = CRITERIA.map((key) => {
    const row: Record<string, string | number> = { criterion: CRITERION_LABELS[key].th };
    for (const entry of ranking) {
      row[entry.label] = Number((entry.localScores[key] * 100).toFixed(1));
    }
    return row;
  });

  return (
    <section className="plan" aria-label="จุดแข็งรายเกณฑ์ของแต่ละสายเรือ">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h3 className="text-small font-medium">จุดแข็งรายเกณฑ์</h3>
        <span className="slot-address">ยังไม่ถ่วงน้ำหนัก</span>
      </div>

      <div className="h-[22rem] px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--color-rule)" />
            <PolarAngleAxis
              dataKey="criterion"
              tick={{ fill: "var(--color-hull-soft)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "var(--color-hull-faint)", fontSize: 10 }}
              stroke="var(--color-rule)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-plan)",
                border: "1px solid var(--color-rule-heavy)",
                borderRadius: 0,
                fontSize: 13,
              }}
            />
            {ranking.map((entry, i) => {
              const style = SERIES_STYLE[i % SERIES_STYLE.length];
              return (
                <Radar
                  key={entry.id}
                  name={entry.label}
                  dataKey={entry.label}
                  stroke="var(--color-hull)"
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  fill="var(--color-hull)"
                  fillOpacity={i === 0 ? 0.1 : 0.03}
                />
              );
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 border-t border-rule px-4 py-2 text-micro">
        {ranking.map((entry, i) => {
          const style = SERIES_STYLE[i % SERIES_STYLE.length];
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <svg width={22} height={6} aria-hidden="true">
                <line
                  x1={0}
                  y1={3}
                  x2={22}
                  y2={3}
                  stroke="var(--color-hull)"
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                />
              </svg>
              {entry.label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
