"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";
import { ROUTE_CODES, ROUTE_LABELS } from "@/lib/benchmark";

const INDEX_UNITS: Record<string, { unit: string; label: string }> = {
  WCI: { unit: "USD_PER_FEU", label: "USD ต่อ FEU" },
  SCFI: { unit: "POINTS", label: "จุด" },
  BDRY: { unit: "USD", label: "USD" },
  WTI: { unit: "USD", label: "USD ต่อบาร์เรล" },
  BRENT: { unit: "USD", label: "USD ต่อบาร์เรล" },
  ZIM: { unit: "USD", label: "USD ต่อหุ้น" },
};

/** Most recent Thursday — the day both WCI and SCFI publish. */
function lastThursdayIso(): string {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() - 4 + 7) % 7));
  return utc.toISOString().slice(0, 10);
}

export function ManualIndexForm() {
  const router = useRouter();
  const toast = useToast();

  const [indexCode, setIndexCode] = useState("WCI");
  const [routeCode, setRouteCode] = useState<string>(ROUTE_CODES.COMPOSITE);
  const [periodDate, setPeriodDate] = useState(lastThursdayIso());
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/indices/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indexCode,
          routeCode,
          periodDate,
          value: Number(value),
          unit: INDEX_UNITS[indexCode].unit,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const fields = body.fields ? Object.values(body.fields).join(" · ") : null;
        toast.error(fields ?? body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }

      toast.success(`บันทึก ${indexCode} ${routeCode} งวด ${periodDate} แล้ว`);
      setValue("");
      router.refresh();
    } catch {
      toast.error("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel px-4 py-4">
      <h2 className="text-base">กรอกค่าดัชนีสัปดาห์นี้</h2>
      <p className="mt-1 max-w-[62ch] text-micro leading-relaxed text-ink-faint">
        Drewry แสดง WCI เป็นกราฟ ไม่มีตารางให้ดึงอัตโนมัติ ช่องนี้จึงเป็นทางหลักของดัชนีนั้น
        ไม่ใช่ทางสำรอง ค่าที่กรอกที่นี่จะไม่ถูก job อัตโนมัติเขียนทับ
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="block text-micro text-ink-faint">ดัชนี</span>
          <select
            value={indexCode}
            onChange={(e) => setIndexCode(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-small"
          >
            {Object.keys(INDEX_UNITS).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-micro text-ink-faint">เส้นทาง</span>
          <select
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-small"
          >
            {Object.values(ROUTE_CODES).map((code) => (
              <option key={code} value={code}>
                {ROUTE_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-micro text-ink-faint">งวดวันที่</span>
          <input
            type="date"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>

        <label className="block">
          <span className="block text-micro text-ink-faint">
            ค่า ({INDEX_UNITS[indexCode].label})
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || value === ""}
          className="btn-primary px-4 py-1.5 text-small"
        >
          {saving ? "กำลังบันทึก" : "บันทึกค่า"}
        </button>
      </div>
    </form>
  );
}
