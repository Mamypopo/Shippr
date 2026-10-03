"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  computeAHP,
  pairKey,
  type CriterionKey,
  type PairwiseInput,
} from "@/lib/ahp";
import { CARGO_PRESETS, type PresetKey } from "@/lib/ahp-presets";
import { compareToMarket, ROUTE_LABELS, type BenchmarkResult } from "@/lib/benchmark";
import { perFeuRate, quotesToAlternatives } from "@/lib/cost";
import { CarrierQuoteForm, emptyQuote, type QuoteDraft } from "./CarrierQuoteForm";
import { CarrierRadarChart } from "./CarrierRadarChart";
import { ConsistencyBadge } from "./ConsistencyBadge";
import { PairwiseMatrix } from "./PairwiseMatrix";
import { ScoreRanking } from "./ScoreRanking";

export interface MarketBenchmark {
  value: number;
  periodDate: string;
  routeCode: string;
}

/**
 * The AHP workspace.
 *
 * All state lives here and the result is recomputed on every change: a 5x5
 * eigenvector is microseconds, so there is no debounce and no "calculate"
 * button. Saving POSTs the inputs and the server recomputes — the client
 * result drives the screen, never the record.
 */
export function DecisionWorkspace({
  benchmark,
  availableRoutes,
}: {
  benchmark: MarketBenchmark | null;
  availableRoutes: string[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [routeCode, setRouteCode] = useState(benchmark?.routeCode ?? "COMPOSITE");
  const [notes, setNotes] = useState("");
  const [presetKey, setPresetKey] = useState<PresetKey | "CUSTOM">("BALANCED");
  const [pairwise, setPairwise] = useState<PairwiseInput>(CARGO_PRESETS.BALANCED.pairwise);
  const [quotes, setQuotes] = useState<QuoteDraft[]>([emptyQuote(0), emptyQuote(1)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only carriers that have been named and priced can be ranked; the rest are
  // still being typed.
  const readyQuotes = useMemo(
    () => quotes.filter((q) => q.carrierName.trim().length > 0 && q.oceanFreightUsd > 0),
    [quotes],
  );

  const result = useMemo(
    () => computeAHP(pairwise, { alternatives: quotesToAlternatives(readyQuotes) }),
    [pairwise, readyQuotes],
  );

  const benchmarks = useMemo(() => {
    const out: Record<string, BenchmarkResult | null> = {};
    for (const quote of readyQuotes) {
      out[quote.id] = compareToMarket(perFeuRate(quote), benchmark?.value ?? null, {
        routeCode: benchmark?.routeCode,
      });
    }
    return out;
  }, [readyQuotes, benchmark]);

  const handleChangePair = useCallback(
    (left: CriterionKey, right: CriterionKey, value: number) => {
      setPairwise((prev) => ({ ...prev, [pairKey(left, right)]: value }));
      setPresetKey("CUSTOM");
    },
    [],
  );

  const handleApplyPreset = useCallback((key: PresetKey) => {
    setPairwise({ ...CARGO_PRESETS[key].pairwise });
    setPresetKey(key);
  }, []);

  const handleQuoteChange = useCallback((id: string, patch: Partial<QuoteDraft>) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setQuotes((prev) => (prev.length > 2 ? prev.filter((q) => q.id !== id) : prev));
  }, []);

  const handleAdd = useCallback(() => {
    setQuotes((prev) => (prev.length < 5 ? [...prev, emptyQuote(prev.length)] : prev));
  }, []);

  const canSave = title.trim().length > 0 && readyQuotes.length >= 2 && !saving;

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/ahp/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          presetKey: presetKey === "CUSTOM" ? null : presetKey,
          routeCode,
          notes: notes.trim() || null,
          pairwise,
          quotes: readyQuotes.map((q) => ({
            carrierName: q.carrierName.trim(),
            serviceName: q.serviceName?.trim() || null,
            oceanFreightUsd: q.oceanFreightUsd,
            localChargesUsd: q.localChargesUsd,
            freeTimeDays: q.freeTimeDays,
            freeTimeValuePerDayUsd: q.freeTimeValuePerDayUsd,
            transitDays: q.transitDays,
            isDirect: q.isDirect,
            transshipmentCount: q.transshipmentCount,
            onTimePct: q.onTimePct,
            blankSailingsPerQuarter: q.blankSailingsPerQuarter,
            equipmentAvailabilityScore: q.equipmentAvailabilityScore,
            bookingSlaHours: q.bookingSlaHours,
            docTurnaroundHours: q.docTurnaroundHours,
            serviceScore: q.serviceScore,
            containerType: q.containerType,
          })),
          save: true,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        // Field errors from the server are more use than a status code.
        const fields = body.fields ? Object.values(body.fields).join(" · ") : null;
        setError(fields ?? body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }

      router.push(`/decisions/${body.decisionId}`);
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="plan px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="block text-micro text-hull-faint">ชื่อการตัดสินใจ</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น เลือกสายเรือ LCH–Rotterdam ตู้ 40HC ตุลาคม"
              className="mt-1 w-full px-2 py-1.5 text-base"
            />
          </label>

          <label className="block">
            <span className="block text-micro text-hull-faint">เส้นทางสำหรับเทียบราคาตลาด</span>
            <select
              value={routeCode}
              onChange={(e) => setRouteCode(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-base"
            >
              {availableRoutes.map((code) => (
                <option key={code} value={code}>
                  {ROUTE_LABELS[code] ?? code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-3 text-micro text-hull-faint">
          {benchmark
            ? `เทียบกับ Drewry WCI ${ROUTE_LABELS[benchmark.routeCode] ?? benchmark.routeCode} ที่ $${Math.round(benchmark.value).toLocaleString("en-US")}/FEU อ่านค่าเมื่อ ${benchmark.periodDate}`
            : "ยังไม่มีค่าระวางตลาดในระบบ จะยังเทียบราคากับตลาดให้ไม่ได้"}
        </p>
      </section>

      <CarrierQuoteForm
        quotes={quotes}
        onChange={handleQuoteChange}
        onRemove={handleRemove}
        onAdd={handleAdd}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <PairwiseMatrix
          pairwise={pairwise}
          result={result}
          presetKey={presetKey}
          onChangePair={handleChangePair}
          onApplyPreset={handleApplyPreset}
        />

        <div className="flex flex-col gap-4">
          <ConsistencyBadge
            result={result}
            onApplySuggestion={(left, right, value) => handleChangePair(left, right, value)}
          />
          <ScoreRanking
            ranking={result.ranking}
            benchmarks={benchmarks}
            isConsistent={result.isConsistent}
          />
          <CarrierRadarChart ranking={result.ranking} />
        </div>
      </div>

      <section className="plan px-4 py-4">
        <label className="block">
          <span className="block text-micro text-hull-faint">
            บันทึกเหตุผลเพิ่มเติม จะปรากฏใน memo
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="เช่น ลูกค้ายอมจ่ายเพิ่มเพื่อเลี่ยงการถ่ายลำที่สิงคโปร์"
            className="mt-1 w-full px-2 py-1.5 text-small"
          />
        </label>

        {error && <p className="mt-3 text-small text-hazard">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="border-2 border-hull bg-hull px-4 py-2 text-small text-plan disabled:border-rule disabled:bg-plan-sunk disabled:text-hull-faint"
          >
            {saving ? "กำลังบันทึก" : "บันทึกการตัดสินใจ"}
          </button>

          {!canSave && !saving && (
            <p className="text-micro text-hull-faint">
              ต้องตั้งชื่อ และกรอกชื่อสายเรือพร้อมค่าระวางอย่างน้อยสองสาย
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
