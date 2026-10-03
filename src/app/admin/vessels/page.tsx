import Link from "next/link";

import { RunIngestionButton } from "@/components/chrome/RunIngestionButton";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTrackedVessels } from "@/lib/queries";
import { TrackedVesselForm } from "./TrackedVesselForm";
import { TrackedVesselList } from "./TrackedVesselList";

export const dynamic = "force-dynamic";

export const metadata = { title: "ติดตามเรือ — Shippr" };

export default async function AdminVesselsPage() {
  const [user, vessels, ports] = await Promise.all([
    getSessionUser(),
    getTrackedVessels(),
    prisma.port.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { unlocode: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lead">ติดตามเรือ</h1>
          {user && <RunIngestionButton jobKey="vessel-tracking" label="ตำแหน่งเรือที่ติดตาม" />}
        </div>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ติดตามเรือเฉพาะลำที่มีสินค้าของเราอยู่จริง ด้วยหมายเลข MMSI (ระบบ AIS)
          ไม่ใช่แผนที่ภาพรวมแบบหน้าแรก — ตำแหน่งอัปเดตทุก 15 นาทีก็ต่อเมื่อตั้งค่า GitHub Actions
          ไว้แล้วบน deployment จริง (ดู README) ถ้ายังไม่ได้ตั้งค่า หรืออยากดึงตำแหน่งทันทีไม่ต้องรอ
          กดปุ่ม &quot;ดึงตอนนี้&quot; ด้านบนได้เลย — เรือจะมีตำแหน่งให้เห็นก็ต่อเมื่อเรือส่งสัญญาณ AIS
          อยู่ในช่วงเวลาที่ระบบฟังอยู่พอดี (ไม่ได้การันตีว่ากดแล้วจะเจอทันทีเสมอไป)
        </p>
      </header>

      {user ? (
        <TrackedVesselForm ports={ports} />
      ) : (
        <section className="panel px-4 py-5">
          <p className="text-small text-ink-soft">ต้องเข้าสู่ระบบก่อนจึงจะเพิ่มเรือได้</p>
          <Link href="/signin" className="mt-3 inline-block btn px-3.5 py-1.5 text-small">
            เข้าสู่ระบบ
          </Link>
        </section>
      )}

      <TrackedVesselList vessels={vessels} />
    </div>
  );
}
