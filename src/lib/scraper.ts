/**
 * Freight index scraping.
 *
 * The governing rule: a scraper that cannot prove it read a real figure must
 * fail loudly and write nothing. These numbers feed a benchmark that people
 * price shipments against, so ingesting a mis-parse is materially worse than
 * ingesting nothing — a gap is visible, a wrong number is not.
 */

import * as cheerio from "cheerio";
import { z } from "zod";

import { describeError, fetchText } from "./http";
import {
  DREWRY_WCI,
  SCFI,
  type ScrapeTargetConfig,
} from "./scraper-config";

export type IndexCodeKey = "WCI" | "SCFI" | "BDI" | "BDRY";
export type IndexUnitKey = "USD_PER_FEU" | "POINTS" | "USD";

export interface ParsedIndex {
  indexCode: IndexCodeKey;
  routeCode: string;
  periodDate: Date;
  value: number;
  unit: IndexUnitKey;
  /** Kept for forensics when a parse later turns out to be wrong. */
  rawSnapshot?: Record<string, unknown>;
}

export interface SourceAdapter {
  key: string;
  label: string;
  fetch(): Promise<ParsedIndex[]>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Built per target so the plausible range travels with the source. A page
 * title parsed as a number, a `NaN`, or a figure three orders of magnitude
 * off all fail here rather than reaching the database.
 */
export function makeIndexSchema(config: ScrapeTargetConfig) {
  return z.object({
    value: z
      .number()
      .finite()
      .min(config.range.min, {
        message: `below the plausible floor for ${config.label} (${config.range.min})`,
      })
      .max(config.range.max, {
        message: `above the plausible ceiling for ${config.label} (${config.range.max})`,
      }),
    periodDate: z.date(),
  });
}

export class ScrapeValidationError extends Error {
  constructor(source: string, detail: string) {
    super(`${source}: ${detail}`);
    this.name = "ScrapeValidationError";
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Strip thousands separators and surrounding noise. Returns NaN on failure. */
export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[,\s$]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

/**
 * Collapse a page to searchable text, preferring the configured selectors.
 *
 * Scripts and styles are dropped first by default: a JSON blob or a CSS rule
 * inside them will happily match a loose number pattern and produce a
 * confident wrong answer. `includeScripts` opts a specific URL back in, for
 * the rare case where the target pattern is anchored to a named key rather
 * than a loose shape — see `ScrapeUrlConfig.includeScripts`.
 */
export function extractSearchText(
  html: string,
  selectors: string[],
  includeScripts = false,
): string {
  const $ = cheerio.load(html);
  if (!includeScripts) $("script, style, noscript").remove();

  for (const selector of selectors) {
    const text = $(selector).first().text().replace(/\s+/g, " ").trim();
    if (text.length > 0) return text;
  }

  return $("body").text().replace(/\s+/g, " ").trim();
}

/** First pattern whose capture both parses and clears the plausible range. */
export function matchIndexValue(text: string, config: ScrapeTargetConfig): number | null {
  for (const pattern of config.patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const value = parseNumber(match[1]);
    if (!Number.isFinite(value)) continue;
    if (value < config.range.min || value > config.range.max) continue;

    return value;
  }
  return null;
}

/**
 * The index week this reading belongs to, normalized to a UTC Thursday.
 *
 * Both WCI and SCFI publish late in the week. Normalizing stops a Thursday
 * run and a Friday retry from creating two rows for the same publication.
 */
export function indexWeekDate(now = new Date()): Date {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 4 = Thursday
  const daysSinceThursday = (dayOfWeek - 4 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceThursday);
  return date;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

async function scrapeSingleValue(
  config: ScrapeTargetConfig,
  indexCode: IndexCodeKey,
  unit: IndexUnitKey,
): Promise<ParsedIndex[]> {
  const errors: string[] = [];

  for (const entry of config.urls) {
    const url = entry.url;

    let html: string;
    try {
      html = await fetchText(url);
    } catch (error) {
      errors.push(`${url} -> ${describeError(error)}`);
      continue;
    }

    const text = extractSearchText(
      html,
      entry.selectors ?? config.selectors,
      entry.includeScripts ?? false,
    );
    const value = matchIndexValue(
      text,
      entry.patterns ? { ...config, patterns: entry.patterns } : config,
    );

    if (value === null) {
      errors.push(`${url} -> no pattern matched a plausible value`);
      continue;
    }

    const candidate = { value, periodDate: indexWeekDate() };
    const parsed = makeIndexSchema(config).safeParse(candidate);

    if (!parsed.success) {
      errors.push(`${url} -> ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }

    return [
      {
        indexCode,
        routeCode: "COMPOSITE",
        periodDate: parsed.data.periodDate,
        value: parsed.data.value,
        unit,
        rawSnapshot: {
          url,
          scrapedAt: new Date().toISOString(),
          excerpt: text.slice(0, 500),
        },
      },
    ];
  }

  throw new ScrapeValidationError(config.label, errors.join(" | ") || "no sources configured");
}

export const drewryWciAdapter: SourceAdapter = {
  key: DREWRY_WCI.key,
  label: DREWRY_WCI.label,
  fetch: () => scrapeSingleValue(DREWRY_WCI, "WCI", "USD_PER_FEU"),
};

export const scfiAdapter: SourceAdapter = {
  key: SCFI.key,
  label: SCFI.label,
  fetch: () => scrapeSingleValue(SCFI, "SCFI", "POINTS"),
};

/** Registry, so a broken source can be swapped without touching the route. */
export const SOURCE_ADAPTERS: SourceAdapter[] = [drewryWciAdapter, scfiAdapter];

export interface AdapterOutcome {
  key: string;
  label: string;
  ok: boolean;
  rows: ParsedIndex[];
  error?: string;
}

/**
 * Run every adapter, isolating failures.
 *
 * One dead source must not cost us the others: if Drewry has reworded its
 * commentary, SCFI should still land this week.
 */
export async function runAllAdapters(
  adapters: SourceAdapter[] = SOURCE_ADAPTERS,
): Promise<AdapterOutcome[]> {
  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.fetch()));

  return settled.map((result, i) => {
    const adapter = adapters[i];
    if (result.status === "fulfilled") {
      return { key: adapter.key, label: adapter.label, ok: true, rows: result.value };
    }
    return {
      key: adapter.key,
      label: adapter.label,
      ok: false,
      rows: [],
      error: describeError(result.reason),
    };
  });
}
