import { type CriterionKey, type RankedAlternative } from "@/lib/ahp";
import type { BenchmarkResult } from "@/lib/benchmark";
import type { Level, MarketImpact } from "@/lib/market-situation";
import { LEVEL_LABELS } from "@/lib/market-situation";
import { buildRecommendation } from "@/lib/recommendation";
import type { QuoteDraft } from "./CarrierQuoteForm";

function levelColor(level: Level): string {
  if (level === "HIGH") return "var(--color-bad)";
  if (level === "LOW") return "var(--color-ok)";
  return "var(--color-ink-faint)";
}

/**
 * Why the top-ranked carrier won, in one sentence, plus its own Risk Alert —
 * so a reader sees not just a rank, but the specific reasons and risks of
 * this pick. The reasoning itself lives in `lib/recommendation.ts`, shared
 * with the save route: what's shown here while live-editing is exactly what
 * gets frozen into the memo, never a second calculation that could drift
 * from it.
 */
export function RecommendationPanel({
  ranking,
  benchmarks,
  quotes,
  marketImpact,
}: {
  ranking: RankedAlternative<CriterionKey>[];
  benchmarks: Record<string, BenchmarkResult | null>;
  quotes: QuoteDraft[];
  marketImpact: MarketImpact;
}) {
  const winner = ranking[0];
  const runnerUp = ranking[1];
  if (!winner) return null;

  const { reasons, risk } = buildRecommendation({ ranking, benchmarks, quotes, marketImpact });

  return (
    <section className="panel px-4 py-4" aria-label="คำแนะนำและความเสี่ยง">
      <h2 className="text-base">Recommended Carrier</h2>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-figure-sm font-medium">{winner.label}</p>
        <p className="fig text-small text-ink-soft">
          คะแนน {winner.score100.toFixed(1)}/100 · อันดับ {winner.rank}
        </p>
      </div>
      <p className="mt-2 max-w-[62ch] text-small leading-relaxed text-ink-soft">
        {reasons.length > 0
          ? `ได้รับเลือกเพราะด้าน ${reasons.join(" และ ")} ดีกว่าคู่แข่งอันดับรองลงมาอย่างชัดเจน`
          : runnerUp
            ? "คะแนนรวมสูงสุด โดยไม่มีเกณฑ์ใดเกณฑ์หนึ่งที่เหนือกว่าคู่แข่งอย่างชัดเจน — ผลต่างมาจากหลายเกณฑ์รวมกัน"
            : "มีเพียงสายเรือเดียวที่กรอกครบในขณะนี้"}
      </p>

      <h3 className="mt-5 text-small font-medium">Risk Alert</h3>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {(
          [
            ["Freight Rate Risk", risk.freightRateRisk],
            ["Capacity / Space Risk", risk.capacitySpaceRisk],
            ["Transit Time Risk", risk.transitTimeRisk],
            ["Schedule Risk", risk.scheduleRisk],
          ] as const
        ).map(([label, level]) => (
          <div key={label}>
            <p className="label">{label}</p>
            <p className="mt-0.5 text-small font-medium" style={{ color: levelColor(level) }}>
              {LEVEL_LABELS[level]}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-micro leading-relaxed text-ink-faint">
        รวมสัญญาณสองชั้น: สถานการณ์ตลาดโดยรวม (Market Impact ด้านบน) และข้อมูลเฉพาะของสายเรือนี้เอง
        (ราคาสูงกว่าตลาด ประวัติยกเลิกเที่ยว เส้นทางถ่ายลำ หรือเวลาขนส่งที่นานกว่าคู่แข่ง) —
        ระดับที่โชว์คือระดับที่แย่กว่าของทั้งสองชั้น
      </p>
    </section>
  );
}
