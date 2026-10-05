"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingForm() {
  const router = useRouter();
  const toast = useToast();
  const [carrierName, setCarrierName] = useState("");
  const [bookedOn, setBookedOn] = useState(today());
  const [confirmedAt, setConfirmedAt] = useState("");
  const [expectedArrival, setExpectedArrival] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierName,
          bookedOn,
          confirmedAt: confirmedAt || null,
          expectedArrival: expectedArrival || null,
          arrivedAt: arrivedAt || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const fields = body.fields ? Object.values(body.fields).join(" · ") : null;
        toast.error(fields ?? body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(`บันทึกการจอง ${carrierName} แล้ว`);
      setCarrierName("");
      setConfirmedAt("");
      setExpectedArrival("");
      setArrivedAt("");
      router.refresh();
    } catch {
      toast.error("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel px-4 py-4">
      <h2 className="text-base">บันทึกการจองกับสายเรือ</h2>
      <p className="mt-1 max-w-[62ch] text-micro leading-relaxed text-ink-faint">
        กรอกทีละรายการ ช่องที่ยังไม่รู้ผลให้เว้นว่างไว้ก่อน แล้วกลับมาแก้ทีหลังได้
        ระบบจะเอาตัวเลขเหล่านี้ไปคำนวณค่าเฉลี่ยของแต่ละสายเรือให้หน้าเปรียบเทียบ
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="block">
          <span className="block text-micro text-ink-faint">สายเรือ</span>
          <input
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="เช่น Maersk"
            className="mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>
        <label className="block">
          <span className="block text-micro text-ink-faint">วันที่จอง</span>
          <input
            type="date"
            value={bookedOn}
            onChange={(e) => setBookedOn(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>
        <label className="block">
          <span className="block text-micro text-ink-faint">วันที่สายเรือยืนยัน</span>
          <input
            type="date"
            value={confirmedAt}
            onChange={(e) => setConfirmedAt(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
          />
        </label>
        <label className="block">
          <span className="block text-micro text-ink-faint">วันที่ถึงตามกำหนด</span>
          <input
            type="date"
            value={expectedArrival}
            onChange={(e) => setExpectedArrival(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
          />
        </label>
        <label className="block">
          <span className="block text-micro text-ink-faint">วันที่ถึงจริง</span>
          <input
            type="date"
            value={arrivedAt}
            onChange={(e) => setArrivedAt(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
          />
        </label>
      </div>

      <div className="mt-4">
        <button type="submit" disabled={saving || carrierName.trim() === ""} className="btn-primary px-4 py-1.5 text-small">
          {saving ? "กำลังบันทึก" : "บันทึกการจอง"}
        </button>
      </div>
    </form>
  );
}
