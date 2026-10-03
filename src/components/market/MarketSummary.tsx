import type { SummaryBullet, SummaryTone } from "@/lib/summary";

const TONE_RULE: Record<SummaryTone, string> = {
  neutral: "var(--color-rule-heavy)",
  positive: "var(--color-clear)",
  warning: "var(--color-watch)",
  critical: "var(--color-hazard)",
};

/**
 * The executive read, as ruled rows rather than bullets.
 *
 * Each row carries a left edge in its status colour, so the shape of the week
 * is legible before any of it is read.
 */
export function MarketSummary({
  bullets,
  asOf,
}: {
  bullets: SummaryBullet[];
  asOf: string;
}) {
  return (
    <section className="plan" aria-label="สรุปตลาด">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h2 className="text-small font-medium">สรุปตลาดสำหรับผู้บริหาร</h2>
        <span className="slot-address">{asOf}</span>
      </div>

      <ul className="plan-divide-y">
        {bullets.map((bullet) => (
          <li
            key={bullet.id}
            className="flex gap-3 border-t border-rule px-4 py-3 first:border-t-0"
          >
            <span
              aria-hidden="true"
              className="mt-[0.45rem] h-3 w-[3px] shrink-0"
              style={{ background: TONE_RULE[bullet.tone] }}
            />
            <p className="text-base leading-relaxed">{bullet.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
