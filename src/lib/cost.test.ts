import { describe, expect, it } from "vitest";

import {
  availabilityScore,
  computeCost,
  effectiveTransitDays,
  perFeuRate,
  quoteToAlternative,
  reliabilityScore,
  serviceScore,
  type QuoteInput,
} from "./cost";

function quote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    id: "q1",
    carrierName: "Maersk",
    oceanFreightUsd: 2000,
    localChargesUsd: 300,
    freeTimeDays: 0,
    freeTimeValuePerDayUsd: 0,
    transitDays: 28,
    isDirect: true,
    transshipmentCount: 0,
    onTimePct: 85,
    blankSailingsPerQuarter: 0,
    equipmentAvailabilityScore: 8,
    bookingSlaHours: 24,
    docTurnaroundHours: 24,
    serviceScore: 8,
    ...overrides,
  };
}

describe("computeCost", () => {
  it("adds local charges to ocean freight", () => {
    expect(computeCost(quote()).grossCostUsd).toBe(2300);
  });

  it("credits the monetary value of free time", () => {
    const result = computeCost(quote({ freeTimeDays: 14, freeTimeValuePerDayUsd: 25 }));
    expect(result.freeTimeCreditUsd).toBe(350);
    expect(result.effectiveCostUsd).toBe(2300 - 350);
  });

  it("can rank a cheaper headline rate below a dearer one with more free time", () => {
    const headlineCheap = computeCost(
      quote({ oceanFreightUsd: 1900, freeTimeDays: 7, freeTimeValuePerDayUsd: 25 }),
    );
    const headlineDear = computeCost(
      quote({ oceanFreightUsd: 2000, freeTimeDays: 14, freeTimeValuePerDayUsd: 25 }),
    );

    expect(headlineCheap.grossCostUsd).toBeLessThan(headlineDear.grossCostUsd);
    expect(headlineCheap.effectiveCostUsd).toBeGreaterThan(headlineDear.effectiveCostUsd);
  });

  it("floors the effective cost above zero so the criterion stays rankable", () => {
    const result = computeCost(
      quote({ oceanFreightUsd: 100, localChargesUsd: 0, freeTimeDays: 100, freeTimeValuePerDayUsd: 50 }),
    );
    expect(result.effectiveCostUsd).toBeGreaterThan(0);
  });

  it("ignores negative inputs rather than producing a negative cost", () => {
    expect(computeCost(quote({ oceanFreightUsd: -500 })).grossCostUsd).toBe(300);
  });
});

describe("effectiveTransitDays", () => {
  it("leaves a direct service at its quoted days", () => {
    expect(effectiveTransitDays(quote({ transitDays: 28, isDirect: true }))).toBe(28);
  });

  it("penalises each transshipment leg", () => {
    expect(
      effectiveTransitDays(quote({ transitDays: 28, isDirect: false, transshipmentCount: 2 })),
    ).toBe(30);
  });

  it("assumes at least one leg when a service is marked indirect", () => {
    expect(
      effectiveTransitDays(quote({ transitDays: 28, isDirect: false, transshipmentCount: 0 })),
    ).toBe(29);
  });
});

describe("reliabilityScore", () => {
  it("returns the on-time percentage when nothing is blanked", () => {
    expect(reliabilityScore(quote({ onTimePct: 85 }))).toBe(85);
  });

  it("discounts a high on-time figure for frequent blank sailings", () => {
    const steady = reliabilityScore(quote({ onTimePct: 85, blankSailingsPerQuarter: 0 }));
    const blanking = reliabilityScore(quote({ onTimePct: 90, blankSailingsPerQuarter: 3 }));
    expect(blanking).toBeLessThan(steady);
  });

  it("never drops to zero, which would break min/max normalization", () => {
    expect(reliabilityScore(quote({ onTimePct: 0, blankSailingsPerQuarter: 50 }))).toBeGreaterThan(0);
  });
});

describe("availabilityScore and serviceScore", () => {
  it("leaves a 24-hour booking SLA unpenalised", () => {
    expect(availabilityScore(quote({ equipmentAvailabilityScore: 8, bookingSlaHours: 24 }))).toBe(8);
  });

  it("deducts a point per extra day of booking SLA", () => {
    expect(availabilityScore(quote({ equipmentAvailabilityScore: 8, bookingSlaHours: 72 }))).toBe(6);
  });

  it("deducts for slow draft B/L turnaround", () => {
    expect(serviceScore(quote({ serviceScore: 9, docTurnaroundHours: 72 }))).toBe(7);
  });

  it("clamps an out-of-range judgment into the 1-10 band", () => {
    expect(availabilityScore(quote({ equipmentAvailabilityScore: 99 }))).toBe(10);
    expect(serviceScore(quote({ serviceScore: -5 }))).toBe(1);
  });
});

describe("quoteToAlternative", () => {
  it("maps a quotation onto all five criteria with positive values", () => {
    const alt = quoteToAlternative(quote());
    expect(Object.keys(alt.values).sort()).toEqual(
      ["availability", "cost", "reliability", "service", "transitTime"].sort(),
    );
    Object.values(alt.values).forEach((v) => expect(v).toBeGreaterThan(0));
  });

  it("includes the service name in the label when present", () => {
    expect(quoteToAlternative(quote({ serviceName: "AE7" })).label).toBe("Maersk — AE7");
  });

  it("falls back to the carrier name alone", () => {
    expect(quoteToAlternative(quote()).label).toBe("Maersk");
  });
});

describe("perFeuRate", () => {
  it("divides the gross cost across the container count", () => {
    expect(perFeuRate(quote(), 2)).toBe(1150);
  });

  it("treats a zero container count as one rather than dividing by zero", () => {
    expect(perFeuRate(quote(), 0)).toBe(2300);
  });
});
