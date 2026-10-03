import Link from "next/link";

import { PortBayPlan } from "@/components/ports/PortBayPlan";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPortSnapshots } from "@/lib/queries";
import { PortStatusForms } from "./PortStatusForms";

export const dynamic = "force-dynamic";

export const metadata = { title: "ความแออัดของท่าเรือ — Shippr" };

export default async function AdminPortsPage() {
  const [user, ports, snapshots] = await Promise.all([
    getSessionUser(),
    prisma.port.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { unlocode: true, name: true },
    }),
    getPortSnapshots(),
  ]);

  

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel px-4 py-4">
        <h1 className="text-lead">ความแออัดของท่าเรือ</h1>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ไม่มี API ฟรีที่เชื่อถือได้สำหรับเวลารอเทียบท่า ข้อมูลส่วนนี้จึงมาจากการกรอก
          หรือนำเข้า CSV รายสัปดาห์จากรายงานที่บริษัทใช้
        </p>
      </header>

      <PortBayPlan ports={snapshots} />

      {user ? (
        <PortStatusForms ports={ports} />
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
    </div>
  );
}
