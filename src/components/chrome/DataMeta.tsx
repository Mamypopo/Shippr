import { PROVENANCE_LABELS, provenanceFor, relativeDaysTh, SOURCE_LABELS, type ProvenanceKey } from "@/lib/format";

const PROVENANCE_COLOR: Record<ProvenanceKey, string> = {
  LIVE: "var(--color-ok)",
  MANUAL: "var(--color-ink-faint)",
  SAMPLE: "var(--color-warn)",
};

/**
 * The one line every market figure should carry: how recent it is, where it
 * came from, and — the distinction that matters most — whether it's real.
 * Used wherever a figure from `freight_index` or `port_status` is shown, so
 * the same data reads the same way on the dashboard, the admin tables, and
 * the memo instead of three slightly different phrasings.
 */
export function DataMeta({
  date,
  source,
  isSample = false,
}: {
  date: Date | null;
  source: string | null;
  isSample?: boolean;
}) {
  const provenance = source ? provenanceFor(source, isSample) : null;

  return (
    <span className="inline-flex items-center gap-1.5 text-micro text-ink-faint">
      {provenance && (
        <span className="fig font-medium" style={{ color: PROVENANCE_COLOR[provenance] }}>
          {PROVENANCE_LABELS[provenance]}
        </span>
      )}
      {date && <span>{relativeDaysTh(date)}</span>}
      {source && <span>{SOURCE_LABELS[source] ?? source}</span>}
    </span>
  );
}
