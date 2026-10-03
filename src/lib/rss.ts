/**
 * RSS ingestion for the disruption radar.
 */

import { createHash } from "node:crypto";

import Parser from "rss-parser";

import {
  tagNewsItem,
  type DisruptionTagKey,
  type SeverityKey,
} from "./disruption-keywords";
import { describeError } from "./http";
import { MAX_ITEMS_PER_FEED, NEWS_FEEDS, type FeedConfig } from "./scraper-config";
import { USER_AGENT } from "./http";

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": USER_AGENT },
});

export interface ParsedNewsItem {
  guid: string;
  sourceName: string;
  title: string;
  link: string;
  summary: string | null;
  publishedAt: Date;
  tags: DisruptionTagKey[];
  matchedKeywords: string[];
  severity: SeverityKey;
}

/**
 * A stable identity for an article.
 *
 * Feeds are inconsistent about `guid`: some omit it, some rotate it on every
 * edit, some reuse it across items. Hashing the link gives a dedupe key that
 * survives all three, and keeps the upsert idempotent across reruns.
 */
export function newsGuid(sourceKey: string, item: { guid?: string; link?: string }): string {
  const basis = item.guid?.trim() || item.link?.trim();
  if (!basis) return "";
  return `${sourceKey}:${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

/** Strip HTML and collapse whitespace, so a summary is readable as plain text. */
export function cleanSummary(raw: string | undefined | null, maxLength = 400): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function fetchFeed(feed: FeedConfig): Promise<ParsedNewsItem[]> {
  const parsed = await parser.parseURL(feed.url);
  const items = (parsed.items ?? []).slice(0, MAX_ITEMS_PER_FEED);

  const out: ParsedNewsItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const guid = newsGuid(feed.key, item);
    const title = item.title?.trim();
    const link = item.link?.trim();

    // Without an identity or a destination there is nothing worth storing.
    if (!guid || !title || !link || seen.has(guid)) continue;
    seen.add(guid);

    const summary = cleanSummary(item.contentSnippet ?? item.content ?? item.summary);
    const { tags, matchedKeywords, severity } = tagNewsItem(title, summary);

    out.push({
      guid,
      sourceName: feed.name,
      title,
      link,
      summary,
      // An item with an unparseable date still matters; dating it now keeps
      // it in the feed rather than discarding it or sending it to 1970.
      publishedAt: parseDate(item.isoDate ?? item.pubDate) ?? new Date(),
      tags,
      matchedKeywords,
      severity,
    });
  }

  return out;
}

export interface FeedOutcome {
  key: string;
  name: string;
  ok: boolean;
  items: ParsedNewsItem[];
  error?: string;
}

export async function fetchAllFeeds(feeds: FeedConfig[] = NEWS_FEEDS): Promise<FeedOutcome[]> {
  const settled = await Promise.allSettled(feeds.map(fetchFeed));

  return settled.map((result, i) => {
    const feed = feeds[i];
    if (result.status === "fulfilled") {
      return { key: feed.key, name: feed.name, ok: true, items: result.value };
    }
    return {
      key: feed.key,
      name: feed.name,
      ok: false,
      items: [],
      error: describeError(result.reason),
    };
  });
}
