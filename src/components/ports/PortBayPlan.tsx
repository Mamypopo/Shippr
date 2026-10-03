import type { PortSnapshot } from "@/lib/queries";
import { relativeDaysTh } from "@/lib/format";
import { RISK_THRESHOLDS, type RiskLevelKey } from "@/lib/risk";

/**
 * Hub ports as a bay plan.
 *
 * The cells are painted solid, not tinted, because that is the whole point of
 * the reference: a stowage plan is read as a shape first. Scanning this row
 * should tell you the week before you read a single number.
 */
const RISK_PAINT: Record<RiskLevelKey, { fill: string; ink: string; th: string }> = {
  LOW: { fill: "var(--color-clear)", ink: "var(--color-clear-ink)", th: "ปกติ" },
  MODERATE: { fill: "var(--color-watch)", ink: "var(--color-watch-ink)", th: "เริ่มแออัด" },
  HIGH: { fill: "var(--color-hazard)", ink: "var(--color-hazard-ink)", th: "แออัดหนัก" },
};

export function PortBayPlan({
  ports,
  compact = false,
}: {
  ports: PortSnapshot[];
  compact?: boolean;
}) {
  return (
    <section className="plan" aria-label="ความแออัดของท่าเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-hull px-4 py-2.5">
        <h2 className="text-base">เวลารอเทียบท่า เฉลี่ย 7 วัน</h2>
        <p className="text-micro text-hull-soft">
          ปกติ ต่ำกว่า {RISK_THRESHOLDS.moderate} วัน · เริ่มแออัด {RISK_THRESHOLDS.moderate} ถึง{" "}
          {RISK_THRESHOLDS.high} วัน · แออัดหนัก เกิน {RISK_THRESHOLDS.high} วัน
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ports.map((port) => (
          <PortSlot key={port.id} port={port} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function PortSlot({ port, compact }: { port: PortSnapshot; compact: boolean }) {
  const hasReading = port.avgWaitDays !== null && port.riskLevel !== null;
  const paint = hasReading ? RISK_PAINT[port.riskLevel!] : null;

  return (
    <article
      className={`relative flex flex-col justify-between border-hull p-3.5 ${
        compact ? "min-h-28" : "min-h-44"
      } border-b-2 border-l-2 first:border-l-0 sm:nth-[3n+1]:border-l-0 lg:nth-[3n+1]:border-l-2 lg:nth-[6n+1]:border-l-0`}
      style={paint ? { background: paint.fill, color: paint.ink } : undefined}
    >
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="addr">{port.unlocode}</span>
          {port.observedOn && <span className="addr">{relativeDaysTh(port.observedOn)}</span>}
        </div>

        <h3 className="mt-1.5 text-base leading-tight">{port.name}</h3>
        <p className="text-micro" style={{ opacity: 0.7 }}>
          {port.country}
        </p>
      </div>

      {hasReading ? (
        <div className="mt-3">
          <p className="fig text-figure leading-none font-bold">
            {port.avgWaitDays!.toFixed(1)}
            <span className="ml-1.5 font-sans text-micro font-normal" style={{ opacity: 0.75 }}>
              วัน
            </span>
          </p>
          <p className="mt-1 text-micro" style={{ opacity: 0.85 }}>
            {paint!.th}
            {port.vesselsWaiting !== null && (
              <>
                {" · "}
                <span className="fig">{port.vesselsWaiting}</span> ลำรอ
              </>
            )}
          </p>
        </div>
      ) : (
        /* An unpainted slot is an empty slot, and it says so. Hiding it would
           read as "no congestion here" to anyone scanning the row. */
        <p className="mt-3 text-micro text-hull-faint">ยังไม่มีข้อมูล</p>
      )}
    </article>
  );
}
