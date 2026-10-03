import Link from "next/link";

import { relativeDaysTh } from "@/lib/format";
import type { TrackedVesselView } from "@/lib/queries";
import { estimateEtaDays, haversineKm } from "@/lib/vessel";

/**
 * Specific vessels with an actual shipment on them, not the regional
 * overview — that's `LiveShipMap`. Reads positions `vessel-tracking` already
 * wrote to the database; this component makes no network call of its own.
 */
export function TrackedVesselsCard({ vessels }: { vessels: TrackedVesselView[] }) {
  if (vessels.length === 0) return null;

  return (
    <section className="panel" aria-label="เรือที่กำลังติดตาม">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">เรือที่กำลังติดตาม</h2>
        <Link href="/admin/vessels" className="label hover:underline">
          จัดการ
        </Link>
      </div>

      <ul className="divide-y divide-line">
        {vessels.map((v) => (
          <li key={v.id} className="px-4 py-3">
            <VesselRow vessel={v} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function VesselRow({ vessel }: { vessel: TrackedVesselView }) {
  const { latestPosition: pos, destinationPort } = vessel;

  if (!pos) {
    return (
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-small">{vessel.label}</p>
        <p className="text-micro text-ink-faint">ยังไม่มีตำแหน่ง</p>
      </div>
    );
  }

  const distanceKm =
    destinationPort?.lat != null && destinationPort?.lon != null
      ? haversineKm(pos.lat, pos.lon, destinationPort.lat, destinationPort.lon)
      : null;
  const etaDays = distanceKm !== null ? estimateEtaDays(distanceKm, pos.speedKnots) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-small font-medium">{vessel.label}</p>
        <p className="text-micro text-ink-faint">{relativeDaysTh(pos.observedAt)}</p>
      </div>
      <p className="mt-1 text-micro leading-relaxed text-ink-soft">
        {pos.navStatus ?? "ไม่ทราบสถานะ"}
        {pos.speedKnots !== null && <> · {pos.speedKnots.toFixed(1)} นอต</>}
        {destinationPort && distanceKm !== null && (
          <>
            {" "}
            · ห่างจาก{destinationPort.name} ~{Math.round(distanceKm).toLocaleString("en-US")} กม.
          </>
        )}
        {etaDays !== null && (
          <> · คาดถึงใน {etaDays < 1 ? "ไม่ถึง 1 วัน" : `${Math.round(etaDays)} วัน`}</>
        )}
      </p>
    </div>
  );
}
