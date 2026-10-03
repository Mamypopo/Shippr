import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { prisma, toNumber } from "@/lib/db";
import { formatIndexValue, relativeDaysTh, SOURCE_LABELS, thaiShortDate } from "@/lib/format";
import { latestRunsBySource, type LatestRun } from "@/lib/ingest";
import { routeLabel } from "@/lib/benchmark";
import { ManualIndexForm } from "./ManualIndexForm";
import { RunIngestionButton } from "./RunIngestionButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "กรอกข้อมูลตลาด — Shippr" };

export default async function AdminIndicesPage() {
  const [user, recent, runs] = await Promise.all([
    getSessionUser(),
    prisma.freightIndex.findMany({
      orderBy: [{ periodDate: "desc" }, { indexCode: "asc" }],
      take: 30,
      select: {
        id: true,
        indexCode: true,
        routeCode: true,
        periodDate: true,
        value: true,
        unit: true,
        source: true,
      },
    }),
    latestRunsBySource(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel px-4 py-4">
        <h1 className="text-lead">กรอกข้อมูลตลาด</h1>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ดูสถานะการดึงข้อมูลอัตโนมัติ และกรอกค่าดัชนีที่ดึงเองไม่ได้
        </p>
      </header>

      <IngestionStatus runs={runs} canRun={Boolean(user)} />

      {user ? (
        <ManualIndexForm />
      ) : (
        <section className="panel px-4 py-5">
          <p className="text-small text-ink-soft">ต้องเข้าสู่ระบบก่อนจึงจะกรอกข้อมูลได้</p>
          <Link
            href="/signin"
            className="mt-3 inline-block btn px-3.5 py-1.5 text-small"
          >
            เข้าสู่ระบบ
          </Link>
        </section>
      )}

      <section className="panel overflow-x-auto">
        <div className="border-b-2 border-ink px-4 py-2.5">
          <h2 className="text-base">ค่าที่บันทึกล่าสุด</h2>
        </div>

        {recent.length === 0 ? (
          <p className="px-4 py-6 text-small text-ink-soft">ยังไม่มีข้อมูลในระบบ</p>
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr className="text-micro text-ink-faint">
                <th scope="col" className="border-b border-line px-3 py-2 text-left">งวด</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">ดัชนี</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">เส้นทาง</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-right">ค่า</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-left">ที่มา</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td className="fig border-t border-line px-3 py-2">
                    {thaiShortDate(row.periodDate)}
                  </td>
                  <td className="border-l border-t border-line px-3 py-2">{row.indexCode}</td>
                  <td className="border-l border-t border-line px-3 py-2">
                    {routeLabel(row.routeCode)}
                  </td>
                  <td className="fig border-l border-t border-line px-3 py-2 text-right">
                    {formatIndexValue(toNumber(row.value), row.unit)}
                  </td>
                  <td className="border-l border-t border-line px-3 py-2 text-micro text-ink-faint">
                    {SOURCE_LABELS[row.source] ?? row.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const RUN_SOURCES: Array<{ key: string; label: string }> = [
  { key: "freight-index", label: "ดัชนีค่าระวาง (รายสัปดาห์)" },
  { key: "market-sentiment", label: "BDRY / น้ำมันดิบ / ZIM (รายวัน)" },
  { key: "news", label: "ข่าว RSS (ทุก 4 ชม.)" },
];

/**
 * Ingestion health. The point of surfacing this is that a job which has been
 * quietly failing for a fortnight looks exactly like a quiet market unless
 * someone says so.
 */
/**
 * "สำเร็จบางส่วน" alone, next to a row count of zero, reads as a vague kind
 * of working — it isn't clear whether that means nothing happened or
 * something quietly failed. This spells out which, so "the fetch worked but
 * wrote nothing" and "the fetch partly failed" never look the same.
 */
function runStatusLabel(run: LatestRun): string {
  if (run.status === "FAILED") return "ล้มเหลว";

  const base = run.status === "SUCCESS" ? "สำเร็จ" : "สำเร็จบางส่วน";
  return run.rowsWritten === 0 ? `${base} — ไม่มีข้อมูลใหม่` : base;
}

function IngestionStatus({
  runs,
  canRun,
}: {
  runs: Record<string, LatestRun | undefined>;
  canRun: boolean;
}) {
  return (
    <section className="panel">
      <div className="border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">สถานะการดึงข้อมูลอัตโนมัติ</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3">
        {RUN_SOURCES.map((source, i) => {
          const run = runs[source.key];
          const ink =
            !run || run.status === "FAILED"
              ? "var(--color-bad)"
              : run.status === "PARTIAL"
                ? "var(--color-warn)"
                : "var(--color-ok)";

          return (
            <article
              key={source.key}
              className={`border-t border-line p-3 sm:border-t-0 ${i > 0 ? "sm:border-l" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-small">{source.label}</p>
                {canRun && <RunIngestionButton jobKey={source.key} label={source.label} />}
              </div>

              {run ? (
                <>
                  <p className="mt-1 text-small" style={{ color: ink }}>
                    {runStatusLabel(run)}
                  </p>
                  <p className="mt-1 text-micro text-ink-faint">
                    {relativeDaysTh(run.startedAt)} · เขียน{" "}
                    <span className="fig">{run.rowsWritten}</span> แถว
                  </p>
                  {/* The explanation behind a partial/failed/zero-row run —
                      kept on the page rather than only in the toast that
                      closes a few seconds after the button is clicked. */}
                  {run.errorMessage && (
                    <p className="mt-2 border-t border-line pt-2 text-micro leading-relaxed text-ink-soft">
                      {run.errorMessage}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-small" style={{ color: ink }}>
                  ยังไม่เคยรัน
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
