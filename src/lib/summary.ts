/**
 * The executive market summary shown at the top of the dashboard.
 *
 * Generated from rules over the data, not from a language model. A forwarder
 * forwards these bullets to a client, so every line has to be traceable to a
 * number in the database and reproducible on demand — and it costs nothing
 * and cannot hallucinate a port closure.
 */

import type { IndexMetrics } from "./metrics";
import { RISK_LABELS, type RiskLevelKey } from "./risk";

export type SummaryTone = "neutral" | "positive" | "warning" | "critical";

export interface SummaryBullet {
  id: string;
  tone: SummaryTone;
  text: string;
}

export interface IndexSummaryInput {
  indexCode: string;
  label: string;
  unit: string;
  metrics: IndexMetrics;
}

export interface PortSummaryInput {
  name: string;
  avgWaitDays: number;
  riskLevel: RiskLevelKey;
}

export interface SummaryInput {
  indices: IndexSummaryInput[];
  ports: PortSummaryInput[];
  alertCount7d: number;
  topAlertHeadline?: string | null;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatValue(value: number, unit: string): string {
  if (unit === "USD_PER_FEU") return `$${Math.round(value).toLocaleString("en-US")}/FEU`;
  if (unit === "USD") return `$${value.toFixed(2)}`;
  return `${Math.round(value).toLocaleString("en-US")} pts`;
}

/**
 * Three to four bullets, ordered by what a coordinator needs to know first:
 * what the market did, what is blocked, what is unusual, and what we are
 * missing. Returns a single explanatory line when there is no data at all,
 * rather than an empty banner.
 */
export function buildMarketSummary(input: SummaryInput): SummaryBullet[] {
  const bullets: SummaryBullet[] = [];
  const withData = input.indices.filter((i) => i.metrics.latest !== null);

  // 1. The biggest rate move this week.
  const movers = withData
    .filter((i) => i.metrics.wowPct !== null)
    .sort((a, b) => Math.abs(b.metrics.wowPct!) - Math.abs(a.metrics.wowPct!));

  if (movers.length > 0) {
    const top = movers[0];
    const pct = top.metrics.wowPct!;
    const direction = pct >= 0 ? "rose" : "fell";
    bullets.push({
      id: "top-mover",
      tone: Math.abs(pct) >= 10 ? "warning" : "neutral",
      text: `${top.label} ${direction} ${formatPct(pct)} week on week to ${formatValue(
        top.metrics.latest!.value,
        top.unit,
      )}.`,
    });
  } else if (withData.length > 0) {
    const first = withData[0];
    bullets.push({
      id: "single-reading",
      tone: "neutral",
      text: `${first.label} stands at ${formatValue(first.metrics.latest!.value, first.unit)}; no prior week to compare against yet.`,
    });
  }

  // 2. Port congestion — the worst port, named.
  const congested = [...input.ports].sort((a, b) => b.avgWaitDays - a.avgWaitDays);
  const worst = congested[0];

  if (worst) {
    if (worst.riskLevel === "HIGH") {
      const alsoHigh = congested.filter((p) => p.riskLevel === "HIGH").length - 1;
      bullets.push({
        id: "congestion",
        tone: "critical",
        text:
          `${worst.name} is waiting ${worst.avgWaitDays.toFixed(1)} days on average (${RISK_LABELS.HIGH.en} risk)` +
          (alsoHigh > 0 ? `, with ${alsoHigh} other hub${alsoHigh > 1 ? "s" : ""} also in the red.` : "."),
      });
    } else if (worst.riskLevel === "MODERATE") {
      bullets.push({
        id: "congestion",
        tone: "warning",
        text: `Worst hub wait is ${worst.name} at ${worst.avgWaitDays.toFixed(1)} days — build buffer into transit estimates.`,
      });
    } else {
      bullets.push({
        id: "congestion",
        tone: "positive",
        text: `All tracked hubs are berthing inside 2 days; ${worst.name} is the slowest at ${worst.avgWaitDays.toFixed(1)}.`,
      });
    }
  }

  // 3. Disruption alerts.
  if (input.alertCount7d > 0) {
    bullets.push({
      id: "alerts",
      tone: input.alertCount7d >= 3 ? "critical" : "warning",
      text: input.topAlertHeadline
        ? `${input.alertCount7d} disruption alert${input.alertCount7d > 1 ? "s" : ""} in the last 7 days, led by: ${input.topAlertHeadline}`
        : `${input.alertCount7d} disruption alert${input.alertCount7d > 1 ? "s" : ""} logged in the last 7 days.`,
    });
  }

  // 4. Anything statistically unusual.
  const spiking = withData.filter((i) => i.metrics.isSpike);
  if (spiking.length > 0) {
    const names = spiking.map((i) => i.label).join(", ");
    const direction = spiking[0].metrics.spikeDirection === "up" ? "above" : "below";
    bullets.push({
      id: "spike",
      tone: "warning",
      text: `${names} sits well ${direction} its 8-week average — treat quotes on these lanes as volatile.`,
    });
  }

  // 5. Honesty about coverage. A dashboard quietly showing month-old numbers
  // is worse than one that says it is month-old.
  const stale = withData.filter((i) => i.metrics.isStale);
  if (stale.length > 0) {
    bullets.push({
      id: "stale",
      tone: "warning",
      text: `${stale.map((i) => i.label).join(", ")} ${stale.length > 1 ? "have" : "has"} not updated in over a week — figures may be out of date.`,
    });
  }

  if (bullets.length === 0) {
    return [
      {
        id: "empty",
        tone: "neutral",
        text: "No market data ingested yet. Run the index job or enter this week's figures manually.",
      },
    ];
  }

  return bullets.slice(0, 4);
}
