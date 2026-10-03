import { describe, expect, it } from "vitest";

import { computeMetrics, type IndexPoint } from "./metrics";
import { buildMarketSummary, type SummaryInput } from "./summary";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function weekly(values: number[], endIso = "2026-10-01"): IndexPoint[] {
  const end = d(endIso).getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  return values.map((value, i) => ({
    periodDate: new Date(end - (values.length - 1 - i) * week),
    value,
  }));
}

function input(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    indices: [
      {
        indexCode: "WCI",
        label: "Drewry WCI composite",
        unit: "USD_PER_FEU",
        metrics: computeMetrics(weekly([2000, 2200]), { asOf: d("2026-10-02") }),
      },
    ],
    ports: [{ name: "Singapore", avgWaitDays: 1.2, riskLevel: "LOW" }],
    alertCount7d: 0,
    ...overrides,
  };
}

describe("buildMarketSummary", () => {
  it("leads with the biggest weekly move and names the figure", () => {
    const [first] = buildMarketSummary(input());
    expect(first.id).toBe("top-mover");
    expect(first.text).toContain("+10.0%");
    expect(first.text).toContain("$2,200/FEU");
  });

  it("picks the largest move regardless of direction", () => {
    const bullets = buildMarketSummary(
      input({
        indices: [
          {
            indexCode: "WCI",
            label: "WCI",
            unit: "USD_PER_FEU",
            metrics: computeMetrics(weekly([2000, 2100]), { asOf: d("2026-10-02") }),
          },
          {
            indexCode: "SCFI",
            label: "SCFI",
            unit: "POINTS",
            metrics: computeMetrics(weekly([1500, 1200]), { asOf: d("2026-10-02") }),
          },
        ],
      }),
    );
    expect(bullets[0].text).toContain("SCFI");
    expect(bullets[0].text).toContain("fell");
  });

  it("calls out a congested hub as critical and names it", () => {
    const bullets = buildMarketSummary(
      input({ ports: [{ name: "Laem Chabang", avgWaitDays: 5.4, riskLevel: "HIGH" }] }),
    );
    const congestion = bullets.find((b) => b.id === "congestion")!;
    expect(congestion.tone).toBe("critical");
    expect(congestion.text).toContain("Laem Chabang");
    expect(congestion.text).toContain("5.4");
  });

  it("reports a clear run of ports positively", () => {
    const congestion = buildMarketSummary(input()).find((b) => b.id === "congestion")!;
    expect(congestion.tone).toBe("positive");
  });

  it("counts disruption alerts and quotes the lead headline", () => {
    const bullets = buildMarketSummary(
      input({ alertCount7d: 4, topAlertHeadline: "Houthi strike closes Red Sea" }),
    );
    const alerts = bullets.find((b) => b.id === "alerts")!;
    expect(alerts.tone).toBe("critical");
    expect(alerts.text).toContain("Houthi");
    expect(alerts.text).toContain("4 disruption alerts");
  });

  it("says so when data is stale rather than presenting it as current", () => {
    const bullets = buildMarketSummary(
      input({
        indices: [
          {
            indexCode: "WCI",
            label: "Drewry WCI",
            unit: "USD_PER_FEU",
            metrics: computeMetrics(weekly([2000, 2200], "2026-08-01"), { asOf: d("2026-10-02") }),
          },
        ],
        ports: [],
      }),
    );
    expect(bullets.some((b) => b.id === "stale")).toBe(true);
  });

  it("explains itself instead of rendering an empty banner", () => {
    const bullets = buildMarketSummary({ indices: [], ports: [], alertCount7d: 0 });
    expect(bullets).toHaveLength(1);
    expect(bullets[0].id).toBe("empty");
  });

  it("never returns more than four bullets", () => {
    const bullets = buildMarketSummary(
      input({
        indices: [
          {
            indexCode: "WCI",
            label: "WCI",
            unit: "USD_PER_FEU",
            metrics: computeMetrics(weekly([2000, 2010, 1990, 2005, 1995, 2000, 2010, 3500], "2026-08-01"), {
              asOf: d("2026-10-02"),
            }),
          },
        ],
        ports: [{ name: "Shanghai", avgWaitDays: 6, riskLevel: "HIGH" }],
        alertCount7d: 5,
        topAlertHeadline: "Suez Canal transit halted",
      }),
    );
    expect(bullets.length).toBeLessThanOrEqual(4);
  });

  it("handles a single reading with no prior week", () => {
    const bullets = buildMarketSummary(
      input({
        indices: [
          {
            indexCode: "WCI",
            label: "WCI",
            unit: "USD_PER_FEU",
            metrics: computeMetrics(weekly([2000]), { asOf: d("2026-10-02") }),
          },
        ],
      }),
    );
    expect(bullets[0].id).toBe("single-reading");
  });
});
