import { SignInForm } from "./SignInForm";

export const metadata = { title: "เข้าสู่ระบบ — Shippr" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-[32rem] px-4 py-10 sm:px-6">
      <section className="panel px-5 py-6">
        <h1 className="text-lead">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-small leading-relaxed text-ink-soft">
          ใช้ลิงก์ที่ส่งเข้าอีเมล ไม่ต้องจำรหัสผ่าน
          บัญชีแรกของระบบจะได้สิทธิ์ ADMIN บัญชีถัดไปเริ่มที่ VIEWER
        </p>
        <SignInForm />
      </section>
    </div>
  );
}
