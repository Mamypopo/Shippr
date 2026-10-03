/**
 * Live vessel positions via aisstream.io, for the specific vessels a
 * shipment is actually on — not a regional view (that's `LiveShipMap`,
 * which embeds MarineTraffic for exactly that).
 *
 * aisstream.io is WebSocket-only: there is no REST endpoint to simply ask
 * "where is vessel X right now." Holding a connection open permanently,
 * the way a live tracker normally would, is not an option on Vercel's
 * serverless functions — nothing here can run longer than `maxDuration`.
 * Instead, this opens a short-lived connection, subscribes to the specific
 * MMSIs being tracked, collects whatever position reports arrive within a
 * bounded listening window, then closes. Run on a schedule (every 15-30
 * minutes, via cron), that gives "recently known position," which is the
 * right fit for "is my shipment's vessel getting close" — not a
 * replacement for true live tracking, but not pretending to be one either.
 *
 * Field names below follow aisstream.io's documented `PositionReport`
 * message shape (`UserID`, `Latitude`, `Longitude`, `Sog`, `Cog`,
 * `NavigationalStatus`). `MetaData`'s own field names are read
 * defensively — the docs describe it only as "normalized context such as
 * MMSI and last known position" without a worked example — so this reads
 * `UserID` from the typed `PositionReport` body (confirmed from the
 * documented schema) rather than depending on an unconfirmed `MetaData`
 * shape for anything load-bearing.
 */

const STREAM_URL = "wss://stream.aisstream.io/v0/stream";
const DEFAULT_LISTEN_MS = 25_000;

/** Covers the whole planet — aisstream.io requires a bounding box even when the actual filter is "these specific MMSIs," which may be anywhere in transit. */
const WORLDWIDE_BOUNDING_BOX = [
  [
    [-90, -180],
    [90, 180],
  ],
];

export interface VesselPositionReport {
  mmsi: number;
  lat: number;
  lon: number;
  speedKnots: number | null;
  courseDeg: number | null;
  navStatus: string | null;
  observedAt: Date;
}

/** AIS navigational status codes 0-15, per ITU-R M.1371. */
const NAV_STATUS_LABELS: Record<number, string> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuvrability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Engaged in fishing",
  8: "Under way sailing",
  11: "Power-driven vessel towing astern",
  12: "Power-driven vessel pushing ahead",
  14: "AIS-SART active",
};

function navStatusLabel(code: unknown): string | null {
  return typeof code === "number" ? (NAV_STATUS_LABELS[code] ?? null) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Parses one `PositionReport` stream message. Returns `null` for anything
 * that isn't a position report, or that is missing the fields this needs —
 * never throws, since one malformed message must not take down the whole
 * listening window.
 */
export function parsePositionReportMessage(raw: unknown): VesselPositionReport | null {
  if (typeof raw !== "object" || raw === null) return null;
  const envelope = raw as Record<string, unknown>;
  if (envelope.MessageType !== "PositionReport") return null;

  const message = envelope.Message;
  if (typeof message !== "object" || message === null) return null;
  const report = (message as Record<string, unknown>).PositionReport;
  if (typeof report !== "object" || report === null) return null;

  const r = report as Record<string, unknown>;
  const mmsi = asFiniteNumber(r.UserID);
  const lat = asFiniteNumber(r.Latitude);
  const lon = asFiniteNumber(r.Longitude);
  if (mmsi === null || lat === null || lon === null) return null;

  return {
    mmsi,
    lat,
    lon,
    speedKnots: asFiniteNumber(r.Sog),
    courseDeg: asFiniteNumber(r.Cog),
    navStatus: navStatusLabel(r.NavigationalStatus),
    observedAt: new Date(),
  };
}

/**
 * Listens briefly for position reports on the given MMSIs, then returns the
 * latest report seen per vessel. A tracked vessel that doesn't appear in the
 * result just didn't transmit (or wasn't in range of a receiving station)
 * during this particular window — normal, especially mid-ocean, not an
 * error.
 */
export async function fetchVesselPositions(
  mmsiList: number[],
  apiKey: string,
  listenMs = DEFAULT_LISTEN_MS,
): Promise<VesselPositionReport[]> {
  if (mmsiList.length === 0) return [];

  return new Promise((resolve, reject) => {
    const latest = new Map<number, VesselPositionReport>();
    const ws = new WebSocket(STREAM_URL);
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Already closing/closed — nothing to do.
      }
      if (error) reject(error);
      else resolve([...latest.values()]);
    };

    const timer = setTimeout(() => finish(), listenMs);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: WORLDWIDE_BOUNDING_BOX,
          FiltersShipMMSI: mmsiList.map(String),
          FilterMessageTypes: ["PositionReport"],
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      try {
        const text = typeof event.data === "string" ? event.data : String(event.data);
        const report = parsePositionReportMessage(JSON.parse(text));
        if (report) latest.set(report.mmsi, report);
      } catch {
        // A malformed single message must not fail the whole batch.
      }
    });

    ws.addEventListener("error", () => finish(new Error("aisstream.io connection error")));
    ws.addEventListener("close", (event) => {
      const closeEvent = event as unknown as { code?: number };
      if (!settled && closeEvent.code !== 1000) {
        finish(new Error(`aisstream.io closed unexpectedly (code ${closeEvent.code ?? "unknown"})`));
      }
    });
  });
}
