import { describe, expect, it } from "vitest";

import { buildRecommendation, type RecommendationInput } from "./recommendation";
import type { CriterionKey, RankedAlternative } from "./ahp";

const CALM_IMPACT = { freightRateRisk: "LOW", capacitySpaceRisk: "LOW", transitTimeRisk: "LOW", scheduleRisk: "LOW" } as const;

function alt(id: string, label: string, localScores: Partial<Record<CriterionKey, number>>): RankedAlternative<CriterionKey> {
  const base: Record<CriterionKey, number> = {
    cost: 0.5,
    transitTime: 0.5,
    reliability: 0.5,
    availability: 0.5,
    service: 0.5,
  };
  return { id, label, localScores: { ...base, ...localScores }, rawScore: 1, score100: 100, rank: 1 };
}

function quote(id: string, overrides: Partial<{ blankSailingsPerQuarter: number; isDirect: boolean; transitDays: number }> = {}) {
  return { id, blankSailingsPerQuarter: 0, isDirect: true, transitDays: 30, ...overrides };
}

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    ranking: [alt("a", "A Line", { cost: 0.9 }), alt("b", "B Line", {})],
    benchmarks: {},
    quotes: [quote("a"), quote("b")],
    marketImpact: { ...CALM_IMPACT },
    ...overrides,
  };
}

describe("buildRecommendation", () => {
  it("returns no winner for an empty ranking", () => {
    const r = buildRecommendation(baseInput({ ranking: [] }));
    expect(r.winnerId).toBeNull();
    expect(r.reasons).toEqual([]);
  });

  it("names the criterion the winner clearly beat the runner-up on", () => {
    const r = buildRecommendation(baseInput());
    expect(r.winnerId).toBe("a");
    expect(r.reasons).toEqual(["ต้นทุน"]);
  });

  it("names no reason when no single criterion differs by more than the margin", () => {
    const r = buildRecommendation(
      baseInput({ ranking: [alt("a", "A", { cost: 0.52 }), alt("b", "B", {})] }),
    );
    expect(r.reasons).toEqual([]);
  });

  it("passes the ambient market impact through untouched when the quote has no flags", () => {
    const r = buildRecommendation(baseInput());
    expect(r.risk).toEqual(CALM_IMPACT);
  });

  it("escalates freight rate risk when the winner is priced above market", () => {
    const r = buildRecommendation(
      baseInput({ benchmarks: { a: { verdict: "ABOVE_MARKET" } as never } }),
    );
    expect(r.risk.freightRateRisk).toBe("HIGH");
  });

  it("does not escalate freight rate risk when at or below market", () => {
    const r = buildRecommendation(baseInput({ benchmarks: { a: { verdict: "AT_MARKET" } as never } }));
    expect(r.risk.freightRateRisk).toBe("LOW");
  });

  it("escalates capacity/space risk when the winner has blank sailings", () => {
    const r = buildRecommendation(
      baseInput({ quotes: [quote("a", { blankSailingsPerQuarter: 1 }), quote("b")] }),
    );
    expect(r.risk.capacitySpaceRisk).toBe("NORMAL");
  });

  it("escalates transit time risk when the winner is notably slower than the fastest quote", () => {
    const r = buildRecommendation(
      baseInput({ quotes: [quote("a", { transitDays: 40 }), quote("b", { transitDays: 20 })] }),
    );
    expect(r.risk.transitTimeRisk).toBe("NORMAL");
  });

  it("does not escalate transit time risk for a modestly longer transit", () => {
    const r = buildRecommendation(
      baseInput({ quotes: [quote("a", { transitDays: 22 }), quote("b", { transitDays: 20 })] }),
    );
    expect(r.risk.transitTimeRisk).toBe("LOW");
  });

  it("escalates schedule risk for a transshipment routing or blank sailings", () => {
    const transship = buildRecommendation(
      baseInput({ quotes: [quote("a", { isDirect: false }), quote("b")] }),
    );
    expect(transship.risk.scheduleRisk).toBe("NORMAL");

    const blank = buildRecommendation(
      baseInput({ quotes: [quote("a", { blankSailingsPerQuarter: 2 }), quote("b")] }),
    );
    expect(blank.risk.scheduleRisk).toBe("NORMAL");
  });

  it("never escalates below the ambient market impact — HIGH stays HIGH", () => {
    const r = buildRecommendation(
      baseInput({ marketImpact: { ...CALM_IMPACT, capacitySpaceRisk: "HIGH" } }),
    );
    expect(r.risk.capacitySpaceRisk).toBe("HIGH");
  });
});
