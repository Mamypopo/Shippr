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
          <h1 className="text-lead">
            ติดตามเรือ <span className="label align-middle" style={{ color: "var(--color-warn)" }}>BETA</span>
          </h1>
          {user && <RunIngestionButton jobKey="vessel-tracking" label="ตำแหน่งเรือที่ติดตาม" />}
        </div>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ติดตามเรือเฉพาะลำที่มีสินค้าของเราอยู่จริง ด้วยหมายเลข MMSI ผ่าน aisstream.io —
          บริการฟรีที่รับสัญญาณจากเครื่องรับของอาสาสมัครทั่วโลก ซึ่งหนาแน่นมากในยุโรป/อเมริกา
          แต่ <strong>บางมากในอ่าวไทย</strong> (ทดสอบแล้วไม่พบสัญญาณจากอ่าวไทยเลยในการทดสอบหลายรอบ)
          พูดตรงๆ คือ <strong>ไม่ควรใช้พึ่งตอนเรือใกล้ถึงท่าแหลมฉบัง</strong> ซึ่งเป็นช่วงที่ต้องการข้อมูลที่สุดพอดี
        </p>
        <p className="mt-2 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          ใช้ได้ดีกว่าตอนเรืออยู่ในเขตที่มีสัญญาณหนาแน่น (เช่น ใกล้สิงคโปร์ ยุโรป อเมริกา) ถ้าตำแหน่งล่าสุด
          เก่าเกิน 6 ชั่วโมง ระบบจะเปลี่ยนไปโชว์ปุ่มลิงก์ไปดูสดบน MarineTraffic แทนการโชว์ตัวเลขเก่าที่อาจทำให้เข้าใจผิด
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
