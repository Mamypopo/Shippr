import { describe, expect, it } from "vitest";

import {
  computeMetrics,
  findPointNearDaysBack,
  mean,
  movingAverageSeries,
  percentChange,
  sortByPeriod,
  stdDev,
  type IndexPoint,
} from "./metrics";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Weekly series ending on the given date, oldest first. */
function weekly(values: number[], endIso = "2026-10-02"): IndexPoint[] {
  const end = d(endIso).getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  return values.map((value, i) => ({
    periodDate: new Date(end - (values.length - 1 - i) * week),
    value,
  }));
}

describe("helpers", () => {
  it("computes percent change", () => {
    expect(percentChange(110, 100)).toBeCloseTo(10, 12);
    expect(percentChange(90, 100)).toBeCloseTo(-10, 12);
  });

  it("returns null rather than Infinity when the prior value is zero", () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it("returns null for a standard deviation of fewer than two points", () => {
    expect(stdDev([5])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("does not mutate the input when sorting", () => {
    const points = weekly([1, 2, 3]).reverse();
    const snapshot = [...points];
    sortByPeriod(points);
    expect(points).toEqual(snapshot);
  });
});

describe("findPointNearDaysBack", () => {
  const series = weekly([100, 101, 102, 103, 104, 105]); // 6 weekly points

  it("finds the reading closest to the target offset", () => {
    const latest = series[series.length - 1];
    const found = findPointNearDaysBack(series, latest.periodDate, 28);
    // 28 days back from the last point is exactly four weeks.
    expect(found?.value).toBe(101);
  });

  it("returns null when nothing falls inside the tolerance", () => {
    const latest = series[series.length - 1];
    expect(findPointNearDaysBack(series, latest.periodDate, 365)).toBeNull();
  });

  it("never returns the reference point itself", () => {
    const latest = series[series.length - 1];
    const found = findPointNearDaysBack(series, latest.periodDate, 0, 999);
    expect(found?.periodDate.getTime()).toBeLessThan(latest.periodDate.getTime());
  });
});

describe("computeMetrics", () => {
  it("returns an empty, stale result for no data", () => {
    const m = computeMetrics([]);
    expect(m.latest).toBeNull();
    expect(m.wowPct).toBeNull();
    expect(m.isStale).toBe(true);
  });

  it("computes week-over-week change against the prior reading", () => {
    const m = computeMetrics(weekly([2000, 2200]), { asOf: d("2026-10-02") });
    expect(m.wowAbs).toBe(200);
    expect(m.wowPct).toBeCloseTo(10, 10);
  });

  it("computes month-over-month against the reading nearest 28 days back", () => {
    const m = computeMetrics(weekly([2000, 2050, 2100, 2150, 2400]), { asOf: d("2026-10-02") });
    expect(m.momAbs).toBe(400);
    expect(m.momPct).toBeCloseTo(20, 10);
  });

  it("leaves WoW null when there is only one reading", () => {
    expect(computeMetrics(weekly([2000])).wowPct).toBeNull();
  });

  it("flags a spike when the latest reading jumps clear of the trailing mean", () => {
    const m = computeMetrics(weekly([2000, 2010, 1990, 2005, 1995, 2000, 2010, 3500]), {
      asOf: d("2026-10-02"),
    });
    expect(m.isSpike).toBe(true);
    expect(m.spikeDirection).toBe("up");
    expect(m.zScore!).toBeGreaterThan(1.5);
  });

  it("flags a downward spike in the other direction", () => {
    const m = computeMetrics(weekly([3000, 3010, 2990, 3005, 2995, 3000, 3010, 1200]), {
      asOf: d("2026-10-02"),
    });
    expect(m.isSpike).toBe(true);
    expect(m.spikeDirection).toBe("down");
  });

  it("does not flag a spike on a flat series", () => {
    const m = computeMetrics(weekly([2000, 2001, 2000, 1999, 2000, 2001, 2000, 2002]), {
      asOf: d("2026-10-02"),
    });
    expect(m.isSpike).toBe(false);
  });

  it("does not attempt a z-score from too few points", () => {
    expect(computeMetrics(weekly([2000, 2100])).zScore).toBeNull();
  });

  it("marks a reading older than the stale window", () => {
    const m = computeMetrics(weekly([2000], "2026-09-01"), { asOf: d("2026-10-02") });
    expect(m.ageDays).toBe(31);
    expect(m.isStale).toBe(true);
  });

  it("treats a reading inside the window as current", () => {
    const m = computeMetrics(weekly([2000], "2026-09-28"), { asOf: d("2026-10-02") });
    expect(m.ageDays).toBe(4);
    expect(m.isStale).toBe(false);
  });

  it("accepts points in any order", () => {
    const shuffled = [...weekly([2000, 2200])].reverse();
    expect(computeMetrics(shuffled, { asOf: d("2026-10-02") }).wowAbs).toBe(200);
  });
});

describe("movingAverageSeries", () => {
  it("is null until the window fills, then tracks the trailing mean", () => {
    const series = movingAverageSeries(weekly([1, 2, 3, 4]), 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBeCloseTo(2, 12);
    expect(series[3]).toBeCloseTo(3, 12);
  });

  it("returns one entry per input point", () => {
    expect(movingAverageSeries(weekly([1, 2, 3, 4, 5]), 3)).toHaveLength(5);
  });
});

describe("spike gating", () => {
  it("ignores a statistically unusual but economically trivial move", () => {
    // Flat series: sigma collapses, so +0.08% reads as nearly 2 sigma.
    const m = computeMetrics(weekly([2000, 2001, 2000, 1999, 2000, 2001, 2000, 2002]), {
      asOf: d("2026-10-02"),
    });
    expect(Math.abs(m.zScore!)).toBeGreaterThan(1.5);
    expect(m.deviationFromMaPct!).toBeLessThan(2);
    expect(m.isSpike).toBe(false);
  });

  it("still flags a move that is both unusual and large", () => {
    const m = computeMetrics(weekly([2000, 2010, 1990, 2005, 1995, 2000, 2010, 3500]), {
      asOf: d("2026-10-02"),
    });
    expect(m.deviationFromMaPct!).toBeGreaterThan(2);
    expect(m.isSpike).toBe(true);
  });
});
