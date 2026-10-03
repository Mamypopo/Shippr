/**
 * Port congestion banding and the hub ports the dashboard tracks.
 */

export type RiskLevelKey = "LOW" | "MODERATE" | "HIGH";

/** Vessel waiting time, in days, at which each band begins. */
export const RISK_THRESHOLDS = {
  moderate: 2,
  high: 4,
} as const;

export function riskLevelForWaitDays(avgWaitDays: number): RiskLevelKey {
  if (!Number.isFinite(avgWaitDays) || avgWaitDays < RISK_THRESHOLDS.moderate) return "LOW";
  if (avgWaitDays > RISK_THRESHOLDS.high) return "HIGH";
  return "MODERATE";
}

export const RISK_LABELS: Record<RiskLevelKey, { en: string; th: string }> = {
  LOW: { en: "Low", th: "ปกติ" },
  MODERATE: { en: "Moderate", th: "เริ่มแออัด" },
  HIGH: { en: "High", th: "แออัดหนัก" },
};

export const RISK_DESCRIPTIONS: Record<RiskLevelKey, string> = {
  LOW: "Under 2 days average wait — berthing on schedule.",
  MODERATE: "2 to 4 days average wait — build buffer into transit estimates.",
  HIGH: "Over 4 days average wait — expect rollovers and detention exposure.",
};

export interface HubPortSeed {
  unlocode: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  sortOrder: number;
}

/** The hub ports seeded on first run. Laem Chabang leads: this is a Thai desk. */
export const HUB_PORTS: HubPortSeed[] = [
  { unlocode: "THLCH", name: "Laem Chabang", country: "Thailand", lat: 13.0827, lon: 100.8853, sortOrder: 10 },
  { unlocode: "CNSHA", name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737, sortOrder: 20 },
  { unlocode: "CNNGB", name: "Ningbo-Zhoushan", country: "China", lat: 29.8683, lon: 121.544, sortOrder: 30 },
  { unlocode: "SGSIN", name: "Singapore", country: "Singapore", lat: 1.2644, lon: 103.822, sortOrder: 40 },
  { unlocode: "NLRTM", name: "Rotterdam", country: "Netherlands", lat: 51.9244, lon: 4.4777, sortOrder: 50 },
  { unlocode: "USLAX", name: "Los Angeles", country: "United States", lat: 33.7405, lon: -118.2668, sortOrder: 60 },
];
