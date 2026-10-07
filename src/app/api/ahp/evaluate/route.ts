import { computeAHP } from "@/lib/ahp";
import { isAuthFailure, requireAuth } from "@/lib/auth";
import { compareToMarket, routeLabel, type BenchmarkResult } from "@/lib/benchmark";
import { perFeuRate, quotesToAlternatives, type QuoteInput } from "@/lib/cost";
import { prisma } from "@/lib/db";
import { indexLabel } from "@/lib/format";
import { assessMarketSituation } from "@/lib/market-situation";
import {
  countRecentAlerts,
  getAllIndexSeries,
  getBenchmarkForRoute,
  getMarketSituationInputs,
  getPortSnapshots,
  getTopAlert,
  type IndexSeries,
} from "@/lib/queries";
import { buildRecommendation } from "@/lib/recommendation";
import { buildMarketSummary } from "@/lib/summary";
import { ahpEvaluateSchema, assertKnownCriteria, formatZodIssues } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

/** Same label shape the dashboard uses, so a bullet reads the same way in both places. */
function seriesLabel(s: IndexSeries): string {
  return s.routeCode === "COMPOSITE"
    ? indexLabel(s.indexCode)
    : `${indexLabel(s.indexCode)} ${routeLabel(s.routeCode)}`;
}

/**
 * Evaluate a carrier decision and, by default, persist it.
 *
 * The browser computes the same result live while the user adjusts sliders,
 * but the stored record is always recomputed here from the submitted inputs.
 * Accepting a client-supplied winner would make the decision log worthless as
 * an audit trail.
 *
 * Requires sign-in. The browser only ever calls this on an explicit save —
 * the live preview while dragging sliders runs entirely client-side — so
 * there is no legitimate anonymous caller, and an unguarded version of this
 * route would let anyone who found the deployment URL write decision records
 * containing real client pricing.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = ahpEvaluateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: formatZodIssues(parsed.error) },
      { status: 422 },
    );
  }

  const payload = parsed.data;

  const unknown = assertKnownCriteria(payload.pairwise);
  if (unknown.length > 0) {
    return Response.json(
      { error: `Unknown criteria in comparison keys: ${unknown.join(", ")}` },
      { status: 422 },
    );
  }

  const quotes: QuoteInput[] = payload.quotes.map((quote, index) => ({
    ...quote,
    id: quote.id ?? `quote-${index}`,
    serviceName: quote.serviceName ?? null,
  }));

  const result = computeAHP(payload.pairwise, { alternatives: quotesToAlternatives(quotes) });

  // Benchmark each quote against the market as it stands right now. The
  // snapshot is frozen into the decision log so the memo stays reproducible.
  const benchmark = await getBenchmarkForRoute(payload.routeCode);

  // Same market-situation bullets the dashboard shows, frozen at save time
  // for the same reason the benchmark is: a memo read six weeks later should
  // describe the market as it was on the day of the call, not as it is now.
  // Nothing here required new data entry — it's the same rule-based reading
  // of data already in the system (indices, port risk, disruption alerts).
  const [allSeries, ports, alertCount7d, topAlert, situationInputs] = await Promise.all([
    getAllIndexSeries(),
    getPortSnapshots(),
    countRecentAlerts(7),
    getTopAlert(7),
    getMarketSituationInputs(payload.routeCode ?? "COMPOSITE"),
  ]);
  const marketBullets = buildMarketSummary({
    indices: allSeries.map((s) => ({
      indexCode: s.indexCode,
      label: seriesLabel(s),
      unit: s.unit,
      metrics: s.metrics,
    })),
    ports: ports
      .filter((p) => p.avgWaitDays !== null && p.riskLevel !== null)
      .map((p) => ({ name: p.name, avgWaitDays: p.avgWaitDays!, riskLevel: p.riskLevel! })),
    alertCount7d,
    topAlertHeadline: topAlert?.title ?? null,
  });
  // The structured bands (Demand/Supply/Freight Rate/...) and their Market
  // Impact — the same classification the "Market Situation" panel on the
  // new-decision page shows, frozen here for the same reason as everything
  // else in this snapshot: the memo must describe the market as it was that
  // day, not as it is when read later.
  const situation = assessMarketSituation(situationInputs);

  const benchmarkByQuoteId: Record<string, BenchmarkResult | null> = {};
  for (const quote of quotes) {
    benchmarkByQuoteId[quote.id] = benchmark
      ? compareToMarket(perFeuRate(quote), benchmark.value, {
          routeCode: benchmark.routeCode,
          marketPeriodDate: benchmark.periodDate,
        })
      : null;
  }

  const benchmarkSnapshot = {
    capturedAt: new Date().toISOString(),
    indexCode: "WCI",
    routeCode: benchmark?.routeCode ?? null,
    isFallbackLane: benchmark?.isFallback ?? null,
    marketUsdPerFeu: benchmark?.value ?? null,
    marketPeriodDate: benchmark?.periodDate.toISOString() ?? null,
    quotes: benchmark
      ? quotes.map((quote) => ({
          id: quote.id,
          carrierName: quote.carrierName,
          ...benchmarkByQuoteId[quote.id],
        }))
      : [],
    marketBullets,
    alertCount7d,
    topAlertHeadline: topAlert?.title ?? null,
    situation,
    recommendation: buildRecommendation({
      ranking: result.ranking,
      benchmarks: benchmarkByQuoteId,
      quotes: quotes.map((q) => ({
        id: q.id,
        blankSailingsPerQuarter: q.blankSailingsPerQuarter,
        isDirect: q.isDirect,
        transitDays: q.transitDays,
      })),
      marketImpact: situation.impact,
    }),
  };

  const winner = result.ranking[0];

  if (!payload.save) {
    return Response.json({ saved: false, result, benchmarkSnapshot });
  }

  /**
   * An inconsistent matrix is still recorded — refusing to save would lose
   * the user's work and the reason it was rejected. `isConsistent` is stored
   * alongside it, and the memo view marks such a decision clearly.
   */
  // A case reference left blank gets a sequential label rather than staying
  // empty — "FF-001" is more useful in a list of decisions than a blank
  // column, and nobody has to think one up for a quick comparison.
  const caseId =
    payload.caseId?.trim() ||
    `FF-${String((await prisma.aHPDecisionLog.count()) + 1).padStart(3, "0")}`;

  const decision = await prisma.aHPDecisionLog.create({
    data: {
      userId: auth.user.id,
      title: payload.title,
      presetKey: payload.presetKey ?? null,
      originLocode: payload.originLocode ?? null,
      destLocode: payload.destLocode ?? null,
      routeCode: payload.routeCode ?? null,
      notes: payload.notes ?? null,

      caseId,
      equipment: payload.equipment ?? null,
      cargoDescription: payload.cargoDescription ?? null,
      quantity: payload.quantity ?? null,
      requiredEtd: payload.requiredEtd ?? null,
      scenario: payload.scenario ?? null,

      criteriaMatrix: result.matrix as unknown as Prisma.InputJsonValue,
      criteriaWeights: result.weights as unknown as Prisma.InputJsonValue,
      lambdaMax: result.lambdaMax,
      consistencyIndex: result.consistencyIndex,
      consistencyRatio: result.consistencyRatio,
      isConsistent: result.isConsistent,
      alternativeScores: result.ranking as unknown as Prisma.InputJsonValue,
      winnerCarrier: winner?.label ?? "",
      benchmarkSnapshot: benchmarkSnapshot as unknown as Prisma.InputJsonValue,

      // Persisted from the validated payload rather than the AHP-facing
      // projection: containerType and validUntil are record-keeping fields,
      // not decision criteria, so QuoteInput deliberately omits them.
      quotes: {
        create: payload.quotes.map((quote) => ({
          carrierName: quote.carrierName,
          serviceName: quote.serviceName ?? null,
          oceanFreightUsd: quote.oceanFreightUsd,
          localChargesUsd: quote.localChargesUsd,
          freeTimeDays: quote.freeTimeDays,
          freeTimeValuePerDayUsd: quote.freeTimeValuePerDayUsd,
          transitDays: Math.round(quote.transitDays),
          isDirect: quote.isDirect,
          transshipmentCount: quote.transshipmentCount,
          onTimePct: quote.onTimePct,
          blankSailingsPerQuarter: quote.blankSailingsPerQuarter,
          equipmentAvailabilityScore: quote.equipmentAvailabilityScore,
          bookingSlaHours: quote.bookingSlaHours,
          docTurnaroundHours: quote.docTurnaroundHours,
          serviceScore: quote.serviceScore,
          containerType: quote.containerType,
          validUntil: quote.validUntil ?? null,
        })),
      },
    },
    select: { id: true },
  });

  return Response.json(
    { saved: true, decisionId: decision.id, result, benchmarkSnapshot },
    { status: 201 },
  );
}
