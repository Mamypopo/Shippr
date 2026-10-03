/**
 * Derived index metrics: WoW, MoM, moving averages, spike detection.
 *
 * Nothing here is stored. A freight index gets revised — Drewry restates, a
 * manual entry gets corrected — and a persisted delta would then disagree
 * with the series it was computed from. Deriving on read keeps them honest.
 */

export interface IndexPoint {
  /** The date the reading refers to, not when it was fetched. */
  periodDate: Date;
  value: number;
}

export interface IndexMetrics {
  latest: IndexPoint | null;
  previous: IndexPoint | null;
  /** Week-over-week change, as a percentage. Null when there is no prior point. */
  wowPct: number | null;
  wowAbs: number | null;
  /** Month-over-month change against the reading closest to 28 days back. */
  momPct: number | null;
  momAbs: number | null;
  /** Trailing mean over `maWindow` points, including the latest. */
  movingAverage: number | null;
  /** How far the latest point sits from the trailing mean, in std deviations. */
  zScore: number | null;
  /** How far the latest point sits from the trailing mean, in percent. */
  deviationFromMaPct: number | null;
  isSpike: boolean;
  spikeDirection: "up" | "down" | null;
  /** Days between the latest reading and `asOf`. */
  ageDays: number | null;
  isStale: boolean;
}

export interface MetricsOptions {
  /** Points in the trailing window used for the mean and std deviation. */
  maWindow?: number;
  /** Standard deviations from the trailing mean that counts as a spike. */
  spikeSigma?: number;
  /** Minimum move away from the trailing mean, in percent, to count as a spike. */
  minSpikePct?: number;
  /** A reading older than this is flagged stale. Weekly indices run ~7 days. */
  staleAfterDays?: number;
  asOf?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_MA_WINDOW = 8;
export const DEFAULT_SPIKE_SIGMA = 1.5;
/**
 * A sigma test alone is not enough. On a flat stretch the trailing standard
 * deviation collapses, so a fraction of a percent reads as several sigma and
 * the dashboard cries surge over noise. A spike has to be statistically
 * unusual *and* big enough for a forwarder to care about.
 */
export const DEFAULT_MIN_SPIKE_PCT = 2;
export const DEFAULT_STALE_AFTER_DAYS = 10;

/** Oldest first. Callers may pass any order; this does not mutate the input. */
export function sortByPeriod(points: IndexPoint[]): IndexPoint[] {
  return [...points].sort((a, b) => a.periodDate.getTime() - b.periodDate.getTime());
}

export function percentChange(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation. Null below two points, where it is undefined. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * The reading closest to `targetDaysBack` before the latest one.
 *
 * Index publication slips — a holiday week, a missed scrape — so "28 days ago"
 * will rarely land on an exact row. Picking the nearest reading beats
 * returning nothing, which would blank the MoM figure on the dashboard.
 */
export function findPointNearDaysBack(
  sorted: IndexPoint[],
  fromDate: Date,
  targetDaysBack: number,
  toleranceDays = 10,
): IndexPoint | null {
  const target = fromDate.getTime() - targetDaysBack * DAY_MS;
  let best: IndexPoint | null = null;
  let bestDistance = Infinity;

  for (const point of sorted) {
    if (point.periodDate.getTime() >= fromDate.getTime()) continue;
    const distance = Math.abs(point.periodDate.getTime() - target);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  return best && bestDistance <= toleranceDays * DAY_MS ? best : null;
}

export function computeMetrics(points: IndexPoint[], options: MetricsOptions = {}): IndexMetrics {
  const {
    maWindow = DEFAULT_MA_WINDOW,
    spikeSigma = DEFAULT_SPIKE_SIGMA,
    minSpikePct = DEFAULT_MIN_SPIKE_PCT,
    staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
    asOf = new Date(),
  } = options;

  const sorted = sortByPeriod(points);
  const empty: IndexMetrics = {
    latest: null,
    previous: null,
    wowPct: null,
    wowAbs: null,
    momPct: null,
    momAbs: null,
    movingAverage: null,
    zScore: null,
    deviationFromMaPct: null,
    isSpike: false,
    spikeDirection: null,
    ageDays: null,
    isStale: true,
  };

  if (sorted.length === 0) return empty;

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const monthAgo = findPointNearDaysBack(sorted, latest.periodDate, 28);

  const window = sorted.slice(-maWindow).map((p) => p.value);
  const movingAverage = mean(window);
  const sigma = stdDev(window);

  // A z-score needs a baseline the latest point is not the whole of.
  const zScore =
    movingAverage !== null && sigma !== null && sigma > 0 && window.length >= 3
      ? (latest.value - movingAverage) / sigma
      : null;

  const deviationPct =
    movingAverage !== null && movingAverage !== 0
      ? Math.abs((latest.value - movingAverage) / movingAverage) * 100
      : null;

  const isSpike =
    zScore !== null &&
    Math.abs(zScore) >= spikeSigma &&
    deviationPct !== null &&
    deviationPct >= minSpikePct;
  const ageDays = Math.floor((asOf.getTime() - latest.periodDate.getTime()) / DAY_MS);

  return {
    latest,
    previous,
    wowPct: previous ? percentChange(latest.value, previous.value) : null,
    wowAbs: previous ? latest.value - previous.value : null,
    momPct: monthAgo ? percentChange(latest.value, monthAgo.value) : null,
    momAbs: monthAgo ? latest.value - monthAgo.value : null,
    movingAverage,
    zScore,
    deviationFromMaPct: deviationPct,
    isSpike,
    spikeDirection: isSpike ? (zScore! > 0 ? "up" : "down") : null,
    ageDays,
    isStale: ageDays > staleAfterDays,
  };
}

/** Trailing moving average aligned to the series, null until the window fills. */
export function movingAverageSeries(
  points: IndexPoint[],
  window = DEFAULT_MA_WINDOW,
): (number | null)[] {
  const sorted = sortByPeriod(points);
  return sorted.map((_, i) => {
    if (i + 1 < window) return null;
    return mean(sorted.slice(i + 1 - window, i + 1).map((p) => p.value));
  });
}
