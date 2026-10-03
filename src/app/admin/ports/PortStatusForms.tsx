"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PORT_CSV_TEMPLATE } from "@/lib/csv";
import { riskLevelForWaitDays, RISK_LABELS } from "@/lib/risk";

export interface PortOption {
  unlocode: string;
  name: string;
}

function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function PortStatusForms({ ports }: { ports: PortOption[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <SingleEntryForm ports={ports} />
      <CsvImportForm />
    </div>
  );
}

function SingleEntryForm({ ports }: { ports: PortOption[] }) {
  const router = useRouter();

  const [unlocode, setUnlocode] = useState(ports[0]?.unlocode ?? "");
  const [observedOn, setObservedOn] = useState(todayIso());
  const [avgWaitDays, setAvgWaitDays] = useState("");
  const [vesselsWaiting, setVesselsWaiting] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const wait = Number(avgWaitDays);
  const preview = avgWaitDays !== "" && Number.isFinite(wait) ? riskLevelForWaitDays(wait) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unlocode,
          observedOn,
          avgWaitDays: Number(avgWaitDays),
          vesselsWaiting: vesselsWaiting === "" ? null : Number(vesselsWaiting),
          note: note.trim() || null,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const fields = body.fields ? Object.values(body.fields).join(" · ") : null;
        setStatus({ kind: "error", text: fields ?? body.error ?? "บันทึกไม่สำเร็จ" });
        return;
      }

      setStatus({ kind: "ok", text: `บันทึก ${unlocode} วันที่ ${observedOn} แล้ว` });
      setAvgWaitDays("");
      setVesselsWaiting("");
      setNote("");
      router.refresh();
    } catch {
      setStatus({ kind: "error", text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="plan px-4 py-4">
      <h2 className="text-base">บันทึกเวลารอเทียบท่า</h2>
      <p className="mt-1 max-w-[56ch] text-micro leading-relaxed text-hull-faint">
        ค่าเฉลี่ย 7 วันจากรายงานที่บริษัทใช้ ระบบจะจัดระดับความเสี่ยงให้อัตโนมัติ
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-micro text-hull-faint">ท่าเรือ</span>
          <select
            value={unlocode}
            onChange={(e) => setUnlocode(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-small"
          >
            {ports.map((port) => (
              <option key={port.unlocode} value={port.unlocode}>
                {port.name} ({port.unlocode})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-micro text-hull-faint">วันที่สังเกต</span>
          <input
            type="date"
            value={observedOn}
            onChange={(e) => setObservedOn(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>

        <label className="block">
          <span className="block text-micro text-hull-faint">เวลารอเฉลี่ย (วัน)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={avgWaitDays}
            onChange={(e) => setAvgWaitDays(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
            required
          />
        </label>

        <label className="block">
          <span className="block text-micro text-hull-faint">จำนวนเรือที่รอ</span>
          <input
            type="number"
            min="0"
            value={vesselsWaiting}
            onChange={(e) => setVesselsWaiting(e.target.value)}
            className="fig mt-1 w-full px-2 py-1.5 text-small"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="block text-micro text-hull-faint">หมายเหตุ</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น หมอกลงหนาที่จุดจอดรอ"
          className="mt-1 w-full px-2 py-1.5 text-small"
        />
      </label>

      {preview && (
        <p className="mt-3 text-small">
          จะถูกจัดเป็น{" "}
          <strong className="font-medium">{RISK_LABELS[preview].th}</strong>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || avgWaitDays === ""}
          className="btn-solid px-4 py-1.5 text-small"
        >
          {saving ? "กำลังบันทึก" : "บันทึก"}
        </button>
        {status && (
          <p
            className="text-small"
            style={{ color: status.kind === "ok" ? "var(--color-clear)" : "var(--color-hazard)" }}
          >
            {status.text}
          </p>
        )}
      </div>
    </form>
  );
}

function CsvImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ports/import", { method: "POST", body: formData });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "นำเข้าไม่สำเร็จ");
        return;
      }

      setResult({ imported: body.imported, errors: body.errors ?? [] });
      router.refresh();
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="plan px-4 py-4">
      <h2 className="text-base">นำเข้าทั้งสัปดาห์จาก CSV</h2>
      <p className="mt-1 max-w-[56ch] text-micro leading-relaxed text-hull-faint">
        แถวที่ผิดจะถูกข้ามและรายงานทีละแถว ไม่ทำให้ทั้งไฟล์ตกไปด้วย
      </p>

      <pre className="mt-3 overflow-x-auto border border-rule bg-plan-sunk p-2 text-micro">
        {PORT_CSV_TEMPLATE}
      </pre>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-3 w-full px-2 py-1.5 text-small"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!file || busy}
          className="btn-solid px-4 py-1.5 text-small"
        >
          {busy ? "กำลังนำเข้า" : "นำเข้าไฟล์"}
        </button>
        {error && <p className="text-small text-hazard">{error}</p>}
      </div>

      {result && (
        <div className="mt-3 text-small">
          <p style={{ color: "var(--color-clear)" }}>
            นำเข้าสำเร็จ <span className="fig">{result.imported}</span> แถว
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-micro text-hazard">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
