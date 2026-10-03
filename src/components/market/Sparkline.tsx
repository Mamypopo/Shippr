/**
 * A stat-tile sparkline: one series, recessive, no axes.
 *
 * Stepped rather than smoothed because these are weekly readings, not a
 * continuous signal — a curve between two Thursdays would imply measurements
 * that were never taken.
 *
 * One series, so no legend and no categorical hue: the tile's own label says
 * what is plotted. The end point is marked so the reader can see which end is
 * now. Server-rendered inline SVG — no chart library on the dashboard's
 * critical path, and it prints.
 */
export function Sparkline({
  values,
  width = 132,
  height = 36,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  // Inset so the 2px stroke and the end marker are not clipped by the frame.
  const padY = 5;
  const padX = 4;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const step = plotW / (values.length - 1);

  const x = (i: number) => padX + i * step;
  const y = (v: number) => padY + plotH - ((v - min) / span) * plotH;

  const segments: string[] = [`M ${x(0).toFixed(2)} ${y(values[0]).toFixed(2)}`];
  for (let i = 1; i < values.length; i++) {
    segments.push(`L ${x(i).toFixed(2)} ${y(values[i - 1]).toFixed(2)}`);
    segments.push(`L ${x(i).toFixed(2)} ${y(values[i]).toFixed(2)}`);
  }

  const line = segments.join(" ");
  const area = `${line} L ${x(values.length - 1).toFixed(2)} ${height - padY} L ${padX} ${height - padY} Z`;
  const lastIndex = values.length - 1;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`แนวโน้ม ${values.length} งวดล่าสุด`}
    >
      {/* Area as a wash, never a saturated block. */}
      <path d={area} fill="var(--color-seq-450)" opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-seq-450)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End marker with a surface ring, so it stays legible over the line. */}
      <circle
        cx={x(lastIndex)}
        cy={y(values[lastIndex])}
        r={3.5}
        fill="var(--color-seq-600)"
        stroke="var(--color-ground)"
        strokeWidth={2}
      />
    </svg>
  );
}
