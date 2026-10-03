"use client";

import { useMemo } from "react";

import {
  CRITERIA,
  CRITERION_LABELS,
  pairKey,
  type AHPResult,
  type CriterionKey,
  type PairwiseInput,
} from "@/lib/ahp";
import { CARGO_PRESETS, PRESET_LIST, type PresetKey } from "@/lib/ahp-presets";
import { CriteriaSliderRow } from "./CriteriaSliderRow";

/**
 * The pairwise comparison form, and the matrix it produces.
 *
 * Ten sliders for the upper triangle; the lower half is rendered read-only as
 * reciprocals so the user can see the whole matrix the engine is working on
 * rather than trusting that it exists.
 */
export function PairwiseMatrix({
  pairwise,
  result,
  presetKey,
  onChangePair,
  onApplyPreset,
}: {
  pairwise: PairwiseInput;
  result: AHPResult<CriterionKey>;
  presetKey: PresetKey | "CUSTOM";
  onChangePair: (left: CriterionKey, right: CriterionKey, value: number) => void;
  onApplyPreset: (key: PresetKey) => void;
}) {
  const pairs = useMemo(() => {
    const out: Array<[CriterionKey, CriterionKey]> = [];
    for (let i = 0; i < CRITERIA.length; i++) {
      for (let j = i + 1; j < CRITERIA.length; j++) out.push([CRITERIA[i], CRITERIA[j]]);
    }
    return out;
  }, []);

  const flagged = new Set(result.inconsistencies.map((h) => `${h.rowKey}:${h.colKey}`));

  return (
    <div className="flex flex-col gap-4">
      <section className="plan" aria-label="เลือกรูปแบบสินค้า">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
          <h3 className="text-small font-medium">รูปแบบสินค้า</h3>
          <span className="slot-address">
            {presetKey === "CUSTOM" ? "ปรับเอง" : CARGO_PRESETS[presetKey].key}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {PRESET_LIST.map((preset) => {
            const active = presetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onApplyPreset(preset.key)}
                aria-pressed={active}
                className="border-t border-rule p-3 text-left first:border-t-0 sm:border-l sm:[&:nth-child(2n+1)]:border-l-0 xl:border-l xl:[&:nth-child(2n+1)]:border-l xl:[&:first-child]:border-l-0"
                style={
                  active
                    ? { background: "var(--color-hull)", color: "var(--color-plan)" }
                    : undefined
                }
              >
                <span className="block text-small font-medium">{preset.label.th}</span>
                <span
                  className="mt-1 block text-micro leading-snug"
                  style={{ color: active ? "var(--color-plan-sunk)" : "var(--color-hull-faint)" }}
                >
                  {preset.description.th}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="plan" aria-label="เปรียบเทียบความสำคัญของเกณฑ์">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2">
          <h3 className="text-small font-medium">เทียบความสำคัญทีละคู่</h3>
          <span className="slot-address">Saaty 1–9 · {pairs.length} คู่</span>
        </div>

        {pairs.map(([left, right]) => (
          <CriteriaSliderRow
            key={pairKey(left, right)}
            left={left}
            right={right}
            value={pairwise[pairKey(left, right)] ?? 1}
            onChange={(next) => onChangePair(left, right, next)}
            isFlagged={flagged.has(pairKey(left, right))}
          />
        ))}
      </section>

      <WeightsTable result={result} />
      <MatrixTable result={result} />
    </div>
  );
}

function WeightsTable({ result }: { result: AHPResult<CriterionKey> }) {
  const ordered = [...CRITERIA].sort((a, b) => result.weights[b] - result.weights[a]);

  return (
    <section className="plan" aria-label="น้ำหนักของแต่ละเกณฑ์">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h3 className="text-small font-medium">น้ำหนักที่ได้</h3>
        <span className="slot-address">priority vector</span>
      </div>

      <ul>
        {ordered.map((key) => {
          const weight = result.weights[key];
          return (
            <li
              key={key}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-t border-rule px-4 py-2 first:border-t-0"
            >
              <div>
                <p className="text-small">{CRITERION_LABELS[key].th}</p>
                <div
                  className="mt-1 h-1.5 w-full"
                  style={{ background: "var(--color-plan-sunk)" }}
                >
                  <div
                    className="h-full"
                    style={{ width: `${weight * 100}%`, background: "var(--color-hull)" }}
                  />
                </div>
              </div>
              <span className="tnum text-base">{(weight * 100).toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The full reciprocal matrix. Showing the lower half greyed is not
 * decoration: it is how the user confirms that saying "A beats B by 3" also
 * said "B loses to A by 1/3", which is the assumption the whole method rests on.
 */
function MatrixTable({ result }: { result: AHPResult<CriterionKey> }) {
  return (
    <section className="plan overflow-x-auto" aria-label="เมทริกซ์เปรียบเทียบ">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h3 className="text-small font-medium">เมทริกซ์เปรียบเทียบ</h3>
        <span className="slot-address">ครึ่งล่างคือส่วนกลับ</span>
      </div>

      <table className="w-full border-collapse text-small">
        <thead>
          <tr>
            <th className="border-b border-r border-rule px-2 py-1 text-left text-micro font-normal text-hull-faint">
              เกณฑ์
            </th>
            {CRITERIA.map((key) => (
              <th
                key={key}
                scope="col"
                className="border-b border-l border-rule px-2 py-1 text-right text-micro font-normal text-hull-faint"
              >
                {CRITERION_LABELS[key].th}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((rowKey, i) => (
            <tr key={rowKey}>
              <th
                scope="row"
                className="border-r border-t border-rule px-2 py-1 text-left text-micro font-normal text-hull-soft"
              >
                {CRITERION_LABELS[rowKey].th}
              </th>
              {CRITERIA.map((colKey, j) => {
                const value = result.matrix[i][j];
                const isLower = j < i;
                return (
                  <td
                    key={colKey}
                    className="tnum border-l border-t border-rule px-2 py-1 text-right"
                    style={{
                      color: isLower ? "var(--color-hull-faint)" : "var(--color-hull)",
                      background: i === j ? "var(--color-plan-sunk)" : undefined,
                    }}
                  >
                    {formatCell(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatCell(value: number): string {
  if (Math.abs(value - 1) < 1e-9) return "1";
  if (value > 1) return value.toFixed(0);
  return `1/${(1 / value).toFixed(0)}`;
}
