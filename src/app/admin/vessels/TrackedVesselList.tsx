"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";
import { relativeDaysTh } from "@/lib/format";
import type { TrackedVesselView } from "@/lib/queries";
import { estimateEtaDays, haversineKm } from "@/lib/vessel";

/**
 * Past this age, a position reads as misleading rather than merely old — the
 * [BETA] deep-link fallback takes over instead of showing a number that
 * looks current but isn't. See the admin/vessels page header for why this
 * whole feature is BETA: aisstream.io's free, volunteer-receiver network was
 * confirmed to have little to no coverage in the Gulf of Thailand specifically
 * — exactly where a position matters most, in the last day or two before a
 * vessel reaches port.
 */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

function marineTrafficUrl(mmsi: number): string {
  return `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`;
}

/** A plain helper, not inlined in the component body — `Date.now()` there would be an impure call during render. */
function isStalePosition(observedAt: Date, now = Date.now()): boolean {
  return now - observedAt.getTime() > STALE_AFTER_MS;
}

export function TrackedVesselList({ vessels }: { vessels: TrackedVesselView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  async function handleStop(vessel: TrackedVesselView) {
    setStoppingId(vessel.id);
    try {
      const response = await fetch(`/api/vessels/${vessel.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        toast.error(body.error ?? "หยุดติดตามไม่สำเร็จ");
        return;
      }
      toast.success(`หยุดติดตาม "${vessel.label}" แล้ว`);
      router.refresh();
    } catch {
      toast.error("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setStoppingId(null);
    }
  }

  if (vessels.length === 0) {
    return (
      <section className="panel px-4 py-6">
        <p className="text-small text-ink-soft">ยังไม่มีเรือที่กำลังติดตาม</p>
      </section>
    );
  }

  return (
    <section className="panel overflow-x-auto">
      <div className="flex items-baseline gap-2 border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">เรือที่กำลังติดตาม</h2>
        <span className="label" style={{ color: "var(--color-warn)" }}>BETA</span>
      </div>

      <table className="w-full border-collapse text-small">
        <thead>
          <tr className="text-micro text-ink-faint">
            <th scope="col" className="border-b border-line px-3 py-2 text-left">ชื่อ/คำอธิบาย</th>
            <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">MMSI</th>
            <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">ปลายทาง</th>
            <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">ตำแหน่งล่าสุด</th>
            <th scope="col" className="border-b border-l border-line px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {vessels.map((v) => (
            <tr key={v.id}>
              <td className="border-t border-line px-3 py-2">{v.label}</td>
              <td className="fig border-l border-t border-line px-3 py-2">{v.mmsi}</td>
              <td className="border-l border-t border-line px-3 py-2">
                {v.destinationPort?.name ?? "—"}
              </td>
              <td className="border-l border-t border-line px-3 py-2 text-micro">
                <PositionCell vessel={v} />
              </td>
              <td className="border-l border-t border-line px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleStop(v)}
                  disabled={stoppingId === v.id}
                  className="btn px-2.5 py-1 text-micro"
                >
                  {stoppingId === v.id ? "กำลังหยุด" : "หยุดติดตาม"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PositionCell({ vessel }: { vessel: TrackedVesselView }) {
  const pos = vessel.latestPosition;
  const isStale = !pos || isStalePosition(pos.observedAt);

  if (isStale) {
    return (
      <div className="flex flex-col items-start gap-1">
        {pos && (
          <span className="text-ink-faint">
            สัญญาณล่าสุด {relativeDaysTh(pos.observedAt)} — เก่าเกินจะเชื่อถือได้
          </span>
        )}
        <a
          href={marineTrafficUrl(vessel.mmsi)}
          target="_blank"
          rel="noreferrer"
          className="btn px-2 py-1 text-micro"
        >
          ดูตำแหน่งสดบน MarineTraffic ↗
        </a>
      </div>
    );
  }

  const destinationPort = vessel.destinationPort;
  const distanceKm =
    destinationPort?.lat != null && destinationPort?.lon != null
      ? haversineKm(pos.lat, pos.lon, destinationPort.lat, destinationPort.lon)
      : null;
  const etaDays = distanceKm !== null ? estimateEtaDays(distanceKm, pos.speedKnots) : null;

  return (
    <div className="text-ink-faint">
      <p>
        {relativeDaysTh(pos.observedAt)} · {pos.lat.toFixed(2)}, {pos.lon.toFixed(2)}
      </p>
      {(distanceKm !== null || etaDays !== null) && (
        <p className="mt-0.5">
          {distanceKm !== null && destinationPort && (
            <>ห่างจาก{destinationPort.name} ~{Math.round(distanceKm).toLocaleString("en-US")} กม.</>
          )}
          {etaDays !== null && (
            <> · คาดถึงใน {etaDays < 1 ? "ไม่ถึง 1 วัน" : `${Math.round(etaDays)} วัน`}</>
          )}
        </p>
      )}
    </div>
  );
}
