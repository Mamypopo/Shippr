/**
 * Measured carrier performance from booking history — pure functions, so the
 * arithmetic is testable without a database.
 */

export interface BookingRecord {
  carrierName: string;
  bookedOn: Date;
  confirmedAt: Date | null;
  expectedArrival: Date | null;
  arrivedAt: Date | null;
}

export interface CarrierStats {
  carrierName: string;
  /** Bookings that had a confirmation time, used for the confirmation average. */
  confirmedSample: number;
  /** Average hours from booking to carrier confirmation. Null with no confirmed bookings. */
  avgConfirmHours: number | null;
  /** Bookings with both an agreed and an actual arrival date. */
  arrivalSample: number;
  /** Percent of those that arrived on or before the agreed date. Null with no sample. */
  onTimePct: number | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Normalises a carrier name so "Maersk " and "maersk" count as one carrier. */
export function carrierKey(name: string): string {
  return name.trim().toLowerCase();
}

export function computeCarrierStats(bookings: BookingRecord[]): Map<string, CarrierStats> {
  const groups = new Map<string, BookingRecord[]>();
  for (const booking of bookings) {
    const key = carrierKey(booking.carrierName);
    const group = groups.get(key);
    if (group) group.push(booking);
    else groups.set(key, [booking]);
  }

  const stats = new Map<string, CarrierStats>();
  for (const [key, group] of groups) {
    const confirmHours = group
      .filter((b) => b.confirmedAt !== null)
      .map((b) => (b.confirmedAt!.getTime() - b.bookedOn.getTime()) / HOUR_MS)
      .filter((h) => Number.isFinite(h) && h >= 0);

    const arrivals = group.filter((b) => b.expectedArrival !== null && b.arrivedAt !== null);
    const onTime = arrivals.filter((b) => b.arrivedAt!.getTime() <= b.expectedArrival!.getTime() + DAY_MS / 2);

    stats.set(key, {
      carrierName: group[0].carrierName.trim(),
      confirmedSample: confirmHours.length,
      avgConfirmHours:
        confirmHours.length > 0
          ? confirmHours.reduce((sum, h) => sum + h, 0) / confirmHours.length
          : null,
      arrivalSample: arrivals.length,
      onTimePct: arrivals.length > 0 ? (onTime.length / arrivals.length) * 100 : null,
    });
  }

  return stats;
}
