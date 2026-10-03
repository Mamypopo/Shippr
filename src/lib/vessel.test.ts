import { describe, expect, it } from "vitest";

import { estimateEtaDays, haversineKm } from "./vessel";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(13.08, 100.88, 13.08, 100.88)).toBeCloseTo(0, 5);
  });

  it("matches a known distance — Laem Chabang to Singapore, roughly 1,350 km", () => {
    const km = haversineKm(13.08, 100.88, 1.29, 103.85);
    expect(km).toBeGreaterThan(1_300);
    expect(km).toBeLessThan(1_400);
  });

  it("is symmetric", () => {
    const a = haversineKm(13.08, 100.88, 1.29, 103.85);
    const b = haversineKm(1.29, 103.85, 13.08, 100.88);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe("estimateEtaDays", () => {
  it("divides distance by speed converted to km/day", () => {
    // 20 knots = 37.04 km/h = 888.96 km/day
    expect(estimateEtaDays(888.96, 20)).toBeCloseTo(1, 5);
  });

  it("returns null when speed is null — no reading to extrapolate from", () => {
    expect(estimateEtaDays(1_000, null)).toBeNull();
  });

  it("returns null below 1 knot — moored/anchored, not meaningfully under way", () => {
    expect(estimateEtaDays(1_000, 0.3)).toBeNull();
    expect(estimateEtaDays(1_000, 0)).toBeNull();
  });
});
