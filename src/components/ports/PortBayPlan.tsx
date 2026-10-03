import type { PortSnapshot } from "@/lib/queries";
import { relativeDaysTh } from "@/lib/format";
import { RISK_THRESHOLDS, type RiskLevelKey } from "@/lib/risk";

const RISK: Record<RiskLevelKey, { ink: string; th: string }> = {
  LOW: { ink: "var(--color-ok)", th: "ปกติ" },
  MODERATE: { ink: "var(--color-warn)", th: "เริ่มแออัด" },
  HIGH: { ink: "var(--color-bad)", th: "แออัดหนัก" },
};

/**
 * Hub ports, one panel cell each.
 *
 * Risk is carried by a small coloured mark and the figure's colour, not by a
 * filled block. On a page this quiet that is more than enough to pick out,
 * and it keeps six cells side by side from reading as a traffic light.
 */
export function PortBayPlan({ ports }: { ports: PortSnapshot[] }) {
  return (
    <section aria-label="ความแออัดของท่าเรือ">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lead">เวลารอเทียบท่า</h2>
        <p className="text-small text-ink-faint">
          ค่าเฉลี่ย 7 วัน · ปกติต่ำกว่า {RISK_THRESHOLDS.moderate} วัน · แออัดหนักเกิน{" "}
          {RISK_THRESHOLDS.high} วัน
        </p>
      </div>

      <div className="panel mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {ports.map((port) => (
          <PortSlot key={port.id} port={port} />
        ))}
      </div>
    </section>
  );
}

function PortSlot({ port }: { port: PortSnapshot }) {
  const hasReading = port.avgWaitDays !== null && port.riskLevel !== null;
  const risk = hasReading ? RISK[port.riskLevel!] : null;

  return (
    <article className="flex min-h-32 flex-col justify-between border-line p-4 not-nth-[2n+1]:border-l sm:not-nth-[3n+1]:border-l sm:nth-[2n+1]:border-l-0 lg:not-nth-[6n+1]:border-l nth-[n+3]:border-t sm:nth-[n+4]:border-t lg:nth-[n+3]:border-t-0">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="label">{port.unlocode}</span>
          {risk && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: risk.ink }}
            />
          )}
        </div>
        <h3 className="mt-1.5 text-small leading-tight font-medium">{port.name}</h3>
      </div>

      {hasReading ? (
        <div className="mt-3">
          <p className="fig text-figure-sm leading-none font-semibold" style={{ color: risk!.ink }}>
            {port.avgWaitDays!.toFixed(1)}
            <span className="ml-1 text-micro font-normal text-ink-faint">วัน</span>
          </p>
          <p className="mt-1.5 text-micro text-ink-faint">
            {risk!.th}
            {port.observedOn && ` · ${relativeDaysTh(port.observedOn)}`}
          </p>
        </div>
      ) : (
        /* An empty cell says it is empty. Hiding the port would read as
           "no congestion here" to anyone scanning the row. */
        <p className="mt-3 text-micro text-ink-faint">ยังไม่มีข้อมูล</p>
      )}
    </article>
  );
}
