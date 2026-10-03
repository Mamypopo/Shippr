import type { NewsItemView } from "@/lib/queries";
import { TAG_LABELS, type DisruptionTagKey } from "@/lib/disruption-keywords";
import { relativeDaysTh } from "@/lib/format";

const SEVERITY_INK: Record<string, string> = {
  ALERT: "var(--color-hazard)",
  WATCH: "var(--color-watch)",
  INFO: "var(--color-rule-heavy)",
};

const SEVERITY_TH: Record<string, string> = {
  ALERT: "เตือนภัย",
  WATCH: "เฝ้าระวัง",
  INFO: "ทั่วไป",
};

export function DisruptionList({ items }: { items: NewsItemView[] }) {
  return (
    <section className="plan" aria-label="ข่าว disruption">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h2 className="text-small font-medium">ข่าวที่กระทบการขนส่ง</h2>
        <span className="slot-address">Loadstar · gCaptain</span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-small text-hull-soft">
          ยังไม่มีข่าวในระบบ รัน job ดึง RSS เพื่อเริ่มเก็บข้อมูล
        </p>
      ) : (
        <ul className="max-h-[32rem] overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 border-t border-rule px-4 py-3 first:border-t-0">
              <span
                aria-hidden="true"
                className="mt-[0.4rem] h-full min-h-[1.5rem] w-[3px] shrink-0"
                style={{ background: SEVERITY_INK[item.severity] }}
              />

              <div className="min-w-0">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-base leading-snug underline-offset-4 hover:underline"
                >
                  {item.title}
                </a>

                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-micro text-hull-faint">
                  <span style={{ color: SEVERITY_INK[item.severity] }}>
                    {SEVERITY_TH[item.severity] ?? item.severity}
                  </span>
                  <span>{item.sourceName}</span>
                  <span>{relativeDaysTh(item.publishedAt)}</span>
                  {item.tags.map((tag) => (
                    <span key={tag} className="border border-rule px-1">
                      {TAG_LABELS[tag as DisruptionTagKey]?.th ?? tag}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
