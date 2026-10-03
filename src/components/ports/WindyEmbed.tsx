"use client";

import { useState } from "react";

/**
 * Windy's marine radar, loaded on request.
 *
 * Deliberately not auto-loaded: it is a third-party iframe that pulls in
 * several hundred kilobytes and sets its own cookies, and most visits to this
 * dashboard never look at the weather. Clicking is the consent.
 */
export function WindyEmbed({
  lat = 13.08,
  lon = 100.88,
  zoom = 4,
}: {
  lat?: number;
  lon?: number;
  zoom?: number;
}) {
  const [loaded, setLoaded] = useState(false);

  const src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=${zoom}&level=surface&overlay=wind&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`;

  return (
    <section className="plan" aria-label="เรดาร์ลมและพายุ">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2">
        <h2 className="text-small font-medium">ลมและพายุในเส้นทางเดินเรือ</h2>
        <span className="slot-address">windy.com</span>
      </div>

      {loaded ? (
        <iframe
          src={src}
          title="เรดาร์ลมและพายุจาก Windy"
          className="h-[22rem] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      ) : (
        <div className="flex h-[22rem] flex-col items-start justify-center gap-3 px-4">
          <p className="max-w-[48ch] text-small text-hull-soft">
            แผนที่ลมและพายุโหลดจาก windy.com เมื่อคุณกดเปิด
            เพื่อไม่ให้หน้าหลักต้องโหลดของจากภายนอกทุกครั้ง
          </p>
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="border border-rule-heavy bg-plan px-3 py-1.5 text-small hover:bg-plan-sunk"
          >
            เปิดแผนที่
          </button>
        </div>
      )}
    </section>
  );
}
