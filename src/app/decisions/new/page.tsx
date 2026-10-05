import { DecisionWorkspace } from "@/components/ahp/DecisionWorkspace";
import { ROUTE_CODES } from "@/lib/benchmark";
import { prisma } from "@/lib/db";
import { getBenchmarkForRoute, getCarrierBookingStats } from "@/lib/queries";
import { thaiShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "เปรียบเทียบสายเรือ — Shippr",
};

export default async function NewDecisionPage() {
  const [benchmark, lanes, bookingStats] = await Promise.all([
    getBenchmarkForRoute("COMPOSITE"),
    prisma.freightIndex.findMany({
      where: { indexCode: "WCI" },
      distinct: ["routeCode"],
      select: { routeCode: true },
    }),
    getCarrierBookingStats(),
  ]);

  // Offer the lanes we actually hold a benchmark for first, then the rest of
  // the known codes so a quote on a new lane can still be recorded.
  const withData = lanes.map((l) => l.routeCode);
  const availableRoutes = [...new Set([...withData, ...Object.values(ROUTE_CODES)])];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel px-4 py-4">
        <h1 className="text-lead">เปรียบเทียบสายเรือด้วย AHP</h1>
        <p className="mt-2 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          กรอกใบเสนอราคา 2–5 สาย แล้วบอกระบบว่าเกณฑ์ไหนสำคัญกว่ากันทีละคู่
          อันดับจะขยับตามทันทีที่คุณเลื่อน และระบบจะเตือนถ้าคำตอบขัดแย้งกันเอง
        </p>
      </header>

      <DecisionWorkspace
        benchmark={
          benchmark
            ? {
                value: benchmark.value,
                periodDate: thaiShortDate(benchmark.periodDate),
                routeCode: benchmark.routeCode,
              }
            : null
        }
        availableRoutes={availableRoutes}
        carrierHistory={Object.fromEntries(bookingStats)}
      />
    </div>
  );
}
