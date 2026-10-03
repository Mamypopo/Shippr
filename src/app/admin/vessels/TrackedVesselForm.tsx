"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";

interface PortOption {
  unlocode: string;
  name: string;
}

export function TrackedVesselForm({ ports }: { ports: PortOption[] }) {
  const router = useRouter();
  const toast = useToast();

  const [mmsi, setMmsi] = useState("");
  const [label, setLabel] = useState("");
  const [destinationPortUnlocode, setDestinationPortUnlocode] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mmsi: Number(mmsi),
          label,
          destinationPortUnlocode: destinationPortUnlocode || null,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const fields = body.fields ? Object.values(body.fields).join(" · ") : null;
        toast.error(fields ?? body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }

      toast.success(body.resumed ? `กลับมาติดตามเรือ MMSI ${mmsi} อีกครั้ง` : `เริ่มติดตามเรือ MMSI ${mmsi} แล้ว`);
      setMmsi("");
      setLabel("");
      setDestinationPortUnlocode("");
      router.refresh();
    } catch {
      toast.error("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel px-4 py-4">
      <h2 className="text-base">เริ่มติดตามเรือ</h2>
      <p className="mt-1 max-w-[62ch] text-micro leading-relaxed text-ink-faint">
        ใส่หมายเลข MMSI ของเรือ (ไม่ใช่ชื่อเรือ) — หาได้จากใบ booking confirmation ของสายเรือ
        หรือค้นชื่อเรือในแผนที่ตำแหน่งเรือสดด้านบนแล้วดูเลข MMSI ที่นั่น ตำแหน่งจะอัปเดตทุก 15 นาที
        เมื่อเรือส่งสัญญาณ
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-micro text-ink-faint">MMSI (เลข 9 หลัก)</span>
          <input
            type="number"
            value={mmsi}
            onChange={(e) => setMmsi(e.target.value)}
            placeholder="เช่น 563012345"
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>

        <label className="block">
          <span className="block text-micro text-ink-faint">ชื่อ/คำอธิบาย</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="เช่น ตู้ส่งลูกค้า ABC — PO 1234"
            className="mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>

        <label className="block">
          <span className="block text-micro text-ink-faint">ท่าเรือปลายทาง (ถ้ามี)</span>
          <select
            value={destinationPortUnlocode}
            onChange={(e) => setDestinationPortUnlocode(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-small"
          >
            <option value="">ไม่ระบุ</option>
            {ports.map((p) => (
              <option key={p.unlocode} value={p.unlocode}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || mmsi === "" || label === ""}
          className="btn-primary px-4 py-1.5 text-small"
        >
          {saving ? "กำลังบันทึก" : "เริ่มติดตาม"}
        </button>
      </div>
    </form>
  );
}
