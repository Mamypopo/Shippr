import type { SummaryBullet, SummaryTone } from "@/lib/summary";

const TONE_PAINT: Record<SummaryTone, string> = {
  neutral: "var(--color-plan)",
  positive: "var(--color-clear)",
  warning: "var(--color-watch)",
  critical: "var(--color-hazard)",
};

export interface HeadlineFigure {
  label: string;
  value: string;
  unit: string;
  deltaText: string;
  tone: SummaryTone;
}

/**
 * The title block of the sheet.
 *
 * Painted ink so the page opens on something with weight, and because a
 * drawn plan carries its title block as a solid field rather than as a card.
 * The headline figure and the written read sit together: the number alone
 * does not say whether it matters.
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
    <section className="plan-ink" aria-label="สรุปตลาด">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {headline && (
          <div className="border-b-2 border-plan/25 p-5 lg:border-r-2 lg:border-b-0">
            <p className="text-small text-plan/70">{headline.label}</p>
            <p className="fig mt-2 text-display leading-[0.92] font-bold">{headline.value}</p>
            <p className="mt-1 text-small text-plan/70">{headline.unit}</p>
            <p
              className="fig mt-4 inline-block px-2.5 py-1 text-base font-semibold"
              style={{
                background: TONE_PAINT[headline.tone],
                color:
                  headline.tone === "neutral" ? "var(--color-hull)" : "var(--color-plan)",
              }}
            >
              {headline.deltaText}
            </p>
          </div>
        )}

        <div className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-base">สรุปตลาดสำหรับผู้บริหาร</h2>
            <span className="addr">{asOf}</span>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {bullets.map((bullet) => (
              <li key={bullet.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-2 h-2.5 w-4 shrink-0"
                  style={{ background: TONE_PAINT[bullet.tone] }}
                />
                <p className="max-w-[72ch] text-small leading-relaxed text-plan/90">
                  {bullet.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
