/**
 * Major container carriers, for the dropdown on a carrier quote and on a
 * tracked vessel — and each one's own shipment-tracking page, for a link
 * that doesn't depend on AIS coverage at all (see LiveShipMap/admin/vessels'
 * BETA notice on how thin that coverage is in the Gulf of Thailand).
 *
 * URLs were checked with a direct request before shipping, same as every
 * other external link added this session — but several carrier sites return
 * 403/502 to a non-browser request while working fine in an actual browser
 * (the same bot-defense pattern hit repeatedly elsewhere in this project, on
 * cbonds.com, MarineTraffic, etc.), so "didn't get a clean 200 from curl"
 * couldn't always be told apart from "actually broken." Spot-check a link
 * here once in a real browser before relying on it.
 */
export interface CarrierInfo {
  name: string;
  trackingUrl: string;
}

export const KNOWN_CARRIERS: CarrierInfo[] = [
  { name: "Maersk", trackingUrl: "https://www.maersk.com/tracking" },
  { name: "MSC", trackingUrl: "https://www.msc.com/en/track-a-shipment" },
  { name: "CMA CGM", trackingUrl: "https://www.cma-cgm.com/ebusiness/tracking" },
  { name: "COSCO Shipping", trackingUrl: "https://elines.coscoshipping.com/ebusiness/cargoTracking" },
  { name: "Evergreen", trackingUrl: "https://www.evergreen-line.com/" },
  { name: "ONE (Ocean Network Express)", trackingUrl: "https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking" },
  { name: "Hapag-Lloyd", trackingUrl: "https://www.hapag-lloyd.com/en/online-business/track/track-by-booking-solution.html" },
  { name: "ZIM", trackingUrl: "https://www.zim.com/tools/track-a-shipment" },
  { name: "Yang Ming", trackingUrl: "https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx" },
  { name: "HMM", trackingUrl: "https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do" },
  { name: "Wan Hai Lines", trackingUrl: "https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml" },
  { name: "PIL (Pacific International Lines)", trackingUrl: "https://www.pilship.com/" },
];

/** Case-insensitive, trimmed — matches the same way `carrierKey` in booking-stats.ts does. */
export function carrierTrackingUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return KNOWN_CARRIERS.find((c) => c.name.toLowerCase() === key)?.trackingUrl ?? null;
}
