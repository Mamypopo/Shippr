import { describe, expect, it } from "vitest";

import { assessMarketSituation, type MarketSituationInput } from "./market-situation";

function input(overrides: Partial<MarketSituationInput> = {}): MarketSituationInput {
  return {
    rateWowPct: null,
    rateLabel: "Drewry WCI",
    portRiskLevels: [],
    newsCounts: { geopolitics: 0, weather: 0, chokepoint: 0, capacity: 0 },
    ...overrides,
  };
}

describe("assessMarketSituation", () => {
  it("reads quiet data as normal/low across the board", () => {
    const r = assessMarketSituation(input({ rateWowPct: 0 }));
    expect(r.demand).toBe("NORMAL");
    expect(r.supply).toBe("EXCESS");
    expect(r.freightRate.level).toBe("NORMAL");
    expect(r.geopoliticalRisk).toBe("LOW");
    expect(r.weatherRisk).toBe("LOW");
    expect(r.routeDisruption).toBe("LOW");
  });

  it("a sharp rate rise alone drives demand and freight-rate risk high", () => {
    const r = assessMarketSituation(input({ rateWowPct: 6 }));
    expect(r.freightRate.level).toBe("HIGH");
    expect(r.demand).toBe("HIGH");
    expect(r.impact.freightRateRisk).toBe("HIGH");
  });

  it("a falling rate with no congestion reads as low demand", () => {
    const r = assessMarketSituation(input({ rateWowPct: -6 }));
    expect(r.demand).toBe("LOW");
    expect(r.impact.freightRateRisk).toBe("LOW");
  });

  it("a high-risk port alone is enough to call demand high and supply tight", () => {
    const r = assessMarketSituation(input({ rateWowPct: 0, portRiskLevels: ["LOW", "HIGH"] }));
    expect(r.demand).toBe("HIGH");
    expect(r.supply).toBe("TIGHT");
    expect(r.impact.capacitySpaceRisk).toBe("HIGH");
  });

  it("two or more capacity-tagged alerts tighten supply even with calm ports", () => {
    const r = assessMarketSituation(input({ newsCounts: { geopolitics: 0, weather: 0, chokepoint: 0, capacity: 2 } }));
    expect(r.supply).toBe("TIGHT");
  });

  it("one capacity alert is not enough on its own — reads normal, not tight", () => {
    const r = assessMarketSituation(input({ newsCounts: { geopolitics: 0, weather: 0, chokepoint: 0, capacity: 1 } }));
    expect(r.supply).toBe("NORMAL");
  });

  it("repeated geopolitical or weather alerts raise their own risk band independently", () => {
    const geo = assessMarketSituation(input({ newsCounts: { geopolitics: 3, weather: 0, chokepoint: 0, capacity: 0 } }));
    expect(geo.geopoliticalRisk).toBe("HIGH");
    expect(geo.weatherRisk).toBe("LOW");

    const weather = assessMarketSituation(input({ newsCounts: { geopolitics: 0, weather: 3, chokepoint: 0, capacity: 0 } }));
    expect(weather.weatherRisk).toBe("HIGH");
    expect(weather.impact.transitTimeRisk).toBe("HIGH");
  });

  it("chokepoint alerts or a HIGH port both drive route disruption and schedule risk high", () => {
    const chokepoint = assessMarketSituation(input({ newsCounts: { geopolitics: 0, weather: 0, chokepoint: 2, capacity: 0 } }));
    expect(chokepoint.routeDisruption).toBe("HIGH");
    expect(chokepoint.impact.scheduleRisk).toBe("HIGH");

    const port = assessMarketSituation(input({ portRiskLevels: ["HIGH"] }));
    expect(port.routeDisruption).toBe("HIGH");
    expect(port.impact.scheduleRisk).toBe("HIGH");
  });

  it("is a pure function of its input — same input, same output", () => {
    const a = assessMarketSituation(input({ rateWowPct: 4, portRiskLevels: ["MODERATE"] }));
    const b = assessMarketSituation(input({ rateWowPct: 4, portRiskLevels: ["MODERATE"] }));
    expect(a).toEqual(b);
  });
});
