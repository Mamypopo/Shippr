/**
 * Turning a carrier quotation into the numbers the AHP engine ranks on.
 *
 * Kept free of Prisma types so it can be unit-tested and reused on the client
 * while the user is still typing, before anything is persisted.
 */

import type { Alternative, CriterionKey } from "./ahp";

export interface QuoteInput {
  id: string;
  carrierName: string;
  serviceName?: string | null;

  oceanFreightUsd: number;
  localChargesUsd: number;
  /** Detention/demurrage free days the carrier grants. */
  freeTimeDays: number;
  /** What one free day is worth to this shipper, in USD. */
  freeTimeValuePerDayUsd: number;

  transitDays: number;
  isDirect: boolean;
  transshipmentCount: number;

  onTimePct: number;
  blankSailingsPerQuarter: number;

  equipmentAvailabilityScore: number; // 1-10
  bookingSlaHours: number;

  docTurnaroundHours: number;
  serviceScore: number; // 1-10
}

export interface CostBreakdown {
  oceanFreightUsd: number;
  localChargesUsd: number;
  grossCostUsd: number;
  /** Monetary value of the free time granted. */
  freeTimeCreditUsd: number;
  /** What the shipper actually bears once free time is priced in. */
  effectiveCostUsd: number;
}

/**
 * A headline rate is not comparable across carriers on its own: fourteen free
 * days at Laem Chabang is worth real money against a seven-day offer that
 * looks $80 cheaper. Free time is credited so the AHP compares like with like.
 */
export function computeCost(quote: QuoteInput): CostBreakdown {
  const oceanFreightUsd = Math.max(0, quote.oceanFreightUsd || 0);
  const localChargesUsd = Math.max(0, quote.localChargesUsd || 0);
  const grossCostUsd = oceanFreightUsd + localChargesUsd;

  const freeTimeCreditUsd = Math.max(
    0,
    (quote.freeTimeDays || 0) * (quote.freeTimeValuePerDayUsd || 0),
  );

  // Floored at 1: a credit that wipes out the whole rate would make the
  // cost criterion unrankable (ideal-mode scoring needs positive values),
  // and a genuinely free shipment is not a case this tool needs to model.
  const effectiveCostUsd = Math.max(1, grossCostUsd - freeTimeCreditUsd);

  return {
    oceanFreightUsd,
    localChargesUsd,
    grossCostUsd,
    freeTimeCreditUsd,
    effectiveCostUsd,
  };
}

/**
 * Effective transit, penalised for transshipment.
 *
 * A quoted 30-day direct and a quoted 30-day two-leg transshipment do not
 * carry the same risk of slipping, so each transshipment adds a day of
 * expected delay to the figure the AHP ranks on. The raw quoted number is
 * still what the UI displays.
 */
export const TRANSSHIPMENT_DAY_PENALTY = 1;

export function effectiveTransitDays(quote: QuoteInput): number {
  const base = Math.max(0.5, quote.transitDays || 0);
  const legs = quote.isDirect ? 0 : Math.max(quote.transshipmentCount, 1);
  return base + legs * TRANSSHIPMENT_DAY_PENALTY;
}

/**
 * Reliability as a single figure: on-time percentage, discounted by how often
 * the service is cancelled outright. A 90% on-time service that blanks three
 * sailings a quarter is not more dependable than an 85% one that never does.
 */
export const BLANK_SAILING_PENALTY_PCT = 3;

export function reliabilityScore(quote: QuoteInput): number {
  const onTime = Math.min(100, Math.max(0, quote.onTimePct || 0));
  const penalty = Math.max(0, quote.blankSailingsPerQuarter || 0) * BLANK_SAILING_PENALTY_PCT;
  return Math.max(1, onTime - penalty);
}

/**
 * Space and equipment: the 1-10 judgment of empty availability, pulled down
 * when the carrier is slow to confirm a booking. An SLA at or under 24 hours
 * is treated as the benchmark and costs nothing.
 */
export const BOOKING_SLA_BASELINE_HOURS = 24;

export function availabilityScore(quote: QuoteInput): number {
  const base = clamp(quote.equipmentAvailabilityScore || 0, 1, 10);
  const overdueDays = Math.max(0, (quote.bookingSlaHours || 0) - BOOKING_SLA_BASELINE_HOURS) / 24;
  return Math.max(1, base - overdueDays);
}

/**
 * Service and documentation: the 1-10 judgment, pulled down by slow draft B/L
 * turnaround. Late documents mean amendment fees and cargo sitting at the port.
 */
export const DOC_TURNAROUND_BASELINE_HOURS = 24;

export function serviceScore(quote: QuoteInput): number {
  const base = clamp(quote.serviceScore || 0, 1, 10);
  const overdueDays =
    Math.max(0, (quote.docTurnaroundHours || 0) - DOC_TURNAROUND_BASELINE_HOURS) / 24;
  return Math.max(1, base - overdueDays);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Map a quotation onto the five AHP criteria. */
export function quoteToAlternative(quote: QuoteInput): Alternative<CriterionKey> {
  return {
    id: quote.id,
    label: quote.serviceName
      ? `${quote.carrierName} — ${quote.serviceName}`
      : quote.carrierName,
    values: {
      cost: computeCost(quote).effectiveCostUsd,
      transitTime: effectiveTransitDays(quote),
      reliability: reliabilityScore(quote),
      availability: availabilityScore(quote),
      service: serviceScore(quote),
    },
  };
}

export function quotesToAlternatives(quotes: QuoteInput[]): Alternative<CriterionKey>[] {
  return quotes.map(quoteToAlternative);
}

/** USD per FEU, for comparing against a market index quoted in USD/FEU. */
export function perFeuRate(quote: QuoteInput, containersFeu = 1): number {
  const feu = containersFeu > 0 ? containersFeu : 1;
  return computeCost(quote).grossCostUsd / feu;
}
