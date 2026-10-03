/**
 * USD → THB, for showing freight figures in the currency a Thai forwarder
 * actually thinks in.
 *
 * Frankfurter (ECB reference rates) needs no API key and has no rate limit
 * posture worth worrying about, but calling it on every dashboard render
 * would still be one outbound request per page view for a number that only
 * moves once a day. The in-memory cache below is a plain module-level
 * variable rather than a database table on purpose: this value is a display
 * convenience, not a record anything downstream depends on, so there is
 * nothing here worth surviving a server restart.
 */

import { describeError } from "./http";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // Refetch at most 4 times a day.

interface RateCache {
  rate: number;
  fetchedAt: number;
}

let cache: RateCache | null = null;

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * The current USD→THB rate, or `null` if Frankfurter is unreachable.
 *
 * Returning `null` instead of throwing matters here: this value only ever
 * decorates a figure that is already shown in USD, so a forwarder who
 * already knows the dollar number should not lose the whole page over a
 * currency lookup that failed.
 */
export async function fetchUsdThbRate(): Promise<number | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rate;
  }

  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=THB", {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = (await response.json()) as FrankfurterResponse;
    const rate = body.rates?.THB;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("response had no usable THB rate");
    }

    cache = { rate, fetchedAt: Date.now() };
    return rate;
  } catch (error) {
    // A stale cached rate is still a better display number than nothing, as
    // long as it is not absurdly old.
    if (cache && Date.now() - cache.fetchedAt < 48 * 60 * 60 * 1000) {
      return cache.rate;
    }
    console.error("fetchUsdThbRate failed:", describeError(error));
    return null;
  }
}

/** THB amount for a USD figure, rounded to whole baht for display. */
export function usdToThb(usd: number, rate: number): number {
  return Math.round(usd * rate);
}
