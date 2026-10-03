import type { NewsItemView } from "@/lib/queries";
import { TAG_LABELS, type DisruptionTagKey } from "@/lib/disruption-keywords";
import { relativeDaysTh } from "@/lib/format";

const SEVERITY_PAINT: Record<string, { fill: string; ink: string; th: string }> = {
  ALERT: { fill: "var(--color-hazard)", ink: "var(--color-hazard-ink)", th: "เตือนภัย" },
  WATCH: { fill: "var(--color-watch)", ink: "var(--color-watch-ink)", th: "เฝ้าระวัง" },
  INFO: { fill: "var(--color-plan-sunk)", ink: "var(--color-hull)", th: "ทั่วไป" },
};

export function DisruptionList({ items }: { items: NewsItemView[] }) {
  return (
    <section className="plan flex flex-col" aria-label="ข่าว disruption">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-hull px-4 py-2.5">
        <h2 className="text-base">ข่าวที่กระทบการขนส่ง</h2>
        <span className="addr">Loadstar · gCaptain</span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-7 text-small text-hull-soft">
          ยังไม่มีข่าวในระบบ รัน job ดึง RSS เพื่อเริ่มเก็บข้อมูล
        </p>
      ) : (
        <ul className="max-h-136 overflow-y-auto">
          {items.map((item) => {
            const paint = SEVERITY_PAINT[item.severity] ?? SEVERITY_PAINT.INFO;

            return (
              <li key={item.id} className="border-t-2 border-hull/15 px-4 py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className="px-1.5 py-0.5 text-micro font-semibold"
                    style={{ background: paint.fill, color: paint.ink, fontFamily: "var(--font-display)" }}
                  >
                    {paint.th}
                  </span>
                  <span className="text-micro text-hull-faint">{item.sourceName}</span>
                  <span className="text-micro text-hull-faint">
                    {relativeDaysTh(item.publishedAt)}
                  </span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="border border-hull px-1.5 text-micro">
                      {TAG_LABELS[tag as DisruptionTagKey]?.th ?? tag}
                    </span>
                  ))}
                </div>

                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1.5 block max-w-[72ch] text-base leading-snug underline-offset-4 hover:underline hover:decoration-2"
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
