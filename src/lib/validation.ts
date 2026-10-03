/**
 * Request schemas for the write endpoints.
 *
 * The client runs the same AHP code the server does, but the server never
 * trusts the client's *result* — only its inputs, validated here, and then
 * recomputes. Otherwise anyone could POST a decision log claiming any winner.
 */

import { z } from "zod";

import { CRITERIA, SAATY_MAX, SAATY_MIN } from "./ahp";

export const carrierQuoteSchema = z.object({
  id: z.string().min(1).optional(),
  carrierName: z.string().min(1, "Carrier name is required").max(120),
  serviceName: z.string().max(120).nullish(),

  oceanFreightUsd: z.number().finite().min(0).max(1_000_000),
  localChargesUsd: z.number().finite().min(0).max(1_000_000).default(0),
  freeTimeDays: z.number().int().min(0).max(120).default(0),
  freeTimeValuePerDayUsd: z.number().finite().min(0).max(10_000).default(0),

  transitDays: z.number().finite().min(1, "Transit must be at least a day").max(365),
  isDirect: z.boolean().default(true),
  transshipmentCount: z.number().int().min(0).max(10).default(0),

  onTimePct: z.number().finite().min(0).max(100),
  blankSailingsPerQuarter: z.number().int().min(0).max(52).default(0),

  equipmentAvailabilityScore: z.number().int().min(1).max(10).default(5),
  bookingSlaHours: z.number().int().min(1).max(720).default(24),

  docTurnaroundHours: z.number().int().min(1).max(720).default(24),
  serviceScore: z.number().int().min(1).max(10).default(5),

  containerType: z.string().max(20).default("40HC"),
  validUntil: z.coerce.date().nullish(),
});

export type CarrierQuotePayload = z.infer<typeof carrierQuoteSchema>;

/** A Saaty judgment: any positive ratio inside 1/9 … 9. */
const saatyValue = z
  .number()
  .finite()
  .min(SAATY_MIN, `Comparisons cannot be weaker than 1/9`)
  .max(SAATY_MAX, `Comparisons cannot be stronger than 9`);

/**
 * Only the upper triangle is accepted. Taking the lower half too would let a
 * caller submit a matrix that is not reciprocal, which has no valid
 * eigenvector interpretation.
 */
export const pairwiseSchema = z.record(z.string(), saatyValue);

export const ahpEvaluateSchema = z.object({
  title: z.string().min(1, "Give the decision a title").max(200),
  presetKey: z.string().max(60).nullish(),
  originLocode: z.string().max(10).nullish(),
  destLocode: z.string().max(10).nullish(),
  routeCode: z.string().max(30).nullish(),
  notes: z.string().max(5_000).nullish(),

  pairwise: pairwiseSchema,

  quotes: z
    .array(carrierQuoteSchema)
    .min(2, "Compare at least two carriers")
    .max(5, "Compare at most five carriers"),

  /** Persist the result. False gives a preview without writing a log. */
  save: z.boolean().default(true),
});

export type AHPEvaluatePayload = z.infer<typeof ahpEvaluateSchema>;

export const manualIndexSchema = z.object({
  indexCode: z.enum(["WCI", "SCFI", "BDRY", "WTI", "BRENT", "ZIM"]),
  routeCode: z.string().min(1).max(30).default("COMPOSITE"),
  periodDate: z.coerce.date(),
  value: z.number().finite().positive().max(100_000),
  unit: z.enum(["USD_PER_FEU", "POINTS", "USD"]),
});

export const portStatusSchema = z.object({
  unlocode: z.string().min(3).max(10),
  observedOn: z.coerce.date(),
  avgWaitDays: z.number().finite().min(0).max(60),
  vesselsWaiting: z.number().int().min(0).max(1_000).nullish(),
  note: z.string().max(500).nullish(),
});

export const portStatusImportSchema = z.object({
  rows: z.array(portStatusSchema).min(1).max(500),
});

/** Flatten a ZodError into `field -> message` for form display. */
export function formatZodIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/** Guard against pair keys that name criteria we do not have. */
export function assertKnownCriteria(pairwise: Record<string, number>): string[] {
  const known = new Set<string>(CRITERIA);
  const unknown: string[] = [];

  for (const key of Object.keys(pairwise)) {
    const [a, b] = key.split(":");
    if (!known.has(a) || !known.has(b)) unknown.push(key);
  }

  return unknown;
}
