"use client";

import { CRITERION_LABELS, CR_THRESHOLD, type AHPResult, type CriterionKey } from "@/lib/ahp";

/**
 * Consistency readout.
 *
 * A bare "CR = 0.18, your judgments are inconsistent" tells the user they are
 * wrong without telling them where. This names the cells that fight the
 * derived weights and the ratio those weights imply, so the next move is
 * obvious.
 */
export function ConsistencyBadge({
  result,
  onApplySuggestion,
}: {
  result: AHPResult<CriterionKey>;
  onApplySuggestion?: (left: CriterionKey, right: CriterionKey, value: number) => void;
}) {
  const { consistencyRatio, isConsistent, lambdaMax, consistencyIndex, inconsistencies } = result;

  const ink = isConsistent ? "var(--color-ok)" : "var(--color-bad)";

  return (
    <section
      className="panel"
      aria-live="polite"
      style={{ borderColor: ink }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink px-4 py-2.5">
        <h3 className="text-base">ความสอดคล้องของการให้น้ำหนัก</h3>
        <span className="label">CR &lt; {CR_THRESHOLD.toFixed(2)} ถือว่าใช้ได้</span>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-3">
        <div>
          <p className="fig text-figure leading-none font-medium" style={{ color: ink }}>
            {consistencyRatio.toFixed(3)}
          </p>
          <p className="mt-1 text-micro text-ink-faint">Consistency Ratio</p>
        </div>

        <dl className="flex gap-x-6 text-small">
          <div>
            <dt className="text-micro text-ink-faint">λmax</dt>
            <dd className="fig">{lambdaMax.toFixed(4)}</dd>
          </div>
          <div>
            <dt className="text-micro text-ink-faint">CI</dt>
            <dd className="fig">{consistencyIndex.toFixed(4)}</dd>
          </div>
        </dl>

        <p className="text-small" style={{ color: ink }}>
          {isConsistent
            ? "การให้น้ำหนักสอดคล้องกัน ใช้ผลลัพธ์นี้ได้"
            : "การให้น้ำหนักขัดแย้งกันเองมากเกินไป ปรับตามด้านล่างก่อน"}
        </p>
      </div>

      {!isConsistent && inconsistencies.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-small text-ink-soft">
            ช่องที่ขัดแย้งกับคำตอบอื่นมากที่สุด
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {inconsistencies.map((hint) => (
              <li key={`${hint.rowKey}-${hint.colKey}`} className="text-small leading-relaxed">
                คุณให้{" "}
                <strong className="font-medium">
                  {CRITERION_LABELS[hint.rowKey as CriterionKey].th}
                </strong>{" "}
                สำคัญกว่า{" "}
                <strong className="font-medium">
                  {CRITERION_LABELS[hint.colKey as CriterionKey].th}
                </strong>{" "}
                <span className="fig">{formatRatio(hint.entered)}</span> เท่า
                แต่คำตอบอื่นของคุณสื่อว่าควรเป็นราว{" "}
                <span className="fig">{formatRatio(hint.suggested)}</span> เท่า
                {onApplySuggestion && (
                  <button
                    type="button"
                    onClick={() =>
                      onApplySuggestion(
                        hint.rowKey as CriterionKey,
                        hint.colKey as CriterionKey,
                        hint.suggested,
                      )
                    }
                    className="ml-2 btn px-2 py-0.5 text-micro"
                  >
                    ปรับให้
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <ul className="border-t border-line px-4 py-2 text-micro text-warn">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ratios below 1 read better as fractions than as 0.33. */
function formatRatio(value: number): string {
  if (value >= 1) return value.toFixed(value >= 10 ? 0 : 1);
  return `1/${(1 / value).toFixed(1)}`;
}
