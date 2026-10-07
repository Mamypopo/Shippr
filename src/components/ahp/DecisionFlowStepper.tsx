const STEPS = [
  "สถานการณ์ตลาด",
  "Market Impact",
  "ระบุ Shipment",
  "ใบเสนอราคา",
  "เกณฑ์ AHP",
  "อันดับสายเรือ",
  "คำแนะนำ + ความเสี่ยง",
];

/**
 * A non-interactive breadcrumb of the reasoning chain this page follows:
 * market situation leads to its impact, which is read alongside the specific
 * shipment and quotes, scored by AHP, and ends in a recommendation with its
 * own risk flags. Nothing here is clickable — it exists so the page reads as
 * one argument instead of a stack of unrelated panels.
 */
export function DecisionFlowStepper({ current }: { current?: number }) {
  return (
    <ol className="panel flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-2.5 text-micro text-ink-faint">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1.5">
          <span
            className={i === current ? "font-medium text-ink" : undefined}
            style={i === current ? { color: "var(--color-ink)" } : undefined}
          >
            {step}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}
