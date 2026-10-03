import Link from "next/link";

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
        <h1 className="text-lead">ติดตามเรือ</h1>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ติดตามเรือเฉพาะลำที่มีสินค้าของเราอยู่จริง ด้วยหมายเลข MMSI (ระบบ AIS)
          ไม่ใช่แผนที่ภาพรวมแบบหน้าแรก — ตำแหน่งอัปเดตทุก 15 นาทีเมื่อเรือส่งสัญญาณอยู่ในรัศมีสถานีรับ
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
