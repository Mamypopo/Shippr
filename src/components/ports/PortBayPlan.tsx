import type { PortSnapshot } from "@/lib/queries";
import { relativeDaysTh } from "@/lib/format";
import { RISK_THRESHOLDS, type RiskLevelKey } from "@/lib/risk";

const RISK_FILL: Record<RiskLevelKey, string> = {
  LOW: "var(--color-clear-fill)",
  MODERATE: "var(--color-watch-fill)",
  HIGH: "var(--color-hazard-fill)",
};

const RISK_INK: Record<RiskLevelKey, string> = {
  LOW: "var(--color-clear)",
  MODERATE: "var(--color-watch)",
  HIGH: "var(--color-hazard)",
};

const RISK_TH: Record<RiskLevelKey, string> = {
  LOW: "ปกติ",
  MODERATE: "เริ่มแออัด",
  HIGH: "แออัดหนัก",
};

/**
 * Hub ports as a bay plan: one addressed slot each, filled by risk.
 *
 * A port with no reading is still drawn, empty and labelled. Dropping it
 * would read as "no congestion here" to anyone scanning the row.
 */
export function PortBayPlan({ ports }: { ports: PortSnapshot[] }) {
  return (
    <section className="plan" aria-label="ความแออัดของท่าเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2">
        <h2 className="text-small font-medium">เวลารอเทียบท่า เฉลี่ย 7 วัน</h2>
        <p className="text-micro text-hull-faint">
          ปกติ &lt; {RISK_THRESHOLDS.moderate} วัน · เริ่มแออัด{" "}
          {RISK_THRESHOLDS.moderate}–{RISK_THRESHOLDS.high} วัน · แออัดหนัก &gt;{" "}
          {RISK_THRESHOLDS.high} วัน
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ports.map((port) => (
          <PortSlot key={port.id} port={port} />
        ))}
      </div>
    </section>
  );
}

function PortSlot({ port }: { port: PortSnapshot }) {
  const hasReading = port.avgWaitDays !== null && port.riskLevel !== null;
  const fill = hasReading ? RISK_FILL[port.riskLevel!] : "transparent";

  return (
    <article
      className="relative min-h-[8.5rem] border-b border-l border-rule p-3 first:border-l-0 sm:[&:nth-child(3n+1)]:border-l-0 lg:[&:nth-child(3n+1)]:border-l lg:[&:nth-child(6n+1)]:border-l-0"
      style={{ background: fill }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="slot-address">{port.unlocode}</span>
        {hasReading && port.observedOn && (
          <span className="slot-address">{relativeDaysTh(port.observedOn)}</span>
        )}
      </div>

      <h3 className="mt-1 text-small font-medium leading-tight">{port.name}</h3>
      <p className="text-micro text-hull-faint">{port.country}</p>

      {hasReading ? (
        <>
          <p
            className="tnum mt-2 text-figure-sm leading-none font-medium"
            style={{ color: RISK_INK[port.riskLevel!] }}
          >
            {port.avgWaitDays!.toFixed(1)}
            <span className="ml-1 font-sans text-micro font-normal text-hull-soft">วัน</span>
          </p>
          <p className="mt-1 text-micro" style={{ color: RISK_INK[port.riskLevel!] }}>
            {RISK_TH[port.riskLevel!]}
          </p>
          {port.vesselsWaiting !== null && (
            <p className="mt-1 text-micro text-hull-faint">
              <span className="tnum">{port.vesselsWaiting}</span> ลำรอเข้าท่า
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-micro text-hull-faint">
          ยังไม่มีข้อมูล — กรอกที่หน้าจัดการท่าเรือ
        </p>
      )}
    </article>
  );
}
