"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";
import { relativeDaysTh } from "@/lib/format";
import type { TrackedVesselView } from "@/lib/queries";

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
      <div className="border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">เรือที่กำลังติดตาม</h2>
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
              <td className="border-l border-t border-line px-3 py-2 text-micro text-ink-faint">
                {v.latestPosition
                  ? `${relativeDaysTh(v.latestPosition.observedAt)} · ${v.latestPosition.lat.toFixed(2)}, ${v.latestPosition.lon.toFixed(2)}`
                  : "ยังไม่มีตำแหน่ง"}
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
