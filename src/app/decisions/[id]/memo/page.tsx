import { notFound } from "next/navigation";

import { CRITERIA, CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";
import { BENCHMARK_VERDICT_LABELS, routeLabel } from "@/lib/benchmark";
import { prisma, toNumber } from "@/lib/db";
import { formatUsd, thaiFullDate } from "@/lib/format";
import type { MarketSituation } from "@/lib/market-situation";
import { LEVEL_LABELS, type Level } from "@/lib/market-situation";
import type { RecommendationResult } from "@/lib/recommendation";
import type { SummaryBullet, SummaryTone } from "@/lib/summary";
import { MarketSituationPanel } from "@/components/market/MarketSituationPanel";
import { PrintButton } from "./PrintButton";

const TONE_COLOR: Record<SummaryTone, string> = {
  neutral: "var(--color-ink-faint)",
  positive: "var(--color-ok)",
  warning: "var(--color-warn)",
  critical: "var(--color-bad)",
};

function levelColor(level: Level): string {
  if (level === "HIGH") return "var(--color-bad)";
  if (level === "LOW") return "var(--color-ok)";
  return "var(--color-ink-faint)";
}

const SCENARIO_LABELS: Record<string, string> = {
  NORMAL: "Normal Market",
  PEAK_SEASON: "Peak Season",
  GEOPOLITICAL_DISRUPTION: "Geopolitical Disruption",
  WEATHER_DISRUPTION: "Weather Disruption",
};

export const dynamic = "force-dynamic";

/**
 * The decision memo: the artefact that goes to a client or a manager.
 *
 * Styled for A4 via the print stylesheet rather than rendered server-side to
 * PDF, which keeps a headless browser out of the deployment. The app chrome
 * is marked `no-print` and drops away.
 */
export default async function MemoPage(props: PageProps<"/decisions/[id]/memo">) {
  const { id } = await props.params;

  const decision = await prisma.aHPDecisionLog.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "asc" } } },
  });

  if (!decision) notFound();

  const ranking = (decision.alternativeScores ?? []) as unknown as RankedAlternative<CriterionKey>[];
  const weights = (decision.criteriaWeights ?? {}) as Record<CriterionKey, number>;
  const snapshot = decision.benchmarkSnapshot as {
    marketUsdPerFeu?: number;
    marketPeriodDate?: string;
    routeCode?: string;
    quotes?: Array<{ carrierName: string; deltaPct?: number; verdict?: string }>;
    marketBullets?: SummaryBullet[];
    alertCount7d?: number;
    topAlertHeadline?: string | null;
    situation?: MarketSituation;
    recommendation?: RecommendationResult;
  } | null;

  const winner = ranking[0];
  const runnerUp = ranking[1];

  const hasCaseInfo =
    decision.caseId ||
    decision.originLocode ||
    decision.destLocode ||
    decision.equipment ||
    decision.cargoDescription ||
    decision.quantity ||
    decision.requiredEtd ||
    decision.scenario;

  return (
    <article className="mx-auto max-w-[52rem] px-6 py-8 print:px-0 print:py-0">
      <div className="no-print mb-5 flex justify-end">
        <PrintButton />
      </div>

      <header className="border-b-2 border-ink pb-4">
        <h1 className="text-figure-sm leading-tight font-medium">{decision.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-5 text-small text-ink-soft">
          <span>บันทึกเมื่อ {thaiFullDate(decision.createdAt)}</span>
          <span>เส้นทาง {routeLabel(decision.routeCode)}</span>
          <span className="fig">รหัส {id.slice(0, 8)}</span>
        </p>
      </header>

      {hasCaseInfo && (
        <section className="mt-6">
          <h2 className="text-base">Decision Case</h2>
          <dl className="mt-2 grid max-w-[68ch] grid-cols-2 gap-x-4 gap-y-2 text-small sm:grid-cols-4">
            {decision.caseId && (
              <div>
                <dt className="text-micro text-ink-faint">Case ID</dt>
                <dd className="fig mt-0.5">{decision.caseId}</dd>
              </div>
            )}
            {(decision.originLocode || decision.destLocode) && (
              <div className="col-span-2">
                <dt className="text-micro text-ink-faint">Route</dt>
                <dd className="mt-0.5">
                  {decision.originLocode ?? "—"} → {decision.destLocode ?? "—"}
                </dd>
              </div>
            )}
            {(decision.equipment || decision.quantity) && (
              <div>
                <dt className="text-micro text-ink-faint">Equipment</dt>
                <dd className="mt-0.5">
                  {decision.equipment ?? "—"}
                  {decision.quantity && ` / ${decision.quantity} ตู้`}
                </dd>
              </div>
            )}
            {decision.cargoDescription && (
              <div>
                <dt className="text-micro text-ink-faint">Cargo</dt>
                <dd className="mt-0.5">{decision.cargoDescription}</dd>
              </div>
            )}
            {decision.requiredEtd && (
              <div>
                <dt className="text-micro text-ink-faint">Required ETD</dt>
                <dd className="fig mt-0.5">{thaiFullDate(decision.requiredEtd)}</dd>
              </div>
            )}
            {decision.scenario && (
              <div>
                <dt className="text-micro text-ink-faint">Scenario</dt>
                <dd className="mt-0.5">{SCENARIO_LABELS[decision.scenario] ?? decision.scenario}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {snapshot?.situation && (
        <section className="mt-6">
          <h2 className="text-base">สถานการณ์ตลาด ณ วันที่บันทึก</h2>
          <div className="mt-2 max-w-[68ch]">
            <MarketSituationPanel situation={snapshot.situation} />
          </div>

          {snapshot.marketBullets && snapshot.marketBullets.length > 0 && (
            <ul className="mt-3 max-w-[68ch] text-small leading-relaxed">
              {snapshot.marketBullets.map((bullet) => (
                <li key={bullet.id} className="mt-1 flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: TONE_COLOR[bullet.tone] }}
                  />
                  <span>{bullet.text}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-micro text-ink-faint">
            บันทึกไว้ ณ วันที่ตัดสินใจ — อ่านย้อนหลังภายหลังจะเห็นสถานการณ์ของวันนั้น ไม่ใช่วันนี้
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base">ข้อสรุป</h2>
        <p className="mt-2 max-w-[68ch] text-base leading-relaxed">
          จากการเปรียบเทียบ {decision.quotes.length} สายเรือด้วยวิธี Analytic Hierarchy
          Process สายเรือที่เหมาะสมที่สุดคือ{" "}
          <strong className="font-medium">{decision.winnerCarrier}</strong>
          {winner && <> ด้วยคะแนน {winner.score100.toFixed(1)} จาก 100</>}
          {runnerUp && (
            <>
              {" "}
              นำอันดับสองคือ {runnerUp.label} ซึ่งได้ {runnerUp.score100.toFixed(1)} คะแนน
            </>
          )}
        </p>

        {decision.isConsistent ? (
          <p className="mt-3 max-w-[68ch] text-small leading-relaxed text-ink-soft">
            การให้น้ำหนักเกณฑ์ในรายการนี้มีค่า Consistency Ratio{" "}
            <span className="fig">{decision.consistencyRatio.toFixed(3)}</span> ซึ่งต่ำกว่า
            เกณฑ์มาตรฐาน 0.1 หมายความว่าการตัดสินใจทั้งชุดสอดคล้องกันเอง ใช้อ้างอิงได้
          </p>
        ) : (
          <p className="mt-3 max-w-[68ch] text-small leading-relaxed text-bad">
            ข้อควรระวัง: Consistency Ratio ของรายการนี้คือ{" "}
            <span className="fig">{decision.consistencyRatio.toFixed(3)}</span> ซึ่งเกิน 0.1
            การให้น้ำหนักยังขัดแย้งกันเอง ควรทบทวนก่อนใช้เอกสารนี้ประกอบการตัดสินใจ
          </p>
        )}
      </section>

      {snapshot?.recommendation && winner && (
        <section className="mt-6">
          <h2 className="text-base">Recommendation + Risk Alert</h2>
          <p className="mt-2 max-w-[68ch] text-small leading-relaxed text-ink-soft">
            {snapshot.recommendation.reasons.length > 0
              ? `${winner.label} ได้รับเลือกเพราะด้าน ${snapshot.recommendation.reasons.join(" และ ")} ดีกว่าคู่แข่งอันดับรองลงมาอย่างชัดเจน`
              : runnerUp
                ? `${winner.label} ได้คะแนนรวมสูงสุด โดยไม่มีเกณฑ์ใดเกณฑ์หนึ่งที่เหนือกว่าคู่แข่งอย่างชัดเจน — ผลต่างมาจากหลายเกณฑ์รวมกัน`
                : `มีเพียงสายเรือเดียวในการเปรียบเทียบนี้`}
          </p>

          <dl className="mt-3 grid max-w-[68ch] grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {(
              [
                ["Freight Rate Risk", snapshot.recommendation.risk.freightRateRisk],
                ["Capacity / Space Risk", snapshot.recommendation.risk.capacitySpaceRisk],
                ["Transit Time Risk", snapshot.recommendation.risk.transitTimeRisk],
                ["Schedule Risk", snapshot.recommendation.risk.scheduleRisk],
              ] as const
            ).map(([label, level]) => (
              <div key={label}>
                <dt className="text-micro text-ink-faint">{label}</dt>
                <dd className="mt-0.5 text-small font-medium" style={{ color: levelColor(level) }}>
                  {LEVEL_LABELS[level]}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base">อันดับและคะแนน</h2>
        <table className="mt-2 w-full border-collapse text-small">
          <thead>
            <tr className="text-micro text-ink-faint">
              <th scope="col" className="border-y border-line px-2 py-1.5 text-left">อันดับ</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-left">สายเรือ</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">คะแนน</th>
              {CRITERIA.map((key) => (
                <th key={key} scope="col" className="border-y border-line px-2 py-1.5 text-right">
                  {CRITERION_LABELS[key].th}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((entry) => (
              <tr key={entry.id}>
                <td className="fig border-b border-line px-2 py-1.5">{entry.rank}</td>
                <td className="border-b border-line px-2 py-1.5">{entry.label}</td>
                <td className="fig border-b border-line px-2 py-1.5 text-right font-medium">
                  {entry.score100.toFixed(1)}
                </td>
                {CRITERIA.map((key) => (
                  <td key={key} className="fig border-b border-line px-2 py-1.5 text-right">
                    {((entry.localScores?.[key] ?? 0) * 100).toFixed(0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-micro text-ink-faint">
          คะแนนรายเกณฑ์เป็นค่าก่อนถ่วงน้ำหนัก 100 คือดีที่สุดในกลุ่มที่เปรียบเทียบ
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base">น้ำหนักที่ใช้</h2>
        <table className="mt-2 w-full border-collapse text-small">
          <tbody>
            {CRITERIA.map((key) => (
              <tr key={key}>
                <th scope="row" className="border-b border-line px-2 py-1.5 text-left font-normal">
                  {CRITERION_LABELS[key].th}
                </th>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {((weights[key] ?? 0) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-micro text-ink-faint">
          คำนวณจาก principal eigenvector ของเมทริกซ์เปรียบเทียบรายคู่ (Saaty 1–9) · λmax{" "}
          <span className="fig">{decision.lambdaMax.toFixed(4)}</span> · CI{" "}
          <span className="fig">{decision.consistencyIndex.toFixed(4)}</span>
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-base">ใบเสนอราคา</h2>
        <table className="mt-2 w-full border-collapse text-small">
          <thead>
            <tr className="text-micro text-ink-faint">
              <th scope="col" className="border-y border-line px-2 py-1.5 text-left">สายเรือ</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">Ocean</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">Local</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">Free time</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">Transit</th>
              <th scope="col" className="border-y border-line px-2 py-1.5 text-right">On-time</th>
            </tr>
          </thead>
          <tbody>
            {decision.quotes.map((quote) => (
              <tr key={quote.id}>
                <th scope="row" className="border-b border-line px-2 py-1.5 text-left font-normal">
                  {quote.carrierName}
                  {quote.serviceName && ` (${quote.serviceName})`}
                </th>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {formatUsd(toNumber(quote.oceanFreightUsd))}
                </td>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {formatUsd(toNumber(quote.localChargesUsd))}
                </td>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {quote.freeTimeDays} วัน
                </td>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {quote.transitDays} วัน
                </td>
                <td className="fig border-b border-line px-2 py-1.5 text-right">
                  {toNumber(quote.onTimePct).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {snapshot?.marketUsdPerFeu && (
        <section className="mt-6">
          <h2 className="text-base">เทียบกับค่าระวางตลาด (Market Reference)</h2>
          <p className="mt-2 max-w-[68ch] text-small leading-relaxed text-ink-soft">
            อ้างอิง Drewry WCI {routeLabel(snapshot.routeCode)} ที่{" "}
            <span className="fig">{formatUsd(snapshot.marketUsdPerFeu)}</span>/FEU อ่านค่าเมื่อ{" "}
            {String(snapshot.marketPeriodDate ?? "").slice(0, 10)} ตัวเลขนี้ถูกบันทึกไว้ ณ
            วันที่ตัดสินใจ จึงสะท้อนภาวะตลาดในวันนั้นแม้อ่านเอกสารนี้ภายหลัง — เป็นค่าอ้างอิงตลาดโดยรวม
            ไม่ใช่ราคาที่ประกาศเฉพาะสำหรับเส้นทางของ shipment นี้
          </p>
          <ul className="mt-2 text-small">
            {(snapshot.quotes ?? []).map((entry) => (
              <li key={entry.carrierName} className="border-b border-line py-1.5">
                {entry.carrierName} —{" "}
                {entry.verdict
                  ? BENCHMARK_VERDICT_LABELS[
                      entry.verdict as keyof typeof BENCHMARK_VERDICT_LABELS
                    ]?.th
                  : "—"}{" "}
                {typeof entry.deltaPct === "number" && (
                  <span className="fig">
                    ({entry.deltaPct > 0 ? "+" : ""}
                    {entry.deltaPct.toFixed(1)}%)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {decision.notes && (
        <section className="mt-6">
          <h2 className="text-base">บันทึกเพิ่มเติม</h2>
          <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-small leading-relaxed">
            {decision.notes}
          </p>
        </section>
      )}

      <footer className="mt-8 border-t border-line pt-3 text-micro text-ink-faint">
        เอกสารนี้สร้างจากระบบ Shippr วิธีคำนวณคือ Analytic Hierarchy Process
        โดยถ่วงน้ำหนักเกณฑ์จากการเปรียบเทียบรายคู่ และให้คะแนนสายเรือจากตัวเลขในใบเสนอราคาจริง
      </footer>
    </article>
  );
}
