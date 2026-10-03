/**
 * Keyword tagging for ingested logistics news.
 *
 * Matching is case-insensitive and anchored to word boundaries, so "Union"
 * does not fire on "Reunion" and "Strait" does not fire on "Straightforward".
 * Multi-word phrases are matched as phrases.
 */

export type DisruptionTagKey =
  | "GEOPOLITICS"
  | "LABOR"
  | "CHOKEPOINT"
  | "WEATHER"
  | "CAPACITY"
  | "RATE_MOVE";

export type SeverityKey = "INFO" | "WATCH" | "ALERT";

export interface KeywordRule {
  tag: DisruptionTagKey;
  /** Phrases to look for. Case does not matter. */
  keywords: string[];
  /**
   * Hitting this group alone is enough to warrant an ALERT. Reserved for
   * events that physically stop or reroute vessels.
   */
  escalates?: boolean;
}

export const KEYWORD_RULES: KeywordRule[] = [
  {
    tag: "GEOPOLITICS",
    escalates: true,
    keywords: [
      "red sea",
      "houthi",
      "gulf of aden",
      "bab el-mandeb",
      "bab al-mandab",
      "sanction",
      "sanctions",
      "missile",
      "attack",
      "war",
      "blockade",
      "embargo",
      "piracy",
      "pirate",
    ],
  },
  {
    tag: "LABOR",
    escalates: true,
    keywords: [
      "strike",
      "walkout",
      "work stoppage",
      "union",
      "ila",
      "industrial action",
      "lockout",
      "protest",
      "port congestion",
    ],
  },
  {
    tag: "CHOKEPOINT",
    escalates: true,
    keywords: [
      "suez canal",
      "panama canal",
      "malacca strait",
      "strait of malacca",
      "strait of hormuz",
      "bosphorus",
      "kiel canal",
      "canal transit",
      "draft restriction",
    ],
  },
  {
    tag: "WEATHER",
    keywords: [
      "typhoon",
      "hurricane",
      "cyclone",
      "storm",
      "fog",
      "drought",
      "flood",
      "monsoon",
      "ice",
    ],
  },
  {
    tag: "CAPACITY",
    keywords: [
      "blank sailing",
      "blanked sailing",
      "void sailing",
      "capacity cut",
      "capacity withdrawal",
      "overcapacity",
      "idle fleet",
      "newbuild",
      "orderbook",
      "schedule reliability",
      "equipment shortage",
      "container shortage",
    ],
  },
  {
    tag: "RATE_MOVE",
    keywords: [
      "rate increase",
      "gri",
      "general rate increase",
      "surcharge",
      "peak season surcharge",
      "pss",
      "spot rate",
      "freight rate",
      "rate hike",
      "rate slump",
      "rate collapse",
    ],
  },
];

export interface TaggingResult {
  tags: DisruptionTagKey[];
  matchedKeywords: string[];
  severity: SeverityKey;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary match. `\b` behaves correctly here because every keyword
 * starts and ends with an alphanumeric character.
 */
function containsKeyword(haystack: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(haystack);
}

/**
 * Severity rises with breadth and with the kind of event, not just the count.
 * A single Red Sea attack matters more than three stories that merely mention
 * freight rates, so an escalating group alone is enough to reach ALERT.
 */
export function tagNewsItem(title: string, summary?: string | null): TaggingResult {
  const haystack = `${title ?? ""} ${summary ?? ""}`.trim();
  if (!haystack) return { tags: [], matchedKeywords: [], severity: "INFO" };

  const tags: DisruptionTagKey[] = [];
  const matchedKeywords: string[] = [];
  let escalated = false;

  for (const rule of KEYWORD_RULES) {
    const hits = rule.keywords.filter((keyword) => containsKeyword(haystack, keyword));
    if (hits.length === 0) continue;

    tags.push(rule.tag);
    matchedKeywords.push(...hits);
    if (rule.escalates) escalated = true;
  }

  let severity: SeverityKey = "INFO";
  if (escalated) severity = "ALERT";
  else if (tags.length >= 2) severity = "ALERT";
  else if (tags.length === 1) severity = "WATCH";

  return { tags, matchedKeywords: [...new Set(matchedKeywords)], severity };
}

export const TAG_LABELS: Record<DisruptionTagKey, { en: string; th: string }> = {
  GEOPOLITICS: { en: "Geopolitics", th: "ภูมิรัฐศาสตร์" },
  LABOR: { en: "Labor", th: "แรงงาน" },
  CHOKEPOINT: { en: "Chokepoint", th: "จุดคอขวด" },
  WEATHER: { en: "Weather", th: "สภาพอากาศ" },
  CAPACITY: { en: "Capacity", th: "ระวางเรือ" },
  RATE_MOVE: { en: "Rate Move", th: "ค่าระวาง" },
};

export const SEVERITY_LABELS: Record<SeverityKey, { en: string; th: string }> = {
  INFO: { en: "Info", th: "ข้อมูลทั่วไป" },
  WATCH: { en: "Watch", th: "เฝ้าระวัง" },
  ALERT: { en: "Alert", th: "เตือนภัย" },
};
