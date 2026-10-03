/**
 * Everything about the scrape targets that is likely to change lives here.
 *
 * Public index pages get redesigned without warning. Keeping URLs, selectors
 * and the plausible-value ranges in one file means a broken source is a
 * one-line edit rather than a hunt through parsing code.
 */

export interface IndexRangeRule {
  /** Values outside this band are treated as a parse failure, not data. */
  min: number;
  max: number;
}

export interface ScrapeUrlConfig {
  url: string;
  /** Overrides the target's default selectors for this URL alone. */
  selectors?: string[];
  /** Overrides the target's default patterns for this URL alone. */
  patterns?: RegExp[];
  /**
   * Search inside `<script>` tags too, instead of stripping them first.
   *
   * The default strips scripts because a loose pattern can match an
   * unrelated number inside a JSON blob or an analytics snippet and produce
   * a confident wrong answer. This is only safe to turn on when the pattern
   * for this URL is anchored to a specific, unlikely-to-collide key — e.g.
   * a named field in an embedded state object — not a loose "4 digits near
   * this word" pattern.
   */
  includeScripts?: boolean;
  /**
   * A custom extractor for structured data a single regex can't safely
   * express — e.g. "the last element of a year-labelled array embedded in a
   * chart plugin's JSON". When present, this runs directly against the raw
   * HTML instead of the selectors/patterns/includeScripts pipeline.
   *
   * Write this as `indexOf` plus a manual scan, never as one regex with
   * ambiguous alternation (`(?:[^x]|\\.)*` and similar) run against a whole
   * page. That shape is classically ReDoS-prone, and it is not theoretical
   * here — an earlier draft of the container-news extractor used exactly
   * that pattern and took tens of seconds against this page's ~1MB of HTML
   * where the linear-scan version takes single-digit milliseconds. The
   * function still must return `null` rather than throw on anything
   * unexpected; the range check in `matchIndexValue`'s caller applies to its
   * result the same as to a regex match.
   */
  extract?: (html: string) => number | null;
}

export interface ScrapeTargetConfig {
  key: string;
  label: string;
  urls: ScrapeUrlConfig[];
  /**
   * CSS selectors tried in order to narrow the page before the text patterns
   * run, used for any URL that doesn't override them. An empty list means
   * the patterns run against the whole body text.
   */
  selectors: string[];
  /**
   * Regular expressions with one capture group holding the number, used for
   * any URL that doesn't override them. Tried in order; the first that
   * matches and validates wins.
   */
  patterns: RegExp[];
  range: IndexRangeRule;
  /** Documentation of what makes this source fragile, surfaced in admin UI. */
  fragility: string;
}

/**
 * Drewry publishes the WCI as an interactive chart with no HTML table, so
 * there is nothing structural to select. The reliable surface is the prose in
 * their weekly commentary, which states the composite in USD per 40ft.
 * Expect this to need the manual entry form most weeks.
 */
export const DREWRY_WCI: ScrapeTargetConfig = {
  key: "drewry-wci",
  label: "Drewry World Container Index",
  urls: [
    {
      url: "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry",
    },
  ],
  selectors: [".wci-composite", "#wci", ".chart-summary", "main"],
  patterns: [
    // "composite index ... $3,445 per 40ft container"
    /composite[^$]{0,120}\$\s?([\d,]+(?:\.\d+)?)/i,
    // "$3,445 per 40ft"
    /\$\s?([\d,]+(?:\.\d+)?)\s*per\s*40\s*ft/i,
    /\$\s?([\d,]+(?:\.\d+)?)\s*\/\s*feu/i,
  ],
  // A composite below $200/FEU or above $20,000/FEU has never happened; a
  // match in that territory is a mis-parse, not a market event.
  range: { min: 200, max: 20_000 },
  fragility:
    "Drewry renders the WCI as a chart with no HTML table. Parsing depends on the wording of their weekly commentary and breaks whenever that copy changes.",
};

/**
 * container-news.com renders its SCFI chart with a WordPress chart plugin
 * that embeds every series as JSON inside the page: one object per year,
 * shaped like `"content":"[\"1234.56\",...]","label":"2026"`. The array is
 * in chronological order, so its last element is the most recent weekly
 * reading. Confirmed live: the 2026-series' last value matched cbonds.com's
 * `actual_value` exactly (3662.30/3662.2965), two unrelated sources agreeing
 * — about as strong a confirmation as a scrape ever gets without an official
 * API. Unlike cbonds, this site's Cloudflare configuration does not block
 * plain Node requests, tested repeatedly.
 *
 * `labelIdx - contentKeyIdx > 5000` guards against the extractor grabbing
 * some unrelated earlier `"content"` field if the page ever adds another
 * `"label":"<year>"` occurrence far from its own data row.
 */
export function extractContainerNewsScfi(html: string, year: string): number | null {
  const labelNeedle = `"label":"${year}"`;
  const labelIdx = html.indexOf(labelNeedle);
  if (labelIdx === -1) return null;

  const contentKey = '"content":"';
  const contentKeyIdx = html.lastIndexOf(contentKey, labelIdx);
  if (contentKeyIdx === -1 || labelIdx - contentKeyIdx > 5000) return null;

  const stringStart = contentKeyIdx + contentKey.length;

  // Manual scan for the closing quote, honouring backslash-escaping —
  // linear and bounded, unlike a regex trying to express the same thing.
  let i = stringStart;
  while (i < html.length && html[i] !== '"') {
    i += html[i] === "\\" ? 2 : 1;
  }
  if (i >= html.length) return null;

  try {
    const values: unknown = JSON.parse(html.slice(stringStart, i).replace(/\\"/g, '"'));
    if (!Array.isArray(values) || values.length === 0) return null;

    const last = values[values.length - 1];
    const parsed = typeof last === "string" ? Number.parseFloat(last) : Number(last);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** One row of `/currentIndex`'s response — see `extractSseCurrentIndex`. */
interface SseLineData {
  dataItemTypeName?: string;
  currentContent?: number | null;
}

/**
 * The official SSE page (`indices/scfinew.jsp`) never had the composite
 * value in its static HTML at all — it loads the page shell, then the
 * page's own JavaScript calls this exact JSON endpoint client-side. Found by
 * reading that JavaScript rather than guessing: `$.ajax({ url:
 * "/currentIndex", data: {indexName:"scfi"} })`, fired on page load before
 * any login check, as a free "current value" teaser ahead of the paywalled
 * historical endpoint (`/singleIndex/scfi`, confirmed to require a
 * subscribed-user session — not a source this project can use).
 *
 * `/currentIndex` itself needs no session, no cookie, no referer — confirmed
 * with a cold request. The composite sits in `data.lineDataList`, matched by
 * `dataItemTypeName === "SCFI_T"` rather than by array position, since nothing
 * documents that position as stable. Its value (3662.2965) matched both
 * cbonds.com and container-news.com exactly — three independent sources
 * agreeing is about as confirmed as a reading gets.
 */
export function extractSseCurrentIndex(json: string): number | null {
  let body: unknown;
  try {
    body = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("lineDataList" in data)) return null;

  const lineDataList = (data as { lineDataList?: unknown }).lineDataList;
  if (!Array.isArray(lineDataList)) return null;

  const composite = (lineDataList as SseLineData[]).find((l) => l?.dataItemTypeName === "SCFI_T");
  const value = composite?.currentContent;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * SCFI is published by the Shanghai Shipping Exchange. Its own page blocks a
 * plain HTML scrape by never putting the number in the HTML (see
 * `extractSseCurrentIndex`), so the official endpoint it calls client-side is
 * used directly instead — faster and more direct than scraping a rendered
 * page would have been anyway. container-news.com (see
 * `extractContainerNewsScfi`) is kept as an independent fallback: slower and
 * less reliable, but a second source if SSE's endpoint ever changes shape.
 *
 * cbonds.com looked like a third option — the value lives in static HTML
 * (`"actual_value.numeric"`) — but it sits behind Cloudflare, and both axios
 * and Node's native `fetch` (undici) get an immediate 403 from it while curl
 * with identical headers succeeds. That is a TLS/JA3 fingerprint check, not a
 * header check, so it isn't fixable from inside Node without a real browser
 * engine — which this project deliberately avoids (no Playwright/Puppeteer,
 * to stay light enough for a Vercel function). Recorded here so this isn't
 * rediscovered the hard way: cbonds is not a usable source for this runtime,
 * despite looking like one.
 */
export const SCFI: ScrapeTargetConfig = {
  key: "scfi",
  label: "Shanghai Containerized Freight Index",
  urls: [
    {
      url: "https://en.sse.net.cn/currentIndex?indexName=scfi",
      extract: extractSseCurrentIndex,
    },
    {
      url: "https://container-news.com/scfi/",
      extract: (html) => extractContainerNewsScfi(html, String(new Date().getUTCFullYear())),
    },
  ],
  selectors: ["#indexTable", ".scfi", "table", "main"],
  patterns: [
    /SCFI[^0-9]{0,80}([\d,]+(?:\.\d+)?)/i,
    /comprehensive\s+index[^0-9]{0,40}([\d,]+(?:\.\d+)?)/i,
  ],
  range: { min: 200, max: 6_000 },
  fragility:
    "Reads SSE's own /currentIndex endpoint, found by inspecting the official page's JavaScript rather than guessing. It needs no login — unlike /singleIndex/scfi, which does — but it's an undocumented internal API, not a published contract, so it can change shape without notice. container-news.com is the fallback if it does.",
};

export const SCRAPE_TARGETS: ScrapeTargetConfig[] = [DREWRY_WCI, SCFI];

/** RSS feeds for the disruption radar. */
export interface FeedConfig {
  key: string;
  name: string;
  url: string;
}

export const NEWS_FEEDS: FeedConfig[] = [
  { key: "loadstar", name: "The Loadstar", url: "https://theloadstar.com/feed/" },
  { key: "gcaptain", name: "gCaptain", url: "https://gcaptain.com/feed/" },
];

/** How many items to keep per feed per run. */
export const MAX_ITEMS_PER_FEED = 40;

/**
 * Yahoo Finance symbols for the daily sentiment job.
 *
 * The Baltic Dry Index (`^BDI`) is deliberately absent: Yahoo carries zero
 * data for it — confirmed with both a direct quote and a symbol search
 * turning up nothing, not a transient gap — because the Baltic Exchange
 * sells it commercially rather than publishing it freely. BDRY (a traded
 * ETF) already stood in as a correlated proxy; WTI and Brent crude are
 * tracked alongside it because bunker fuel is a direct, major cost input to
 * ocean freight rates, making crude a relevant signal in its own right.
 */
export const MARKET_SYMBOLS = {
  /** A liquid dry-bulk shipping ETF — reliably quoted. */
  BDRY: "BDRY",
  /** WTI crude oil futures — the US benchmark. */
  WTI: "CL=F",
  /** Brent crude oil futures — the international benchmark. */
  BRENT: "BZ=F",
} as const;
