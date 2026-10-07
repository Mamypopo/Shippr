/**
 * Why the top-ranked carrier won, and its own Risk Alert — shared by the live
 * workspace and the save route, so the number frozen into a decision log is
 * never computed by a second implementation that could quietly disagree
 * with what the person saw on screen before saving.
 */

import type { CriterionKey, RankedAlternative } from "./ahp";
import { CRITERION_LABELS } from "./ahp";
import type { BenchmarkResult } from "./benchmark";
import type { Level, MarketImpact } from "./market-situation";

const LEVEL_ORDER: Record<Level, number> = { LOW: 0, NORMAL: 1, HIGH: 2 };
function worseOf(a: Level, b: Level): Level {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

export interface RecommendationQuoteInput {
  id: string;
  blankSailingsPerQuarter: number;
  isDirect: boolean;
  transitDays: number;
}

export interface RecommendationInput {
  ranking: RankedAlternative<CriterionKey>[];
  benchmarks: Record<string, BenchmarkResult | null>;
  quotes: RecommendationQuoteInput[];
  marketImpact: MarketImpact;
}

export interface RecommendationResult {
  winnerId: string | null;
  /** Criterion labels (Thai) where the winner beat the runner-up by a clear margin. */
  reasons: string[];
  /** This carrier's own Risk Alert — the ambient Market Impact, escalated by quote-specific signals. */
  risk: MarketImpact;
}

const SCORE_MARGIN = 0.05;
const TRANSIT_DAYS_ESCALATION_RATIO = 1.2;

export function buildRecommendation(input: RecommendationInput): RecommendationResult {
  const winner = input.ranking[0];
  const runnerUp = input.ranking[1];

  if (!winner) {
    return { winnerId: null, reasons: [], risk: input.marketImpact };
  }

  const reasons = runnerUp
    ? (Object.keys(winner.localScores) as CriterionKey[])
        .map((key) => ({ key, diff: winner.localScores[key] - runnerUp.localScores[key] }))
        .filter((r) => r.diff > SCORE_MARGIN)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 2)
        .map((r) => CRITERION_LABELS[r.key].th)
    : [];

  const winnerQuote = input.quotes.find((q) => q.id === winner.id);
  const winnerBenchmark = input.benchmarks[winner.id];
  const minTransitDays =
    input.quotes.length > 0 ? Math.min(...input.quotes.map((q) => q.transitDays)) : null;

  const freightRateRisk: Level =
    winnerBenchmark?.verdict === "ABOVE_MARKET"
      ? worseOf(input.marketImpact.freightRateRisk, "HIGH")
      : input.marketImpact.freightRateRisk;

  const capacitySpaceRisk: Level =
    winnerQuote && winnerQuote.blankSailingsPerQuarter > 0
      ? worseOf(input.marketImpact.capacitySpaceRisk, "NORMAL")
      : input.marketImpact.capacitySpaceRisk;

  const transitTimeRisk: Level =
    winnerQuote && minTransitDays !== null && winnerQuote.transitDays > minTransitDays * TRANSIT_DAYS_ESCALATION_RATIO
      ? worseOf(input.marketImpact.transitTimeRisk, "NORMAL")
      : input.marketImpact.transitTimeRisk;

  const scheduleRisk: Level =
    winnerQuote && (!winnerQuote.isDirect || winnerQuote.blankSailingsPerQuarter > 0)
      ? worseOf(input.marketImpact.scheduleRisk, "NORMAL")
      : input.marketImpact.scheduleRisk;

  return {
    winnerId: winner.id,
    reasons,
    risk: { freightRateRisk, capacitySpaceRisk, transitTimeRisk, scheduleRisk },
  };
}
