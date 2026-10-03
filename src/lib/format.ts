/**
 * Display formatting. Thai copy, English industry terms, figures in a form
 * that lines up in a column.
 */

export function formatIndexValue(value: number, unit: string): string {
  if (unit === "USD_PER_FEU") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (unit === "USD") return `$${value.toFixed(2)}`;
  return Math.round(value).toLocaleString("en-US");
}

export function unitSuffix(unit: string): string {
  if (unit === "USD_PER_FEU") return "USD/FEU";
  if (unit === "USD") return "USD";
  return "pts";
}

export function formatDelta(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Thai short date, e.g. "2 ต.ค." */
export function thaiShortDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(date);
}

export function thaiFullDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "3 วันก่อน" / "วันนี้" — for freshness markers. */
export function relativeDaysTh(date: Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  return `${days} วันก่อน`;
}

export const INDEX_LABELS: Record<string, string> = {
  WCI: "Drewry WCI",
  SCFI: "SCFI",
  BDRY: "BDRY ETF",
  WTI: "WTI Crude Oil",
  BRENT: "Brent Crude Oil",
};

export function indexLabel(code: string): string {
  return INDEX_LABELS[code] ?? code;
}

/** Where a figure came from, so a reader can weigh it. */
export const SOURCE_LABELS: Record<string, string> = {
  SCRAPER: "ดึงอัตโนมัติ",
  MANUAL: "กรอกด้วยมือ",
  YAHOO: "Yahoo Finance",
  CSV_IMPORT: "นำเข้า CSV",
};
