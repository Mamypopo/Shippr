import { describe, expect, it } from "vitest";

import { cleanSummary, newsGuid } from "./rss";
import {
  extractSearchText,
  indexWeekDate,
  makeIndexSchema,
  matchIndexValue,
  parseNumber,
  runAllAdapters,
  type SourceAdapter,
} from "./scraper";
import { DREWRY_WCI, SCFI } from "./scraper-config";

describe("parseNumber", () => {
  it("strips thousands separators and currency marks", () => {
    expect(parseNumber("$3,445")).toBe(3445);
    expect(parseNumber(" 2,018.50 ")).toBe(2018.5);
  });

  it("returns NaN for text that is not a number", () => {
    expect(parseNumber("World Container Index")).toBeNaN();
    expect(parseNumber("")).toBeNaN();
  });
});

describe("extractSearchText", () => {
  it("prefers the first selector that yields text", () => {
    const html = `<body><div class="wci-composite">Composite $3,445 per 40ft</div><main>other</main></body>`;
    expect(extractSearchText(html, [".wci-composite", "main"])).toContain("3,445");
  });

  it("falls back to the body when no selector matches", () => {
    const html = `<body><p>Composite $3,445 per 40ft</p></body>`;
    expect(extractSearchText(html, [".nope"])).toContain("3,445");
  });

  it("drops script and style content, which would otherwise match patterns", () => {
    // A JSON blob in a script tag will happily satisfy a number pattern and
    // produce a confident wrong answer.
    const html = `<body><script>var wci={"composite":99999};</script><main>Composite $3,445 per 40ft</main></body>`;
    const text = extractSearchText(html, ["main"]);
    expect(text).not.toContain("99999");
    expect(text).toContain("3,445");
  });

  it("collapses whitespace", () => {
    expect(extractSearchText("<body><p>a\n\n   b</p></body>", [])).toBe("a b");
  });
});

describe("matchIndexValue", () => {
  it("reads the Drewry composite out of commentary prose", () => {
    const text = "Drewry's composite World Container Index decreased 2% to $3,445 per 40ft container";
    expect(matchIndexValue(text, DREWRY_WCI)).toBe(3445);
  });

  it("reads an SCFI figure", () => {
    expect(matchIndexValue("SCFI comprehensive index 1,845.22 points", SCFI)).toBe(1845.22);
  });

  it("rejects a match that lands outside the plausible range", () => {
    // A year, a page view count, or a mis-scoped capture.
    expect(matchIndexValue("composite index $12 per 40ft", DREWRY_WCI)).toBeNull();
    expect(matchIndexValue("composite index $9,999,999 per 40ft", DREWRY_WCI)).toBeNull();
  });

  it("returns null rather than guessing when nothing matches", () => {
    expect(matchIndexValue("Service advisory: schedule update", DREWRY_WCI)).toBeNull();
  });

  it("falls through to a later pattern when the first does not apply", () => {
    expect(matchIndexValue("Spot rates reached $2,750 per 40ft", DREWRY_WCI)).toBe(2750);
  });
});

describe("index value schema", () => {
  const schema = makeIndexSchema(DREWRY_WCI);

  it("accepts a plausible reading", () => {
    expect(schema.safeParse({ value: 3445, periodDate: new Date() }).success).toBe(true);
  });

  it("rejects NaN, which would otherwise reach the database", () => {
    expect(schema.safeParse({ value: Number.NaN, periodDate: new Date() }).success).toBe(false);
  });

  it("rejects an implausible value with a message naming the source", () => {
    const result = schema.safeParse({ value: 50, periodDate: new Date() });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Drewry");
    }
  });
});

describe("indexWeekDate", () => {
  it("normalizes a Thursday to itself", () => {
    const thursday = new Date("2026-10-01T18:00:00.000Z"); // a Thursday
    expect(indexWeekDate(thursday).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("maps a Friday retry onto the same week as the Thursday run", () => {
    const thursday = indexWeekDate(new Date("2026-10-01T10:00:00.000Z"));
    const friday = indexWeekDate(new Date("2026-10-02T10:00:00.000Z"));
    expect(friday.getTime()).toBe(thursday.getTime());
  });

  it("maps a Wednesday back to the previous Thursday", () => {
    expect(indexWeekDate(new Date("2026-10-07T10:00:00.000Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("always lands on a UTC Thursday at midnight", () => {
    for (let offset = 0; offset < 14; offset++) {
      const date = indexWeekDate(new Date(Date.UTC(2026, 9, 1 + offset, 13, 37)));
      expect(date.getUTCDay()).toBe(4);
      expect(date.getUTCHours()).toBe(0);
    }
  });
});

describe("runAllAdapters", () => {
  const working: SourceAdapter = {
    key: "ok",
    label: "Working source",
    fetch: async () => [
      {
        indexCode: "WCI",
        routeCode: "COMPOSITE",
        periodDate: new Date("2026-10-01T00:00:00.000Z"),
        value: 3445,
        unit: "USD_PER_FEU",
      },
    ],
  };

  const broken: SourceAdapter = {
    key: "broken",
    label: "Broken source",
    fetch: async () => {
      throw new Error("selector no longer matches");
    },
  };

  it("does not let one dead source cost us the others", async () => {
    const outcomes = await runAllAdapters([broken, working]);

    expect(outcomes.find((o) => o.key === "broken")).toMatchObject({ ok: false, rows: [] });
    expect(outcomes.find((o) => o.key === "ok")?.rows).toHaveLength(1);
  });

  it("reports the failure reason instead of swallowing it", async () => {
    const [outcome] = await runAllAdapters([broken]);
    expect(outcome.error).toContain("selector no longer matches");
  });
});

describe("newsGuid", () => {
  it("is stable for the same link", () => {
    const a = newsGuid("loadstar", { link: "https://example.com/a" });
    const b = newsGuid("loadstar", { link: "https://example.com/a" });
    expect(a).toBe(b);
  });

  it("differs across sources so two feeds carrying one story stay distinct", () => {
    const a = newsGuid("loadstar", { link: "https://example.com/a" });
    const b = newsGuid("gcaptain", { link: "https://example.com/a" });
    expect(a).not.toBe(b);
  });

  it("prefers the feed guid when present", () => {
    const withGuid = newsGuid("loadstar", { guid: "abc", link: "https://example.com/a" });
    const linkOnly = newsGuid("loadstar", { link: "https://example.com/a" });
    expect(withGuid).not.toBe(linkOnly);
  });

  it("returns empty for an item with neither guid nor link", () => {
    expect(newsGuid("loadstar", {})).toBe("");
  });
});

describe("cleanSummary", () => {
  it("strips markup and decodes common entities", () => {
    expect(cleanSummary("<p>Rates &amp; capacity <b>tighten</b></p>")).toBe(
      "Rates & capacity tighten",
    );
  });

  it("truncates with an ellipsis", () => {
    const result = cleanSummary("x".repeat(500), 50)!;
    expect(result).toHaveLength(50);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns null for empty or markup-only input", () => {
    expect(cleanSummary(null)).toBeNull();
    expect(cleanSummary("   ")).toBeNull();
    expect(cleanSummary("<p></p>")).toBeNull();
  });
});
