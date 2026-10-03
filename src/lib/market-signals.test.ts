import { describe, expect, it } from "vitest";

import { AT_MARKET_BAND_PCT, compareToMarket, routeLabel } from "./benchmark";
import { tagNewsItem } from "./disruption-keywords";
import { RISK_THRESHOLDS, riskLevelForWaitDays } from "./risk";

describe("compareToMarket", () => {
  it("calls a clearly dearer quote above market", () => {
    const result = compareToMarket(3000, 2000)!;
    expect(result.verdict).toBe("ABOVE_MARKET");
    expect(result.deltaUsd).toBe(1000);
    expect(result.deltaPct).toBeCloseTo(50, 10);
  });

  it("calls a clearly cheaper quote below market", () => {
    expect(compareToMarket(1500, 2000)!.verdict).toBe("BELOW_MARKET");
  });

  it("treats a small gap as at market rather than manufacturing a signal", () => {
    expect(compareToMarket(2000 * 1.02, 2000)!.verdict).toBe("AT_MARKET");
    expect(compareToMarket(2000 * 0.98, 2000)!.verdict).toBe("AT_MARKET");
  });

  it("puts the band edge on the correct side", () => {
    const justInside = compareToMarket(2000 * (1 + AT_MARKET_BAND_PCT / 100), 2000)!;
    const justOutside = compareToMarket(2000 * (1 + (AT_MARKET_BAND_PCT + 0.1) / 100), 2000)!;
    expect(justInside.verdict).toBe("AT_MARKET");
    expect(justOutside.verdict).toBe("ABOVE_MARKET");
  });

  it("returns null when there is no market figure, rather than implying parity", () => {
    expect(compareToMarket(2000, null)).toBeNull();
    expect(compareToMarket(2000, undefined)).toBeNull();
    expect(compareToMarket(2000, 0)).toBeNull();
    expect(compareToMarket(2000, Number.NaN)).toBeNull();
  });

  it("returns null for a nonsensical quote", () => {
    expect(compareToMarket(0, 2000)).toBeNull();
    expect(compareToMarket(-100, 2000)).toBeNull();
  });

  it("carries the lane and reading date through for display", () => {
    const date = new Date("2026-10-01T00:00:00.000Z");
    const result = compareToMarket(2500, 2000, { routeCode: "SHA_RTM", marketPeriodDate: date })!;
    expect(result.routeCode).toBe("SHA_RTM");
    expect(result.marketPeriodDate).toBe(date);
  });

  it("labels known lanes and falls back to the raw code", () => {
    expect(routeLabel("SHA_RTM")).toBe("Shanghai → Rotterdam");
    expect(routeLabel("XX_YY")).toBe("XX_YY");
    expect(routeLabel(null)).toBe("Unknown lane");
  });
});

describe("riskLevelForWaitDays", () => {
  it("bands waiting times", () => {
    expect(riskLevelForWaitDays(0.5)).toBe("LOW");
    expect(riskLevelForWaitDays(3)).toBe("MODERATE");
    expect(riskLevelForWaitDays(6)).toBe("HIGH");
  });

  it("puts the boundaries where the spec says", () => {
    expect(riskLevelForWaitDays(RISK_THRESHOLDS.moderate - 0.01)).toBe("LOW");
    expect(riskLevelForWaitDays(RISK_THRESHOLDS.moderate)).toBe("MODERATE");
    expect(riskLevelForWaitDays(RISK_THRESHOLDS.high)).toBe("MODERATE");
    expect(riskLevelForWaitDays(RISK_THRESHOLDS.high + 0.01)).toBe("HIGH");
  });

  it("treats a missing figure as low rather than crashing a dashboard tile", () => {
    expect(riskLevelForWaitDays(Number.NaN)).toBe("LOW");
  });
});

describe("tagNewsItem", () => {
  it("tags a Red Sea story as geopolitics and escalates it", () => {
    const result = tagNewsItem("Houthi attack closes Red Sea route for boxships");
    expect(result.tags).toContain("GEOPOLITICS");
    expect(result.severity).toBe("ALERT");
    expect(result.matchedKeywords).toContain("red sea");
  });

  it("tags canal stories as chokepoints", () => {
    expect(tagNewsItem("Panama Canal eases draft restriction").tags).toContain("CHOKEPOINT");
  });

  it("tags labour action", () => {
    expect(tagNewsItem("Dockers announce strike at Rotterdam").tags).toContain("LABOR");
  });

  it("does not fire 'union' on 'Reunion'", () => {
    const result = tagNewsItem("New service calls at Reunion Island");
    expect(result.tags).not.toContain("LABOR");
  });

  it("does not fire 'strait' inside an unrelated word", () => {
    const result = tagNewsItem("A straightforward quarter for carriers");
    expect(result.tags).not.toContain("CHOKEPOINT");
  });

  it("rates a single non-escalating tag as a watch, not an alert", () => {
    const result = tagNewsItem("Carriers announce general rate increase for November");
    expect(result.tags).toEqual(["RATE_MOVE"]);
    expect(result.severity).toBe("WATCH");
  });

  it("escalates when two unrelated disruption themes appear together", () => {
    const result = tagNewsItem("Typhoon forces blank sailing across Asia-Europe");
    expect(result.tags).toEqual(expect.arrayContaining(["WEATHER", "CAPACITY"]));
    expect(result.severity).toBe("ALERT");
  });

  it("leaves an unrelated story untagged", () => {
    const result = tagNewsItem("Carrier appoints new chief financial officer");
    expect(result.tags).toEqual([]);
    expect(result.severity).toBe("INFO");
  });

  it("searches the summary as well as the title", () => {
    const result = tagNewsItem("Service update", "Vessels will avoid the Suez Canal this month");
    expect(result.tags).toContain("CHOKEPOINT");
  });

  it("handles an empty item without throwing", () => {
    expect(tagNewsItem("", null)).toEqual({ tags: [], matchedKeywords: [], severity: "INFO" });
  });

  it("does not report the same keyword twice", () => {
    const result = tagNewsItem("Strike threat grows", "A strike would halt the strike-hit port");
    expect(result.matchedKeywords.filter((k) => k === "strike")).toHaveLength(1);
  });
});
