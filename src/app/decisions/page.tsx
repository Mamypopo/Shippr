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
      winnerCarrier: true,
      routeCode: true,
      consistencyRatio: true,
      isConsistent: true,
      createdAt: true,
      _count: { select: { quotes: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="plan flex flex-wrap items-baseline justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-lead font-medium">การตัดสินใจที่บันทึกไว้</h1>
          <p className="mt-1 text-small text-hull-soft">
            ทุกรายการเก็บเมทริกซ์ น้ำหนัก และค่าระวางตลาด ณ วันที่ตัดสินใจไว้ครบ
          </p>
        </div>
        <Link
          href="/decisions/new"
          className="border border-rule-heavy bg-plan px-3 py-1.5 text-small hover:bg-plan-sunk"
        >
          เริ่มรายการใหม่
        </Link>
      </header>

      {decisions.length === 0 ? (
        <section className="plan px-4 py-8">
          <p className="max-w-[60ch] text-small leading-relaxed text-hull-soft">
            ยังไม่มีการตัดสินใจที่บันทึกไว้ เมื่อเปรียบเทียบสายเรือเสร็จแล้วกดบันทึก
            รายการจะมาอยู่ที่นี่ พร้อมหน้า memo ที่พิมพ์ส่งลูกค้าได้
          </p>
        </section>
      ) : (
        <section className="plan">
          <ul>
            {decisions.map((decision) => (
              <li key={decision.id} className="border-t border-rule first:border-t-0">
                <Link
                  href={`/decisions/${decision.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 hover:bg-plan-sunk"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium">{decision.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-micro text-hull-faint">
                      <span>เลือก {decision.winnerCarrier || "—"}</span>
                      <span>{routeLabel(decision.routeCode)}</span>
                      <span className="tnum">{decision._count.quotes} สายเรือ</span>
                      <span>{thaiFullDate(decision.createdAt)}</span>
                    </p>
                  </div>

                  <span
                    className="tnum text-small"
                    style={{
                      color: decision.isConsistent
                        ? "var(--color-hull-faint)"
                        : "var(--color-hazard)",
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
