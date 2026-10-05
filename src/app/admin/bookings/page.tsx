import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { getCarrierBookingStats } from "@/lib/queries";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "การจองกับสายเรือ — Shippr" };

export default async function AdminBookingsPage() {
  const [user, stats] = await Promise.all([getSessionUser(), getCarrierBookingStats()]);
  const rows = [...stats.values()].sort((a, b) => a.carrierName.localeCompare(b.carrierName));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="panel px-4 py-4">
        <h1 className="text-lead">การจองกับสายเรือ</h1>
        <p className="mt-1 max-w-[70ch] text-small leading-relaxed text-ink-soft">
          บันทึกการจองจริงที่เคยทำกับสายเรือ เพื่อให้หน้าเปรียบเทียบสายเรือใช้ตัวเลขจากประสบการณ์จริง
          แทนการเดา
        </p>
      </header>

      {user ? (
        <BookingForm />
      ) : (
        <section className="panel px-4 py-5">
          <p className="text-small text-ink-soft">ต้องเข้าสู่ระบบก่อนจึงจะบันทึกการจองได้</p>
          <Link href="/signin" className="mt-3 inline-block btn px-3.5 py-1.5 text-small">
            เข้าสู่ระบบ
          </Link>
        </section>
      )}

      <section className="panel overflow-x-auto">
        <div className="border-b-2 border-ink px-4 py-2.5">
          <h2 className="text-base">สรุปตามสายเรือ</h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-small text-ink-soft">ยังไม่มีการจอง บันทึกรายการแรกได้จากฟอร์มด้านบน</p>
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr className="text-micro text-ink-faint">
                <th scope="col" className="border-b border-line px-3 py-2 text-left">สายเรือ</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-right">ยืนยันเฉลี่ย (ชม.)</th>
                <th scope="col" className="border-b border-l border-line px-3 py-2 text-right">ตรงเวลา</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.carrierName}>
                  <td className="border-t border-line px-3 py-2">{r.carrierName}</td>
                  <td className="fig border-l border-t border-line px-3 py-2 text-right">
                    {r.avgConfirmHours !== null
                      ? `${r.avgConfirmHours.toFixed(1)} (${r.confirmedSample} ครั้ง)`
                      : "—"}
                  </td>
                  <td className="fig border-l border-t border-line px-3 py-2 text-right">
                    {r.onTimePct !== null ? `${r.onTimePct.toFixed(0)}% (${r.arrivalSample} ครั้ง)` : "—"}
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
