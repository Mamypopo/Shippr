import Link from "next/link";
import { notFound } from "next/navigation";

import { CRITERIA, CRITERION_LABELS, type CriterionKey, type RankedAlternative } from "@/lib/ahp";
import { routeLabel } from "@/lib/benchmark";
import { prisma, toNumber } from "@/lib/db";
import { formatUsd, thaiFullDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage(props: PageProps<"/decisions/[id]">) {
  const { id } = await props.params;

  const decision = await prisma.aHPDecisionLog.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "asc" } } },
  });

  if (!decision) notFound();

  const ranking = (decision.alternativeScores ?? []) as unknown as RankedAlternative<CriterionKey>[];
  const weights = (decision.criteriaWeights ?? {}) as Record<CriterionKey, number>;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="plan px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lead">{decision.title}</h1>
            <p className="mt-1 flex flex-wrap gap-x-4 text-micro text-hull-faint">
              <span>{thaiFullDate(decision.createdAt)}</span>
              <span>{routeLabel(decision.routeCode)}</span>
              {decision.presetKey && <span>{decision.presetKey}</span>}
            </p>
          </div>

          <nav className="no-print flex flex-wrap gap-2">
            <Link
              href={`/decisions/${id}/memo`}
              className="btn px-3.5 py-1.5 text-small"
            >
              เปิด memo สำหรับพิมพ์
            </Link>
            <a
              href={`/api/export/${id}?format=xlsx`}
              className="btn px-3.5 py-1.5 text-small"
            >
              ดาวน์โหลด Excel
            </a>
            <a
              href={`/api/export/${id}?format=json`}
              className="btn px-3.5 py-1.5 text-small"
            >
              ดาวน์โหลด JSON
            </a>
          </nav>
        </div>

        <p className="mt-4 text-base">
          สายเรือที่ได้คะแนนสูงสุดคือ{" "}
          <strong className="font-medium">{decision.winnerCarrier}</strong>
        </p>

        {!decision.isConsistent && (
          <p className="mt-2 text-small text-hazard">
            การให้น้ำหนักในรายการนี้มี CR {decision.consistencyRatio.toFixed(3)}
            ซึ่งเกิน 0.1 — ผลลัพธ์ยังใช้อ้างอิงกับลูกค้าไม่ได้จนกว่าจะปรับให้สอดคล้อง
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="plan">
          <div className="border-b-2 border-hull px-4 py-2.5">
            <h2 className="text-base">อันดับและคะแนน</h2>
          </div>
          <ol>
            {ranking.map((entry) => (
              <li
                key={entry.id}
                className="border-t border-rule px-4 py-3 first:border-t-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-base">
                    <span className="fig mr-2 text-hull-faint">{entry.rank}</span>
                    {entry.label}
                  </p>
                  <span className="fig text-figure-sm leading-none">
                    {entry.score100.toFixed(1)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full" style={{ background: "var(--color-plan-sunk)" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(1, entry.score100)}%`,
                      background:
                        entry.rank === 1 ? "var(--color-clear)" : "var(--color-hull-faint)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="plan">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-hull px-4 py-2.5">
            <h2 className="text-base">น้ำหนักเกณฑ์</h2>
            <span className="addr">
              λmax {decision.lambdaMax.toFixed(3)} · CI {decision.consistencyIndex.toFixed(3)} · CR{" "}
              {decision.consistencyRatio.toFixed(3)}
            </span>
          </div>
          <ul>
            {CRITERIA.map((key) => (
              <li
                key={key}
                className="flex items-baseline justify-between gap-3 border-t border-rule px-4 py-2 first:border-t-0"
              >
                <span className="text-small">{CRITERION_LABELS[key].th}</span>
                <span className="fig text-small">
                  {((weights[key] ?? 0) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="plan overflow-x-auto">
        <div className="border-b-2 border-hull px-4 py-2.5">
          <h2 className="text-base">ใบเสนอราคาที่ใช้ตัดสินใจ</h2>
        </div>
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="text-micro text-hull-faint">
              <th scope="col" className="border-b border-rule px-3 py-2 text-left">สายเรือ</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">Ocean freight</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">Local charges</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">Free time</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">Transit</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">On-time</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">ตู้</th>
              <th scope="col" className="border-b border-l border-rule px-3 py-2 text-right">บริการ</th>
            </tr>
          </thead>
          <tbody>
            {decision.quotes.map((quote) => (
              <tr key={quote.id}>
                <th scope="row" className="border-t border-rule px-3 py-2 text-left font-normal">
                  {quote.carrierName}
                  {quote.serviceName && (
                    <span className="ml-2 text-micro text-hull-faint">{quote.serviceName}</span>
                  )}
                </th>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {formatUsd(toNumber(quote.oceanFreightUsd))}
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {formatUsd(toNumber(quote.localChargesUsd))}
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {quote.freeTimeDays} วัน
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {quote.transitDays} วัน
                  {!quote.isDirect && (
                    <span className="ml-1 text-micro text-hull-faint">
                      ถ่ายลำ {quote.transshipmentCount}
                    </span>
                  )}
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {toNumber(quote.onTimePct).toFixed(0)}%
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {quote.equipmentAvailabilityScore}/10
                </td>
                <td className="fig border-l border-t border-rule px-3 py-2 text-right">
                  {quote.serviceScore}/10
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {decision.notes && (
        <section className="plan px-4 py-4">
          <h2 className="text-base">บันทึกเพิ่มเติม</h2>
          <p className="mt-2 max-w-[70ch] whitespace-pre-wrap text-small leading-relaxed">
            {decision.notes}
          </p>
        </section>
      )}
    </div>
  );
}
