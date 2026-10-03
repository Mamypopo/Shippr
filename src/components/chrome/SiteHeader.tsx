import Link from "next/link";

import { displayName, getSessionUser } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

const NAV = [
  { href: "/", label: "ภาพรวมตลาด" },
  { href: "/decisions", label: "การตัดสินใจ" },
  { href: "/admin/indices", label: "กรอกข้อมูล" },
];

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-ground/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-lead font-semibold tracking-tight">Shippr</span>
          <span className="hidden text-small text-ink-faint lg:inline">
            ค่าระวาง ท่าเรือ และการเลือกสายเรือ
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-5 text-small">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-ink-soft transition-colors hover:text-ink sm:inline"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <span className="flex items-center gap-4 border-l border-line pl-5">
              <span className="hidden text-small text-ink-soft sm:inline">
                {displayName(user)}
              </span>
              <SignOutButton />
            </span>
          ) : (
            <Link
              href="/signin"
              className="border-l border-line pl-5 text-small text-ink-soft transition-colors hover:text-ink"
            >
              เข้าสู่ระบบ
            </Link>
          )}

          <Link href="/decisions/new" className="btn-primary px-3.5 py-1.5 text-small">
            เปรียบเทียบสายเรือ
          </Link>
        </nav>
      </div>
    </header>
  );
}
