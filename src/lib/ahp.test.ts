import { describe, expect, it } from "vitest";

import {
  CRITERIA,
  CR_THRESHOLD,
  buildMatrix,
  computeAHP,
  computeConsistency,
  computePriorityVector,
  findInconsistencies,
  normalizeMatrix,
  pairKey,
  rankAlternatives,
  scoreAlternativesOnCriterion,
  type Alternative,
  type CriterionKey,
  type Matrix,
  type PairwiseInput,
} from "./ahp";
import { PRESET_LIST } from "./ahp-presets";

/** Build a perfectly consistent matrix from a known weight vector. */
function consistentMatrixFrom(weights: number[]): Matrix {
  return weights.map((wi) => weights.map((wj) => wi / wj));
}

describe("buildMatrix", () => {
  it("fills the diagonal with 1 and mirrors reciprocals", () => {
    const keys = ["a", "b", "c"] as const;
    const matrix = buildMatrix(keys, {
      "a:b": 3,
      "a:c": 5,
      "b:c": 2,
    });

    expect(matrix[0][0]).toBe(1);
    expect(matrix[1][1]).toBe(1);
    expect(matrix[0][1]).toBe(3);
    expect(matrix[1][0]).toBeCloseTo(1 / 3, 12);
    expect(matrix[2][0]).toBeCloseTo(1 / 5, 12);
    expect(matrix[2][1]).toBeCloseTo(1 / 2, 12);
  });

  it("defaults missing comparisons to indifference instead of failing", () => {
    const matrix = buildMatrix(["a", "b"] as const, {});
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(1);
  });

  it("warns on values outside the Saaty scale but still uses them", () => {
    const warnings: string[] = [];
    const matrix = buildMatrix(["a", "b"] as const, { "a:b": 15 }, warnings);
    expect(matrix[0][1]).toBe(15);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Saaty");
  });

  it("replaces a non-positive ratio with 1 rather than producing Infinity", () => {
    const warnings: string[] = [];
    const matrix = buildMatrix(["a", "b"] as const, { "a:b": 0 }, warnings);
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(1);
    expect(warnings[0]).toContain("not a valid ratio");
  });
});

describe("normalizeMatrix", () => {
  it("makes every column sum to 1", () => {
    const normalized = normalizeMatrix(buildMatrix(["a", "b", "c"] as const, { "a:b": 3, "a:c": 5, "b:c": 2 }));
    for (let j = 0; j < 3; j++) {
      const colSum = normalized.reduce((acc, row) => acc + row[j], 0);
      expect(colSum).toBeCloseTo(1, 12);
    }
  });
});

describe("computePriorityVector", () => {
  it("recovers the exact weights of a perfectly consistent matrix", () => {
    const expected = [0.5, 0.3, 0.15, 0.05];
    const { weights, converged } = computePriorityVector(consistentMatrixFrom(expected));

    expect(converged).toBe(true);
    weights.forEach((w, i) => expect(w).toBeCloseTo(expected[i], 10));
  });

  it("returns uniform weights for a matrix of all ones", () => {
    const matrix: Matrix = Array.from({ length: 5 }, () => new Array<number>(5).fill(1));
    const { weights } = computePriorityVector(matrix);
    weights.forEach((w) => expect(w).toBeCloseTo(0.2, 12));
  });

  it("always produces a vector that sums to 1", () => {
    const matrix = buildMatrix(CRITERIA, {
      "cost:transitTime": 7,
      "transitTime:reliability": 5,
      "reliability:cost": 3,
    } as PairwiseInput);
    const { weights } = computePriorityVector(matrix);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe("computeConsistency", () => {
  it("reports CR = 0 and lambdaMax = n for a perfectly consistent matrix", () => {
    const matrix = consistentMatrixFrom([0.5, 0.3, 0.15, 0.05]);
    const { weights } = computePriorityVector(matrix);
    const result = computeConsistency(matrix, weights);

    expect(result.lambdaMax).toBeCloseTo(4, 8);
    expect(result.consistencyIndex).toBeCloseTo(0, 8);
    expect(result.consistencyRatio).toBeCloseTo(0, 8);
    expect(result.isConsistent).toBe(true);
  });

  it("never returns a negative consistency index", () => {
    // Floating point can put lambdaMax a hair under n; CI must clamp at 0.
    const matrix = consistentMatrixFrom([0.4, 0.3, 0.2, 0.1]);
    const { weights } = computePriorityVector(matrix);
    expect(computeConsistency(matrix, weights).consistencyIndex).toBeGreaterThanOrEqual(0);
  });

  it("treats a 2x2 matrix as consistent by construction", () => {
    const matrix = buildMatrix(["a", "b"] as const, { "a:b": 9 });
    const { weights } = computePriorityVector(matrix);
    expect(computeConsistency(matrix, weights).consistencyRatio).toBe(0);
  });

  it("holds lambdaMax at or above n for any reciprocal matrix", () => {
    const matrix = buildMatrix(["a", "b", "c"] as const, { "a:b": 5, "a:c": 2, "b:c": 7 });
    const { weights } = computePriorityVector(matrix);
    expect(computeConsistency(matrix, weights).lambdaMax).toBeGreaterThanOrEqual(3 - 1e-9);
  });

  it("accepts the mildly inconsistent 3x3 from the AHP literature", () => {
    // a > b > c with a:b=2, b:c=3, a:c=5 — a judgment set a human would make.
    const matrix = buildMatrix(["a", "b", "c"] as const, { "a:b": 2, "a:c": 5, "b:c": 3 });
    const { weights } = computePriorityVector(matrix);
    const { consistencyRatio } = computeConsistency(matrix, weights);

    expect(consistencyRatio).toBeGreaterThan(0);
    expect(consistencyRatio).toBeLessThan(CR_THRESHOLD);
  });

  it("flags a circular preference as inconsistent", () => {
    // a >> b, b >> c, but c >> a. No weight vector can satisfy all three.
    const matrix = buildMatrix(["a", "b", "c"] as const, {
      "a:b": 7,
      "b:c": 7,
      "a:c": 1 / 7,
    });
    const { weights } = computePriorityVector(matrix);
    expect(computeConsistency(matrix, weights).consistencyRatio).toBeGreaterThan(CR_THRESHOLD);
  });
});

describe("findInconsistencies", () => {
  it("names the offending cell and suggests the implied ratio", () => {
    const keys = ["a", "b", "c"] as const;
    const matrix = buildMatrix(keys, { "a:b": 7, "b:c": 7, "a:c": 1 / 7 });
    const { weights } = computePriorityVector(matrix);
    const hints = findInconsistencies(keys, matrix, weights);

    expect(hints.length).toBeGreaterThan(0);
    // "a:c" is the cell that contradicts the other two.
    expect(hints[0]).toMatchObject({ rowKey: "a", colKey: "c" });
    expect(hints[0].suggested).toBeGreaterThan(hints[0].entered);
    expect(hints[0].deviation).toBeGreaterThan(0);
  });

  it("returns nothing for a perfectly consistent matrix", () => {
    const weightsIn = [0.5, 0.3, 0.2];
    const matrix = consistentMatrixFrom(weightsIn);
    const { weights } = computePriorityVector(matrix);
    expect(findInconsistencies(["a", "b", "c"] as const, matrix, weights)).toHaveLength(0);
  });

  it("orders hints worst-first and respects the limit", () => {
    const keys = ["a", "b", "c", "d"] as const;
    const matrix = buildMatrix(keys, {
      "a:b": 9,
      "a:c": 1 / 9,
      "a:d": 5,
      "b:c": 7,
      "b:d": 1 / 5,
      "c:d": 3,
    });
    const { weights } = computePriorityVector(matrix);
    const hints = findInconsistencies(keys, matrix, weights, 2);

    expect(hints).toHaveLength(2);
    expect(hints[0].deviation).toBeGreaterThanOrEqual(hints[1].deviation);
  });
});

describe("scoreAlternativesOnCriterion", () => {
  const alts: Alternative<"cost">[] = [
    { id: "1", label: "Maersk", values: { cost: 2000 } },
    { id: "2", label: "ONE", values: { cost: 2500 } },
    { id: "3", label: "MSC", values: { cost: 4000 } },
  ];

  it("gives the cheapest carrier a perfect 1.0 on a min criterion", () => {
    const scores = scoreAlternativesOnCriterion(alts, "cost", "min");
    expect(scores[0]).toBeCloseTo(1, 12);
    expect(scores[1]).toBeCloseTo(0.8, 12);
    expect(scores[2]).toBeCloseTo(0.5, 12);
  });

  it("gives the highest value a perfect 1.0 on a max criterion", () => {
    const scores = scoreAlternativesOnCriterion(alts, "cost", "max");
    expect(scores[2]).toBeCloseTo(1, 12);
    expect(scores[0]).toBeCloseTo(0.5, 12);
  });

  it("falls back to an even split when a min criterion contains zero", () => {
    const warnings: string[] = [];
    const scores = scoreAlternativesOnCriterion(
      [
        { id: "1", label: "A", values: { cost: 0 } },
        { id: "2", label: "B", values: { cost: 100 } },
      ],
      "cost",
      "min",
      warnings,
    );
    expect(scores).toEqual([0.5, 0.5]);
    expect(warnings).toHaveLength(1);
  });

  it("scores identical values identically", () => {
    const scores = scoreAlternativesOnCriterion(
      [
        { id: "1", label: "A", values: { cost: 100 } },
        { id: "2", label: "B", values: { cost: 100 } },
      ],
      "cost",
      "min",
    );
    expect(scores).toEqual([1, 1]);
  });
});

describe("rankAlternatives", () => {
  const keys = ["cost", "transitTime"] as const;
  const directions = { cost: "min", transitTime: "min" } as const;
  const alts: Alternative<"cost" | "transitTime">[] = [
    { id: "cheap", label: "Cheap & Slow", values: { cost: 1000, transitTime: 40 } },
    { id: "fast", label: "Pricey & Fast", values: { cost: 3000, transitTime: 20 } },
  ];

  it("picks the cheap carrier when cost carries the weight", () => {
    const ranked = rankAlternatives(keys, directions, { cost: 0.9, transitTime: 0.1 }, alts);
    expect(ranked[0].id).toBe("cheap");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score100).toBeCloseTo(100, 10);
  });

  it("picks the fast carrier when transit time carries the weight", () => {
    const ranked = rankAlternatives(keys, directions, { cost: 0.1, transitTime: 0.9 }, alts);
    expect(ranked[0].id).toBe("fast");
  });

  it("scales the winner to exactly 100", () => {
    const ranked = rankAlternatives(keys, directions, { cost: 0.5, transitTime: 0.5 }, alts);
    expect(ranked[0].score100).toBeCloseTo(100, 10);
    expect(ranked[1].score100).toBeLessThanOrEqual(100);
  });
});

describe("computeAHP", () => {
  const alts: Alternative<CriterionKey>[] = [
    {
      id: "maersk",
      label: "Maersk",
      values: { cost: 2400, transitTime: 28, reliability: 85, availability: 8, service: 9 },
    },
    {
      id: "one",
      label: "ONE",
      values: { cost: 2150, transitTime: 32, reliability: 78, availability: 7, service: 7 },
    },
    {
      id: "msc",
      label: "MSC",
      values: { cost: 1950, transitTime: 35, reliability: 68, availability: 9, service: 6 },
    },
  ];

  it("returns weights over every criterion that sum to 1", () => {
    const result = computeAHP({}, { alternatives: alts });
    const total = CRITERIA.reduce((acc, key) => acc + result.weights[key], 0);
    expect(total).toBeCloseTo(1, 12);
    expect(Object.keys(result.weights).sort()).toEqual([...CRITERIA].sort());
  });

  it("ranks the cheapest carrier first under a cost-dominant matrix", () => {
    const pairwise: PairwiseInput = {
      [pairKey("cost", "transitTime")]: 5,
      [pairKey("cost", "reliability")]: 5,
      [pairKey("cost", "availability")]: 7,
      [pairKey("cost", "service")]: 7,
    };
    const result = computeAHP(pairwise, { alternatives: alts });
    expect(result.ranking[0].id).toBe("msc");
  });

  it("ranks the fastest, most reliable carrier first under a time-dominant matrix", () => {
    const pairwise: PairwiseInput = {
      [pairKey("cost", "transitTime")]: 1 / 7,
      [pairKey("cost", "reliability")]: 1 / 5,
      [pairKey("transitTime", "reliability")]: 2,
      [pairKey("transitTime", "availability")]: 5,
      [pairKey("transitTime", "service")]: 7,
      [pairKey("reliability", "availability")]: 3,
      [pairKey("reliability", "service")]: 5,
    };
    const result = computeAHP(pairwise, { alternatives: alts });
    expect(result.ranking[0].id).toBe("maersk");
  });

  it("surfaces actionable hints when the matrix is inconsistent", () => {
    const pairwise: PairwiseInput = {
      [pairKey("cost", "transitTime")]: 9,
      [pairKey("transitTime", "reliability")]: 9,
      [pairKey("cost", "reliability")]: 1 / 9,
    };
    const result = computeAHP(pairwise);

    expect(result.isConsistent).toBe(false);
    expect(result.consistencyRatio).toBeGreaterThanOrEqual(CR_THRESHOLD);
    expect(result.inconsistencies.length).toBeGreaterThan(0);
  });

  it("produces no ranking when no alternatives are supplied", () => {
    expect(computeAHP({}).ranking).toEqual([]);
  });

  it("stays consistent and uniform for an empty (all-indifferent) input", () => {
    const result = computeAHP({});
    expect(result.consistencyRatio).toBeCloseTo(0, 12);
    expect(result.isConsistent).toBe(true);
    CRITERIA.forEach((key) => expect(result.weights[key]).toBeCloseTo(0.2, 12));
  });
});

describe("cargo presets", () => {
  it.each(PRESET_LIST.map((p) => [p.key, p] as const))(
    "%s is internally consistent (CR < 0.1)",
    (_key, preset) => {
      const result = computeAHP(preset.pairwise);
      expect(result.consistencyRatio).toBeLessThan(CR_THRESHOLD);
      expect(result.isConsistent).toBe(true);
    },
  );

  it("weights cost highest for low-margin general cargo", () => {
    const { weights } = computeAHP(
      PRESET_LIST.find((p) => p.key === "LOW_MARGIN_GENERAL")!.pairwise,
    );
    const top = CRITERIA.reduce((a, b) => (weights[a] >= weights[b] ? a : b));
    expect(top).toBe("cost");
  });

  it("weights transit time or equipment highest for reefer cargo", () => {
    const { weights } = computeAHP(
      PRESET_LIST.find((p) => p.key === "PERISHABLE_REEFER")!.pairwise,
    );
    const top = CRITERIA.reduce((a, b) => (weights[a] >= weights[b] ? a : b));
    expect(["transitTime", "availability"]).toContain(top);
  });

  it("weights equipment availability highest for a peak-season rush", () => {
    const { weights } = computeAHP(
      PRESET_LIST.find((p) => p.key === "PEAK_SEASON_RUSH")!.pairwise,
    );
    const top = CRITERIA.reduce((a, b) => (weights[a] >= weights[b] ? a : b));
    expect(top).toBe("availability");
  });
});
