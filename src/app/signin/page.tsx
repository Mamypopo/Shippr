import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "เข้าสู่ระบบ — Shippr" };

export default async function SignInPage(props: PageProps<"/signin">) {
  const [user, params] = await Promise.all([getSessionUser(), props.searchParams]);

  const next = typeof params.next === "string" ? params.next : undefined;
  if (user) redirect(next?.startsWith("/") ? next : "/");

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:px-8">
      <h1 className="text-title">เข้าสู่ระบบ</h1>
      <p className="mt-2 text-small leading-relaxed text-ink-soft">
        ดูข้อมูลตลาดได้โดยไม่ต้องเข้าสู่ระบบ แต่การกรอกค่าดัชนี สถานะท่าเรือ
        และการบันทึกผลตัดสินใจ ต้องเข้าสู่ระบบก่อน
      </p>

      <SignInForm next={next} />

      <p className="mt-6 border-t border-line pt-4 text-micro leading-relaxed text-ink-faint">
        ระบบนี้ไม่มีการสมัครเอง และไม่มีรีเซ็ตรหัสผ่านผ่านอีเมล ถ้าลืมรหัสผ่านหรือต้องการบัญชีใหม่
        ให้ผู้ดูแลระบบสั่ง{" "}
        <code className="mono text-ink-soft">npm run user passwd &lt;ชื่อผู้ใช้&gt;</code>
      </p>
    </div>
  );
}
