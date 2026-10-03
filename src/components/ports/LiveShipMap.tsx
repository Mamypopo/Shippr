"use client";

import { useState } from "react";

/** The four chokepoints worth a one-click jump, not a free-form search box this dashboard doesn't need. */
const CHOKEPOINTS = [
  { key: "laem-chabang", label: "แหลมฉบัง", lat: 13.08, lon: 100.88, zoom: 10 },
  { key: "singapore", label: "สิงคโปร์ / ช่องแคบมะละกา", lat: 1.28, lon: 103.85, zoom: 9 },
  { key: "red-sea", label: "ทะเลแดง / บับเอลมันเดบ", lat: 12.58, lon: 43.33, zoom: 7 },
  { key: "panama", label: "คลองปานามา", lat: 9.08, lon: -79.68, zoom: 10 },
] as const;

/**
 * Live AIS vessel positions, via MarineTraffic's embeddable map.
 *
 * VesselFinder's equivalent embed (`vesselfinder.com/embed`) was tried first
 * and ruled out: it sends `X-Frame-Options: SAMEORIGIN`, which makes a
 * browser refuse to render it in anyone else's page — confirmed from the
 * response headers directly, not assumed. MarineTraffic's `/ais/embed/` path
 * sends neither that header nor an enforced frame-blocking CSP, which is why
 * it is the one used here.
 *
 * Click-to-load for the same reason as `WindyEmbed`: a third-party iframe
 * that most page visits never look at shouldn't cost every visit its weight.
 */
export function LiveShipMap() {
  const [loaded, setLoaded] = useState(false);
  const [point, setPoint] = useState<(typeof CHOKEPOINTS)[number]>(CHOKEPOINTS[0]);

  const src = `https://www.marinetraffic.com/en/ais/embed/zoom:${point.zoom}/centery:${point.lat}/centerx:${point.lon}/maptype:4/shownames:false/mmsi:0/shipid:0/fleet:/fleet_name:/show_wx_stations:false`;

  return (
    <section className="panel" aria-label="แผนที่ตำแหน่งเรือสด">
      <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-base">ตำแหน่งเรือสด</h2>
        <span className="label">marinetraffic.com</span>
      </div>

      {loaded && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
          {CHOKEPOINTS.map((cp) => (
            <button
              key={cp.key}
              type="button"
              onClick={() => setPoint(cp)}
              className={`px-2.5 py-1 text-micro ${
                cp.key === point.key ? "btn-primary" : "btn"
              }`}
            >
              {cp.label}
            </button>
          ))}
        </div>
      )}

      {loaded ? (
        <iframe
          key={point.key}
          src={src}
          title={`ตำแหน่งเรือสดจาก MarineTraffic — ${point.label}`}
          className="h-[22rem] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      ) : (
        <div className="flex h-[22rem] flex-col items-start justify-center gap-3 px-4">
          <p className="max-w-[48ch] text-small text-ink-soft">
            แผนที่ตำแหน่งเรือจริงจาก AIS (ระบบระบุตัวตนเรืออัตโนมัติ) โหลดจาก
            marinetraffic.com เมื่อคุณกดเปิด มีปุ่มสลับไปดูจุดคอขวดหลักให้เลือก
          </p>
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="btn px-3.5 py-1.5 text-small"
          >
            เปิดแผนที่
          </button>
        </div>
      )}
    </section>
  );
}
