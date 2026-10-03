/**
 * A stepped area sparkline.
 *
 * Stepped rather than smoothed because these indices are weekly readings, not
 * a continuous signal — a curve between two Thursdays implies measurements
 * that were never taken.
 *
 * Server-rendered inline SVG: no chart library on the dashboard's critical
 * path, and it prints.
 */
export function Sparkline({
  values,
  width = 148,
  height = 34,
  tone = "ink",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "ink" | "clear" | "watch" | "hazard";
}) {
  if (values.length < 2) {
    return (
      <div
        className="text-micro text-hull-faint"
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  // Pad vertically so the extremes are not clipped against the frame.
  const pad = 3;
  const plotHeight = height - pad * 2;
  const y = (v: number) => pad + plotHeight - ((v - min) / span) * plotHeight;

  const points: string[] = [];
  values.forEach((value, i) => {
    const x = i * step;
    if (i === 0) points.push(`M ${x.toFixed(2)} ${y(value).toFixed(2)}`);
    else {
      points.push(`L ${x.toFixed(2)} ${y(values[i - 1]).toFixed(2)}`);
      points.push(`L ${x.toFixed(2)} ${y(value).toFixed(2)}`);
    }
  });

  const line = points.join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  const stroke = {
    ink: "var(--color-hull-soft)",
    clear: "var(--color-clear)",
    watch: "var(--color-watch)",
    hazard: "var(--color-hazard)",
  }[tone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`แนวโน้ม ${values.length} งวดล่าสุด`}
    >
      <path d={area} fill={stroke} opacity={0.1} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.25} />
    </svg>
  );
}
