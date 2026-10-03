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

export interface ScrapeTargetConfig {
  key: string;
  label: string;
  urls: string[];
  /**
   * CSS selectors tried in order to narrow the page before the text patterns
   * run. An empty list means the patterns run against the whole body text.
   */
  selectors: string[];
  /**
   * Regular expressions with one capture group holding the number. Tried in
   * order; the first that matches and validates wins.
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
    "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry",
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
 * SCFI is published by the Shanghai Shipping Exchange, which blocks automated
 * clients aggressively. Mirror sites carry the figure but move it around.
 */
export const SCFI: ScrapeTargetConfig = {
  key: "scfi",
  label: "Shanghai Containerized Freight Index",
  urls: [
    "https://en.sse.net.cn/indices/scfinew.jsp",
    "https://www.container-news.com/scfi/",
  ],
  selectors: ["#indexTable", ".scfi", "table", "main"],
  patterns: [
    /SCFI[^0-9]{0,80}([\d,]+(?:\.\d+)?)/i,
    /comprehensive\s+index[^0-9]{0,40}([\d,]+(?:\.\d+)?)/i,
  ],
  range: { min: 200, max: 6_000 },
  fragility:
    "The Shanghai Shipping Exchange blocks bots and mirrors reposition the figure without notice. Treat a successful scrape as a bonus.",
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

/** Yahoo Finance symbols for the daily sentiment job. */
export const MARKET_SYMBOLS = {
  /**
   * Yahoo's coverage of the Baltic Dry Index is patchy and frequently returns
   * nothing. The job records that as a failure for this symbol alone and
   * carries on with BDRY rather than blanking the whole widget.
   */
  BDI: "^BDI",
  /** A liquid ETF — reliably quoted, and a usable proxy when ^BDI is missing. */
  BDRY: "BDRY",
} as const;
