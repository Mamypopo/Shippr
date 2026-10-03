/**
 * Distance and ETA arithmetic for tracked vessels — pure functions, no I/O,
 * so they're as cheap to test as `metrics.ts` or `cost.ts`.
 */

const EARTH_RADIUS_KM = 6_371;
const KM_PER_KNOT_HOUR = 1.852;

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Days to cover a distance at a given speed, or `null` when the speed is too
 * low to extrapolate from (at anchor, moored, or simply becalmed in the
 * report) — a straight-line estimate at 0.1 knots would claim months, which
 * is a parse artifact, not a forecast.
 */
export function estimateEtaDays(distanceKm: number, speedKnots: number | null): number | null {
  if (speedKnots === null || speedKnots < 1) return null;
  const kmPerDay = speedKnots * KM_PER_KNOT_HOUR * 24;
  return distanceKm / kmPerDay;
}
