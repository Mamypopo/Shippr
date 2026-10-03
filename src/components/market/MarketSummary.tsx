import type { SummaryBullet, SummaryTone } from "@/lib/summary";

const TONE_DOT: Record<SummaryTone, string> = {
  neutral: "var(--color-ink-faint)",
  positive: "var(--color-ok)",
  warning: "var(--color-warn)",
  critical: "var(--color-bad)",
};

export interface HeadlineFigure {
  label: string;
  value: string;
  unit: string;
  deltaText: string;
  tone: SummaryTone;
}

/**
 * The page opens on the headline figure and the written read, side by side.
 *
 * The number alone does not say whether it matters, and the sentences alone
 * bury the one figure everyone is here for.
 */
export function MarketSummary({
  bullets,
  headline,
  asOf,
}: {
  bullets: SummaryBullet[];
  headline: HeadlineFigure | null;
  asOf: string;
}) {
  return (
    <section aria-label="สรุปตลาด">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-title">ภาพรวมตลาด</h1>
        <span className="label">{asOf}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,19rem)_1fr]">
        {headline && (
          <div>
            <p className="label">{headline.label}</p>
            <p className="fig mt-2 text-display leading-none font-semibold">{headline.value}</p>
            <p className="mt-2 flex items-baseline gap-2.5 text-small">
              <span className="text-ink-faint">{headline.unit}</span>
              <span className="fig font-medium" style={{ color: TONE_DOT[headline.tone] }}>
                {headline.deltaText}
              </span>
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-3 lg:border-l lg:border-line lg:pl-12">
          {bullets.map((bullet) => (
            <li key={bullet.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: TONE_DOT[bullet.tone] }}
              />
              <p className="max-w-[74ch] text-body leading-relaxed text-ink-soft">{bullet.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
