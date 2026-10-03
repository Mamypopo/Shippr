import Link from "next/link";

const NAV = [
  { href: "/", label: "ภาพรวมตลาด" },
  { href: "/decisions", label: "การตัดสินใจ" },
  { href: "/decisions/new", label: "เปรียบเทียบสายเรือ" },
  { href: "/admin/indices", label: "กรอกข้อมูล" },
];

/** The masthead is painted ink, the way a plan's title block is. */
export function SiteHeader() {
  return (
    <header className="no-print bg-hull text-plan">
      <div className="mx-auto flex max-w-350 flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-display text-lead font-bold tracking-wide">SHIPPR</span>
          <span className="text-micro text-plan/60">ค่าระวาง ท่าเรือ และการเลือกสายเรือ</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-small">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-plan/75 underline-offset-[6px] hover:text-plan hover:underline hover:decoration-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
