import Link from "next/link";

import { prisma } from "@/lib/db";
import { thaiFullDate } from "@/lib/format";
import { routeLabel } from "@/lib/benchmark";

export const dynamic = "force-dynamic";

export const metadata = { title: "การตัดสินใจที่บันทึกไว้ — Shippr" };

export default async function DecisionsPage() {
  const decisions = await prisma.aHPDecisionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      caseId: true,
      winnerCarrier: true,
      routeCode: true,
      consistencyRatio: true,
      isConsistent: true,
      createdAt: true,
      _count: { select: { quotes: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel flex flex-wrap items-baseline justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-lead">การตัดสินใจที่บันทึกไว้</h1>
          <p className="mt-1 text-small text-ink-soft">
            ทุกรายการเก็บเมทริกซ์ น้ำหนัก และค่าระวางตลาด ณ วันที่ตัดสินใจไว้ครบ
          </p>
        </div>
        <Link
          href="/decisions/new"
          className="btn px-3.5 py-1.5 text-small"
        >
          เริ่มรายการใหม่
        </Link>
      </header>

      {decisions.length === 0 ? (
        <section className="panel px-4 py-8">
          <p className="max-w-[60ch] text-small leading-relaxed text-ink-soft">
            ยังไม่มีการตัดสินใจที่บันทึกไว้ เมื่อเปรียบเทียบสายเรือเสร็จแล้วกดบันทึก
            รายการจะมาอยู่ที่นี่ พร้อมหน้า memo ที่พิมพ์ส่งลูกค้าได้
          </p>
        </section>
      ) : (
        <section className="panel">
          <ul>
            {decisions.map((decision) => (
              <li key={decision.id} className="border-t border-line first:border-t-0">
                <Link
                  href={`/decisions/${decision.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 hover:bg-surface-sunk"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium">{decision.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-micro text-ink-faint">
                      {decision.caseId && <span className="fig">{decision.caseId}</span>}
                      <span>เลือก {decision.winnerCarrier || "—"}</span>
                      <span>{routeLabel(decision.routeCode)}</span>
                      <span className="fig">{decision._count.quotes} สายเรือ</span>
                      <span>{thaiFullDate(decision.createdAt)}</span>
                    </p>
                  </div>

                  <span
                    className="fig text-small"
                    style={{
                      color: decision.isConsistent
                        ? "var(--color-ink-faint)"
                        : "var(--color-bad)",
                    }}
                  >
                    CR {decision.consistencyRatio.toFixed(3)}
                    {!decision.isConsistent && " — ไม่สอดคล้อง"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
