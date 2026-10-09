/**
 * A categorical read of the market — Demand / Supply / Freight Rate /
 * Geopolitical / Weather / Route disruption — and what that implies for a
 * shipment (Market Impact). Rule-based over data already in the system, the
 * same way `summary.ts`'s bullets are: no AI, no new data entry, every band
 * traceable to a number.
 *
 * This is deliberately a heuristic reading of the signals this system
 * actually has (freight-rate trend, port congestion, tagged disruption
 * news) — not a claim to true demand/supply statistics, which would need
 * booking-volume or vessel-deployment data this system doesn't have. The
 * point is a consistent, explainable band, not a forecast.
 */

import type { RiskLevelKey } from "./risk";

export type Level = "LOW" | "NORMAL" | "HIGH";
export type SupplyLevel = "EXCESS" | "NORMAL" | "TIGHT";

export interface MarketSituationInput {
  /** Week-over-week change of the best-available freight rate index (WCI preferred, SCFI fallback). Null if neither has two readings yet. */
  rateWowPct: number | null;
  rateLabel: string | null;
  /** Current risk band of every hub port with a recent reading. */
  portRiskLevels: RiskLevelKey[];
  /** Counts of ALERT/WATCH-severity news carrying each tag, within the lookback window. */
  newsCounts: {
    geopolitics: number;
    weather: number;
    chokepoint: number;
    capacity: number;
  };
}

export interface MarketImpact {
  freightRateRisk: Level;
  capacitySpaceRisk: Level;
  transitTimeRisk: Level;
  scheduleRisk: Level;
}

export interface MarketSituation {
  demand: Level;
  supply: SupplyLevel;
  freightRate: { level: Level; wowPct: number | null; label: string | null };
  geopoliticalRisk: Level;
  weatherRisk: Level;
  routeDisruption: Level;
  impact: MarketImpact;
  /** One sentence per Market Impact field, naming the factor(s) that actually drove it — a level with no visible cause isn't actionable. */
  impactReasons: Record<keyof MarketImpact, string>;
}

function countByLevel(count: number, highAt: number): Level {
  if (count >= highAt) return "HIGH";
  if (count === 0) return "LOW";
  return "NORMAL";
}

export function assessMarketSituation(input: MarketSituationInput): MarketSituation {
  const highPortCount = input.portRiskLevels.filter((r) => r === "HIGH").length;
  const moderateOrAbovePortCount = input.portRiskLevels.filter((r) => r !== "LOW").length;

  const rateLevel: Level =
    input.rateWowPct === null ? "NORMAL" : input.rateWowPct >= 5 ? "HIGH" : input.rateWowPct <= -5 ? "LOW" : "NORMAL";

  const demand: Level =
    rateLevel === "HIGH" || highPortCount > 0
      ? "HIGH"
      : rateLevel === "LOW" && moderateOrAbovePortCount === 0
        ? "LOW"
        : "NORMAL";

  const supply: SupplyLevel =
    input.newsCounts.capacity >= 2 || highPortCount > 0
      ? "TIGHT"
      : input.newsCounts.capacity === 0 && moderateOrAbovePortCount === 0
        ? "EXCESS"
        : "NORMAL";

  const geopoliticalRisk = countByLevel(input.newsCounts.geopolitics, 2);
  const weatherRisk = countByLevel(input.newsCounts.weather, 2);
  const routeDisruption: Level =
    input.newsCounts.chokepoint >= 2 || highPortCount > 0
      ? "HIGH"
      : input.newsCounts.chokepoint === 0 && moderateOrAbovePortCount === 0
        ? "LOW"
        : "NORMAL";

  const freightRateRisk: Level =
    rateLevel === "HIGH" || (demand === "HIGH" && supply === "TIGHT") ? "HIGH" : rateLevel === "LOW" ? "LOW" : "NORMAL";

  const capacitySpaceRisk: Level = supply === "TIGHT" ? "HIGH" : supply === "EXCESS" ? "LOW" : "NORMAL";

  const transitTimeRisk: Level =
    routeDisruption === "HIGH" || weatherRisk === "HIGH"
      ? "HIGH"
      : routeDisruption === "LOW" && weatherRisk === "LOW"
        ? "LOW"
        : "NORMAL";

  const scheduleRisk: Level =
    supply === "TIGHT" || routeDisruption === "HIGH" ? "HIGH" : routeDisruption === "LOW" ? "LOW" : "NORMAL";

  const impactReasons: Record<keyof MarketImpact, string> = {
    freightRateRisk:
      rateLevel === "HIGH"
        ? `ค่าระวางขยับขึ้น ${input.rateWowPct?.toFixed(1)}% เทียบสัปดาห์ก่อน`
        : demand === "HIGH" && supply === "TIGHT"
          ? "Demand สูงพร้อมกับ Supply ตึงตัว"
          : rateLevel === "LOW"
            ? `ค่าระวางลดลง ${input.rateWowPct?.toFixed(1)}% เทียบสัปดาห์ก่อน`
            : "ค่าระวางเคลื่อนไหวในช่วงปกติ",
    capacitySpaceRisk:
      supply === "TIGHT"
        ? highPortCount > 0
          ? "มีท่าเรือแออัดหนักอยู่ในกลุ่มที่ติดตาม"
          : `มีข่าวยกเลิกเที่ยวเรือ (CAPACITY) ${input.newsCounts.capacity} รายการในช่วงที่ติดตาม`
        : supply === "EXCESS"
          ? "ไม่มีสัญญาณขาดแคลนระวางหรือท่าเรือแออัด"
          : "ยังไม่มีสัญญาณชัดเจนทั้งสองทาง",
    transitTimeRisk:
      routeDisruption === "HIGH" && weatherRisk === "HIGH"
        ? "ทั้งเส้นทาง/ท่าเรือติดขัดและสภาพอากาศเป็นความเสี่ยงพร้อมกัน"
        : routeDisruption === "HIGH"
          ? "มีความเสี่ยงเส้นทาง/ท่าเรือติดขัดจากข่าวหรือความแออัด"
          : weatherRisk === "HIGH"
            ? "มีข่าวสภาพอากาศความเสี่ยงสูงซ้ำกันหลายรายการ"
            : routeDisruption === "LOW" && weatherRisk === "LOW"
              ? "ไม่มีข่าวเส้นทางติดขัดหรือสภาพอากาศผิดปกติ"
              : "มีสัญญาณบางส่วน ยังไม่ถึงระดับสูง",
    scheduleRisk:
      supply === "TIGHT" && routeDisruption === "HIGH"
        ? "ทั้งระวางตึงตัวและเส้นทางติดขัดพร้อมกัน"
        : supply === "TIGHT"
          ? "ระวางตึงตัว ซึ่งมักมาพร้อมการยกเลิก/ปรับตารางเที่ยวเรือ"
          : routeDisruption === "HIGH"
            ? "เส้นทาง/ท่าเรือติดขัด ซึ่งมักทำให้ตารางเรือคลาดเคลื่อน"
            : routeDisruption === "LOW"
              ? "ไม่มีสัญญาณที่จะทำให้ตารางเรือคลาดเคลื่อน"
              : "มีสัญญาณบางส่วน ยังไม่ถึงระดับสูง",
  };

  return {
    demand,
    supply,
    freightRate: { level: rateLevel, wowPct: input.rateWowPct, label: input.rateLabel },
    geopoliticalRisk,
    weatherRisk,
    routeDisruption,
    impact: { freightRateRisk, capacitySpaceRisk, transitTimeRisk, scheduleRisk },
    impactReasons,
  };
}

export const LEVEL_LABELS: Record<Level, string> = { LOW: "ต่ำ", NORMAL: "ปกติ", HIGH: "สูง" };
export const SUPPLY_LABELS: Record<SupplyLevel, string> = {
  EXCESS: "เหลือ",
  NORMAL: "ปกติ",
  TIGHT: "ตึงตัว",
};
