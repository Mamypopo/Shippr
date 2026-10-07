import type { Level, MarketSituation, SupplyLevel } from "@/lib/market-situation";
import { LEVEL_LABELS, SUPPLY_LABELS } from "@/lib/market-situation";

function levelColor(level: Level): string {
  if (level === "HIGH") return "var(--color-bad)";
  if (level === "LOW") return "var(--color-ok)";
  return "var(--color-ink-faint)";
}

function supplyColor(level: SupplyLevel): string {
  if (level === "TIGHT") return "var(--color-bad)";
  if (level === "EXCESS") return "var(--color-ok)";
  return "var(--color-ink-faint)";
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border-t border-line p-3 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <p className="label">{label}</p>
      <p className="mt-1 text-small font-medium" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Demand / Supply / Freight Rate / Geopolitical / Weather / Route-disruption
 * bands, plus the Market Impact they imply — shown both on the dashboard and
 * at the top of a new decision, so "the market changed" visibly precedes
 * "here's the AHP ranking" rather than sitting in a separate tab.
 *
 * Not an AHP criterion: this never feeds the pairwise matrix. It is context
 * a person reads before comparing carriers, not a sixth thing being weighed.
 */
export function MarketSituationPanel({ situation }: { situation: MarketSituation }) {
  const { demand, supply, freightRate, geopoliticalRisk, weatherRisk, routeDisruption, impact } = situation;

  return (
    <section className="panel" aria-label="สถานการณ์ตลาด">
      <div className="border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">สถานการณ์ตลาด</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3">
        <Badge label="Demand" value={LEVEL_LABELS[demand]} color={levelColor(demand)} />
        <Badge label="Supply / Vessel Capacity" value={SUPPLY_LABELS[supply]} color={supplyColor(supply)} />
        <Badge
          label={`Freight Rate${freightRate.label ? ` (${freightRate.label})` : ""}`}
          value={
            freightRate.wowPct !== null
              ? `${LEVEL_LABELS[freightRate.level]} (${freightRate.wowPct > 0 ? "+" : ""}${freightRate.wowPct.toFixed(1)}% WoW)`
              : LEVEL_LABELS[freightRate.level]
          }
          color={levelColor(freightRate.level)}
        />
        <Badge label="Geopolitical Risk" value={LEVEL_LABELS[geopoliticalRisk]} color={levelColor(geopoliticalRisk)} />
        <Badge label="Weather Risk" value={LEVEL_LABELS[weatherRisk]} color={levelColor(weatherRisk)} />
        <Badge label="Route / Port Disruption" value={LEVEL_LABELS[routeDisruption]} color={levelColor(routeDisruption)} />
      </div>

      <div className="border-t-2 border-ink px-4 py-2.5">
        <h3 className="text-small font-medium">Market Impact</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        <Badge label="Freight Rate Risk" value={LEVEL_LABELS[impact.freightRateRisk]} color={levelColor(impact.freightRateRisk)} />
        <Badge label="Capacity / Space Risk" value={LEVEL_LABELS[impact.capacitySpaceRisk]} color={levelColor(impact.capacitySpaceRisk)} />
        <Badge label="Transit Time Risk" value={LEVEL_LABELS[impact.transitTimeRisk]} color={levelColor(impact.transitTimeRisk)} />
        <Badge label="Schedule Risk" value={LEVEL_LABELS[impact.scheduleRisk]} color={levelColor(impact.scheduleRisk)} />
      </div>

      <p className="border-t border-line px-4 py-2.5 text-micro leading-relaxed text-ink-faint">
        สรุปจากกฎตายตัวเหนือดัชนีค่าระวาง ความแออัดท่าเรือ และข่าวที่ติดแท็กไว้แล้ว — เช่น Demand สูง
        + Supply ตึงตัว มักหมายถึงราคาอาจขยับขึ้นและพื้นที่ระวางหายาก ไม่ใช่เกณฑ์ AHP เพิ่มเติม
        เป็นข้อมูลประกอบก่อนเข้าสู่การเปรียบเทียบสายเรือ
      </p>
    </section>
  );
}
