import Link from "next/link";

const NAV = [
  { href: "/", label: "ภาพรวมตลาด" },
  { href: "/decisions", label: "การตัดสินใจ" },
  { href: "/decisions/new", label: "เปรียบเทียบสายเรือ" },
  { href: "/admin/indices", label: "กรอกข้อมูล" },
];

export function SiteHeader() {
  return (
    <header className="no-print border-b-2 border-rule-heavy bg-plan">
      <div className="mx-auto flex max-w-350 flex-wrap items-baseline gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-lead font-semibold tracking-tight">Shippr</span>
          <span className="text-micro text-hull-faint">
            ข้อมูลตลาดค่าระวางและการเลือกสายเรือ
          </span>
        </Link>

        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-small">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-hull-soft underline-offset-4 hover:text-hull hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
