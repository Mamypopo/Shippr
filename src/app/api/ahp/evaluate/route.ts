import { computeAHP } from "@/lib/ahp";
import { isAuthFailure, requireAuth } from "@/lib/auth";
import { perFeuRate, quotesToAlternatives, type QuoteInput } from "@/lib/cost";
import { compareToMarket } from "@/lib/benchmark";
import { prisma } from "@/lib/db";
import { getBenchmarkForRoute } from "@/lib/queries";
import { ahpEvaluateSchema, assertKnownCriteria, formatZodIssues } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

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
  const benchmarkSnapshot = benchmark
    ? {
        capturedAt: new Date().toISOString(),
        indexCode: "WCI",
        routeCode: benchmark.routeCode,
        isFallbackLane: benchmark.isFallback,
        marketUsdPerFeu: benchmark.value,
        marketPeriodDate: benchmark.periodDate.toISOString(),
        quotes: quotes.map((quote) => ({
          id: quote.id,
          carrierName: quote.carrierName,
          ...compareToMarket(perFeuRate(quote), benchmark.value, {
            routeCode: benchmark.routeCode,
            marketPeriodDate: benchmark.periodDate,
          }),
        })),
      }
    : null;

  const winner = result.ranking[0];

  if (!payload.save) {
    return Response.json({ saved: false, result, benchmarkSnapshot });
  }

  /**
   * An inconsistent matrix is still recorded — refusing to save would lose
   * the user's work and the reason it was rejected. `isConsistent` is stored
   * alongside it, and the memo view marks such a decision clearly.
   */
  const decision = await prisma.aHPDecisionLog.create({
    data: {
      userId: auth.user.id,
      title: payload.title,
      presetKey: payload.presetKey ?? null,
      originLocode: payload.originLocode ?? null,
      destLocode: payload.destLocode ?? null,
      routeCode: payload.routeCode ?? null,
      notes: payload.notes ?? null,

      criteriaMatrix: result.matrix as unknown as Prisma.InputJsonValue,
      criteriaWeights: result.weights as unknown as Prisma.InputJsonValue,
      lambdaMax: result.lambdaMax,
      consistencyIndex: result.consistencyIndex,
      consistencyRatio: result.consistencyRatio,
      isConsistent: result.isConsistent,
      alternativeScores: result.ranking as unknown as Prisma.InputJsonValue,
      winnerCarrier: winner?.label ?? "",
      benchmarkSnapshot: (benchmarkSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,

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
