import Link from "next/link";

import { displayName, getSessionUser } from "@/lib/auth";
import { MobileNav } from "./MobileNav";
import { SignOutButton } from "./SignOutButton";

const NAV = [
  { href: "/", label: "ภาพรวมตลาด" },
  { href: "/decisions", label: "การตัดสินใจ" },
  { href: "/admin/indices", label: "กรอกข้อมูล" },
  { href: "/admin/vessels", label: "ติดตามเรือ" },
  { href: "/admin/bookings", label: "การจอง" },
];

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-ground/95 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-lead font-semibold tracking-tight">Shippr</span>
          <span className="hidden text-small text-ink-faint lg:inline">
            ค่าระวาง ท่าเรือ และการเลือกสายเรือ
          </span>
        </Link>

        {/*
         * Below `sm` this entire row disappears and MobileNav's hamburger
         * takes over — every item here, including sign-in/out and the
         * primary action, used to just stay crammed onto one line on a
         * phone; now it collapses into a panel instead.
         */}
        <nav className="ml-auto hidden items-center gap-5 text-small sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <span className="flex items-center gap-4 border-l border-line pl-5">
              <span className="text-small text-ink-soft">{displayName(user)}</span>
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

        <MobileNav navItems={NAV} userDisplayName={user ? displayName(user) : null} />
      </div>
    </header>
  );
}
