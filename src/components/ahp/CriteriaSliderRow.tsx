"use client";

import { CRITERION_LABELS, type CriterionKey } from "@/lib/ahp";

/**
 * One pairwise judgment, as a bidirectional slider.
 *
 * The slider runs -9 … 1 … 9, where a negative value means the right-hand
 * criterion wins and maps to its reciprocal. Two reasons for this over typing
 * a Saaty value: a fraction like 1/7 is awkward to enter and easy to invert by
 * mistake, and the control makes an out-of-scale judgment impossible to
 * express in the first place.
 */
export function CriteriaSliderRow({
  left,
  right,
  value,
  onChange,
  isFlagged,
}: {
  left: CriterionKey;
  right: CriterionKey;
  /** The Saaty ratio, e.g. 3 or 1/3. */
  value: number;
  onChange: (next: number) => void;
  isFlagged?: boolean;
}) {
  const slider = ratioToSlider(value);

  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,10rem)_1fr_minmax(0,10rem)]"
      style={isFlagged ? { background: "var(--color-warn-wash)" } : undefined}
    >
      <label
        htmlFor={`pair-${left}-${right}`}
        className="text-small leading-tight sm:text-right"
      >
        {CRITERION_LABELS[left].th}
      </label>

      <div className="col-span-3 sm:col-span-1">
        <input
          id={`pair-${left}-${right}`}
          type="range"
          min={-9}
          max={9}
          step={1}
          value={slider}
          onChange={(event) => onChange(sliderToRatio(Number(event.target.value)))}
          className="w-full accent-[var(--color-ink)]"
          aria-valuetext={judgmentText(left, right, value)}
        />
        <p className="mt-1 text-center text-micro text-ink-soft">
          {judgmentText(left, right, value)}
        </p>
      </div>

      <span className="text-small leading-tight">{CRITERION_LABELS[right].th}</span>
    </div>
  );
}

/** -9…-2 → 1/|v|, -1 and 1 → 1, 2…9 → v. */
export function sliderToRatio(slider: number): number {
  if (slider <= -2) return 1 / Math.abs(slider);
  if (slider >= 2) return slider;
  return 1;
}

export function ratioToSlider(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  if (ratio >= 1) return Math.round(ratio);
  return -Math.round(1 / ratio);
}

const INTENSITY_TH: Record<number, string> = {
  1: "สำคัญเท่ากัน",
  2: "สำคัญกว่าเล็กน้อย",
  3: "สำคัญกว่าพอสมควร",
  4: "สำคัญกว่าค่อนข้างมาก",
  5: "สำคัญกว่ามาก",
  6: "สำคัญกว่ามากทีเดียว",
  7: "สำคัญกว่าอย่างชัดเจน",
  8: "สำคัญกว่าเกือบที่สุด",
  9: "สำคัญกว่าที่สุด",
};

export function judgmentText(left: CriterionKey, right: CriterionKey, ratio: number): string {
  const slider = ratioToSlider(ratio);
  const magnitude = Math.min(9, Math.max(1, Math.abs(slider)));

  if (magnitude === 1) {
    return `${CRITERION_LABELS[left].th} กับ ${CRITERION_LABELS[right].th} สำคัญเท่ากัน`;
  }

  const winner = slider > 0 ? left : right;
  const loser = slider > 0 ? right : left;

  return `${CRITERION_LABELS[winner].th} ${INTENSITY_TH[magnitude]} (${magnitude}:1) เทียบกับ ${CRITERION_LABELS[loser].th}`;
}
