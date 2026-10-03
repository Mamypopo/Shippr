import ExcelJS from "exceljs";

import { CRITERIA, CRITERION_LABELS, type CriterionKey } from "@/lib/ahp";
import { prisma, toNumber } from "@/lib/db";
import type { RankedAlternative } from "@/lib/ahp";

export const maxDuration = 60;

/**
 * Export a decision memo as JSON or XLSX.
 *
 * PDF is deliberately absent: the memo route carries a print stylesheet, so
 * the browser's own "save as PDF" produces the document without shipping a
 * headless Chromium into the serverless bundle.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const format = (new URL(request.url).searchParams.get("format") ?? "json").toLowerCase();

  const decision = await prisma.aHPDecisionLog.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "asc" } } },
  });

  if (!decision) {
    return Response.json({ error: "No decision with that id." }, { status: 404 });
  }

  if (format === "json") {
    return new Response(JSON.stringify(decision, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="decision-${id}.json"`,
      },
    });
  }

  if (format !== "xlsx") {
    return Response.json({ error: 'Supported formats are "json" and "xlsx".' }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Shippr";
  workbook.created = decision.createdAt;

  // --- Summary -------------------------------------------------------------
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 60 },
  ];
  summary.addRows([
    { field: "Decision", value: decision.title },
    { field: "Recommended carrier", value: decision.winnerCarrier },
    { field: "Decided on", value: decision.createdAt.toISOString().slice(0, 10) },
    { field: "Lane", value: decision.routeCode ?? "—" },
    { field: "Cargo preset", value: decision.presetKey ?? "Custom" },
    { field: "Consistency ratio (CR)", value: decision.consistencyRatio.toFixed(4) },
    {
      field: "Judgments consistent",
      value: decision.isConsistent ? "Yes (CR < 0.10)" : "NO — CR at or above 0.10",
    },
    { field: "Principal eigenvalue", value: decision.lambdaMax.toFixed(4) },
    { field: "Notes", value: decision.notes ?? "" },
  ]);
  summary.getRow(1).font = { bold: true };

  // --- Criteria weights ----------------------------------------------------
  const weightsSheet = workbook.addWorksheet("Criteria weights");
  weightsSheet.columns = [
    { header: "Criterion", key: "criterion", width: 28 },
    { header: "Weight", key: "weight", width: 14 },
    { header: "Weight %", key: "pct", width: 14 },
  ];
  const weights = (decision.criteriaWeights ?? {}) as Record<string, number>;
  for (const key of CRITERIA) {
    const weight = weights[key] ?? 0;
    weightsSheet.addRow({
      criterion: CRITERION_LABELS[key].en,
      weight: Number(weight.toFixed(6)),
      pct: `${(weight * 100).toFixed(1)}%`,
    });
  }
  weightsSheet.getRow(1).font = { bold: true };

  // --- Ranking -------------------------------------------------------------
  const rankingSheet = workbook.addWorksheet("Ranking");
  rankingSheet.columns = [
    { header: "Rank", key: "rank", width: 8 },
    { header: "Carrier", key: "label", width: 34 },
    { header: "Score (0-100)", key: "score", width: 16 },
    ...CRITERIA.map((key) => ({ header: CRITERION_LABELS[key].en, key, width: 20 })),
  ];

  const ranking = (decision.alternativeScores ?? []) as unknown as RankedAlternative<CriterionKey>[];
  for (const entry of ranking) {
    rankingSheet.addRow({
      rank: entry.rank,
      label: entry.label,
      score: Number(entry.score100?.toFixed(1) ?? 0),
      ...Object.fromEntries(
        CRITERIA.map((key) => [key, Number((entry.localScores?.[key] ?? 0).toFixed(4))]),
      ),
    });
  }
  rankingSheet.getRow(1).font = { bold: true };

  // --- Quotations ----------------------------------------------------------
  const quotesSheet = workbook.addWorksheet("Quotations");
  quotesSheet.columns = [
    { header: "Carrier", key: "carrierName", width: 24 },
    { header: "Service", key: "serviceName", width: 18 },
    { header: "Ocean freight (USD)", key: "oceanFreightUsd", width: 20 },
    { header: "Local charges (USD)", key: "localChargesUsd", width: 20 },
    { header: "Free time (days)", key: "freeTimeDays", width: 16 },
    { header: "Free day value (USD)", key: "freeTimeValuePerDayUsd", width: 20 },
    { header: "Transit (days)", key: "transitDays", width: 14 },
    { header: "Direct", key: "isDirect", width: 10 },
    { header: "Transshipments", key: "transshipmentCount", width: 16 },
    { header: "On-time %", key: "onTimePct", width: 12 },
    { header: "Blank sailings / qtr", key: "blankSailingsPerQuarter", width: 20 },
    { header: "Equipment (1-10)", key: "equipmentAvailabilityScore", width: 18 },
    { header: "Booking SLA (hrs)", key: "bookingSlaHours", width: 18 },
    { header: "Doc turnaround (hrs)", key: "docTurnaroundHours", width: 20 },
    { header: "Service (1-10)", key: "serviceScore", width: 16 },
    { header: "Container", key: "containerType", width: 12 },
  ];

  for (const quote of decision.quotes) {
    quotesSheet.addRow({
      ...quote,
      serviceName: quote.serviceName ?? "",
      oceanFreightUsd: toNumber(quote.oceanFreightUsd),
      localChargesUsd: toNumber(quote.localChargesUsd),
      freeTimeValuePerDayUsd: toNumber(quote.freeTimeValuePerDayUsd),
      onTimePct: toNumber(quote.onTimePct),
      isDirect: quote.isDirect ? "Yes" : "No",
    });
  }
  quotesSheet.getRow(1).font = { bold: true };

  // --- Market benchmark ----------------------------------------------------
  if (decision.benchmarkSnapshot) {
    const snapshot = decision.benchmarkSnapshot as Record<string, unknown>;
    const sheet = workbook.addWorksheet("Market benchmark");
    sheet.columns = [
      { header: "Carrier", key: "carrierName", width: 24 },
      { header: "Quote (USD/FEU)", key: "quoteUsd", width: 18 },
      { header: "Market (USD/FEU)", key: "marketUsd", width: 18 },
      { header: "Delta (USD)", key: "deltaUsd", width: 14 },
      { header: "Delta %", key: "deltaPct", width: 12 },
      { header: "Verdict", key: "verdict", width: 18 },
    ];

    const entries = (snapshot.quotes ?? []) as Array<Record<string, unknown>>;
    for (const entry of entries) {
      sheet.addRow({
        carrierName: entry.carrierName,
        quoteUsd: entry.quoteUsd,
        marketUsd: entry.marketUsd,
        deltaUsd: entry.deltaUsd,
        deltaPct:
          typeof entry.deltaPct === "number" ? `${entry.deltaPct.toFixed(1)}%` : "",
        verdict: entry.verdict,
      });
    }
    sheet.getRow(1).font = { bold: true };

    sheet.addRow({});
    sheet.addRow({
      carrierName: "Market reading taken",
      quoteUsd: String(snapshot.marketPeriodDate ?? "").slice(0, 10),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeTitle = decision.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "decision";

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeTitle}-${id.slice(0, 8)}.xlsx"`,
    },
  });
}
