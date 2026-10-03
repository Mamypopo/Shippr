/**
 * Comparing a quoted rate against the market index for the same lane.
 */

export type BenchmarkVerdict = "BELOW_MARKET" | "AT_MARKET" | "ABOVE_MARKET";

export interface BenchmarkResult {
  quoteUsd: number;
  marketUsd: number;
  deltaUsd: number;
  deltaPct: number;
  verdict: BenchmarkVerdict;
  /** The lane the market figure came from, for display. */
  routeCode?: string;
  /** Date of the market reading, so a stale benchmark is visible. */
  marketPeriodDate?: Date;
}

/**
 * Spot rates move within a few percent week to week, and a quote inside that
 * band is not meaningfully off-market. Calling a 2% gap "above market" to a
 * client would be noise dressed as insight.
 */
export const AT_MARKET_BAND_PCT = 5;

/**
 * Returns null — never a zero or a fabricated midpoint — when no market
 * reading exists for the lane. The UI must say "no benchmark for this lane"
 * rather than imply the quote sits exactly at market.
 */
export function compareToMarket(
  quoteUsd: number,
  marketUsd: number | null | undefined,
  meta: { routeCode?: string; marketPeriodDate?: Date } = {},
): BenchmarkResult | null {
  if (
    typeof marketUsd !== "number" ||
    !Number.isFinite(marketUsd) ||
    marketUsd <= 0 ||
    !Number.isFinite(quoteUsd) ||
    quoteUsd <= 0
  ) {
    return null;
  }

  const deltaUsd = quoteUsd - marketUsd;
  const deltaPct = (deltaUsd / marketUsd) * 100;

  let verdict: BenchmarkVerdict = "AT_MARKET";
  if (deltaPct > AT_MARKET_BAND_PCT) verdict = "ABOVE_MARKET";
  else if (deltaPct < -AT_MARKET_BAND_PCT) verdict = "BELOW_MARKET";

  return {
    quoteUsd,
    marketUsd,
    deltaUsd,
    deltaPct,
    verdict,
    routeCode: meta.routeCode,
    marketPeriodDate: meta.marketPeriodDate,
  };
}

export const BENCHMARK_VERDICT_LABELS: Record<BenchmarkVerdict, { en: string; th: string }> = {
  BELOW_MARKET: { en: "Below market", th: "ต่ำกว่าตลาด" },
  AT_MARKET: { en: "At market", th: "ใกล้เคียงตลาด" },
  ABOVE_MARKET: { en: "Above market", th: "สูงกว่าตลาด" },
};

/**
 * Lane identifiers used for `FreightIndex.routeCode`.
 *
 * `COMPOSITE` is the fallback when a quote is on a lane the index does not
 * publish. It is a weaker comparison and the UI labels it as such.
 */
export const ROUTE_CODES = {
  COMPOSITE: "COMPOSITE",
  SHA_RTM: "SHA_RTM", // Shanghai - Rotterdam
  SHA_GOA: "SHA_GOA", // Shanghai - Genoa
  SHA_LAX: "SHA_LAX", // Shanghai - Los Angeles
  SHA_NYC: "SHA_NYC", // Shanghai - New York
  RTM_SHA: "RTM_SHA", // Rotterdam - Shanghai
  LAX_SHA: "LAX_SHA", // Los Angeles - Shanghai
} as const;

export type RouteCode = (typeof ROUTE_CODES)[keyof typeof ROUTE_CODES];

export const ROUTE_LABELS: Record<string, string> = {
  COMPOSITE: "Composite (world average)",
  SHA_RTM: "Shanghai → Rotterdam",
  SHA_GOA: "Shanghai → Genoa",
  SHA_LAX: "Shanghai → Los Angeles",
  SHA_NYC: "Shanghai → New York",
  RTM_SHA: "Rotterdam → Shanghai",
  LAX_SHA: "Los Angeles → Shanghai",
};

export function routeLabel(code: string | null | undefined): string {
  if (!code) return "Unknown lane";
  return ROUTE_LABELS[code] ?? code;
}
