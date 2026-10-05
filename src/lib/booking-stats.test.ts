import { describe, expect, it } from "vitest";

import { computeCarrierStats, type BookingRecord } from "./booking-stats";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function booking(overrides: Partial<BookingRecord>): BookingRecord {
  return {
    carrierName: "Maersk",
    bookedOn: day("2026-09-01"),
    confirmedAt: null,
    expectedArrival: null,
    arrivedAt: null,
    ...overrides,
  };
}

describe("computeCarrierStats", () => {
  it("averages hours from booking to confirmation", () => {
    const stats = computeCarrierStats([
      booking({ confirmedAt: new Date("2026-09-01T04:00:00Z") }),
      booking({ confirmedAt: new Date("2026-09-02T04:00:00Z") }),
    ]);
    const maersk = stats.get("maersk");
    expect(maersk?.confirmedSample).toBe(2);
    expect(maersk?.avgConfirmHours).toBeCloseTo((4 + 28) / 2, 5);
  });

  it("ignores bookings still waiting for confirmation", () => {
    const stats = computeCarrierStats([booking({ confirmedAt: null })]);
    expect(stats.get("maersk")?.confirmedSample).toBe(0);
    expect(stats.get("maersk")?.avgConfirmHours).toBeNull();
  });

  it("counts a vessel arriving on the agreed date as on time", () => {
    const stats = computeCarrierStats([
      booking({ expectedArrival: day("2026-09-20"), arrivedAt: day("2026-09-20") }),
      booking({ expectedArrival: day("2026-09-20"), arrivedAt: day("2026-09-25") }),
    ]);
    expect(stats.get("maersk")?.arrivalSample).toBe(2);
    expect(stats.get("maersk")?.onTimePct).toBe(50);
  });

  it("returns null on-time when no arrival has been recorded", () => {
    const stats = computeCarrierStats([booking({ expectedArrival: day("2026-09-20") })]);
    expect(stats.get("maersk")?.onTimePct).toBeNull();
  });

  it("treats carrier names case-insensitively and ignores surrounding spaces", () => {
    const stats = computeCarrierStats([
      booking({ carrierName: "Maersk", confirmedAt: new Date("2026-09-01T02:00:00Z") }),
      booking({ carrierName: "  MAERSK ", confirmedAt: new Date("2026-09-01T06:00:00Z") }),
    ]);
    expect(stats.size).toBe(1);
    expect(stats.get("maersk")?.confirmedSample).toBe(2);
  });

  it("keeps separate carriers apart", () => {
    const stats = computeCarrierStats([
      booking({ carrierName: "Maersk", confirmedAt: new Date("2026-09-01T02:00:00Z") }),
      booking({ carrierName: "CMA CGM", confirmedAt: new Date("2026-09-01T20:00:00Z") }),
    ]);
    expect(stats.get("maersk")?.avgConfirmHours).toBeCloseTo(2, 5);
    expect(stats.get("cma cgm")?.avgConfirmHours).toBeCloseTo(20, 5);
  });
});
