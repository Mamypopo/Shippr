"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SignOutButton } from "./SignOutButton";

export interface MobileNavItem {
  href: string;
  label: string;
}

/**
 * The hamburger menu, below the `sm` breakpoint.
 *
 * Everything that lives in the desktop nav row — the three section links,
 * sign-in or the account line, and the primary action — collapses in here
 * rather than vanishing, which is what the desktop nav alone did below `sm`
 * before this existed.
 *
 * A plain `userDisplayName` string rather than the session-user object: the
 * header resolves the session server-side, and a client component should
 * cross that boundary with only what it renders, not a type it has no
 * business knowing the shape of.
 */
export function MobileNav({
  navItems,
  userDisplayName,
}: {
  navItems: MobileNavItem[];
  userDisplayName: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-auto sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
        className="flex items-center justify-center text-ink"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        // `absolute` rather than a fixed pixel offset: the nearest positioned
        // ancestor is <header> (it's `sticky`), so this resolves against the
        // header's own box regardless of its exact rendered height — no
        // magic number to drift out of sync with the logo's line height.
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full z-20 border-b border-line bg-ground"
        >
          <nav className="flex flex-col divide-y divide-line px-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-body text-ink-soft"
              >
                {item.label}
              </Link>
            ))}

            <div className="flex items-center justify-between py-3 text-body">
              {userDisplayName ? (
                <>
                  <span className="text-ink-soft">{userDisplayName}</span>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/signin"
                  onClick={() => setOpen(false)}
                  className="text-ink-soft"
                >
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>

            <div className="py-3">
              <Link
                href="/decisions/new"
                onClick={() => setOpen(false)}
                className="btn-primary block px-3.5 py-2 text-center text-small"
              >
                เปรียบเทียบสายเรือ
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
