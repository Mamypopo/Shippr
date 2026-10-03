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
import {
  DREWRY_WCI,
  extractContainerNewsScfi,
  extractDrewryMetaDescription,
  extractShipAndBunkerVlsfo,
  extractSseCurrentIndex,
  SCFI,
  SHIP_AND_BUNKER_VLSFO,
} from "./scraper-config";

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

  it("searches inside scripts when explicitly told to", () => {
    // The opt-in path a source like cbonds needs: the value lives in an
    // embedded state object, not in rendered body text.
    const html = `<body><script>var state={"actual_value.numeric":3662.2965};</script></body>`;
    const text = extractSearchText(html, [], true);
    expect(text).toContain("3662.2965");
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

  it("matches a per-URL override pattern anchored to a named JSON key", () => {
    // The mechanism a source like a third-party data republisher would need:
    // the value lives in an embedded state object under a specific key, not
    // in rendered body text. See ScrapeUrlConfig.includeScripts for why the
    // key has to be this specific before it's safe to search inside scripts.
    const overridePattern = /"actual_value\.numeric"\s*:\s*([\d.]+)/;
    const text = `"actual_value":"3,662.30","actual_value.numeric":3662.2965,"actual_date":"30/09/2026"`;

    expect(matchIndexValue(text, { ...SCFI, patterns: [overridePattern] })).toBe(3662.2965);
  });

  it("an anchored key pattern does not match the comma-formatted display string", () => {
    const overridePattern = /"actual_value\.numeric"\s*:\s*([\d.]+)/;
    const text = `"actual_value":"3,662.30"`; // no .numeric field present
    expect(matchIndexValue(text, { ...SCFI, patterns: [overridePattern] })).toBeNull();
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

describe("container-news SCFI extractor", () => {
  const extract = extractContainerNewsScfi;

  it("is wired into the SCFI config as the fallback source", () => {
    const entry = SCFI.urls.find((u) => u.url.includes("container-news.com"));
    expect(entry?.extract).toBeTypeOf("function");
  });

  /** Builds a chart-plugin-shaped row for one year, matching the real page. */
  function rowFor(year: string, values: string[]): string {
    const content = JSON.stringify(values).replace(/"/g, '\\"');
    return `{"id":"183","chart_id":"46","row_index":"1","content":"${content}","label":"${year}"}`;
  }

  it("takes the last value from the current year's series", () => {
    const html = `<script>var d=[${rowFor("2026", ["3590.05", "3662.18", "3662.30"])}]</script>`;
    expect(extract(html, "2026")).toBe(3662.3);
  });

  it("ignores a different year's series", () => {
    const html = `<script>var d=[${rowFor("2025", ["1114.52"])},${rowFor("2026", ["3662.30"])}]</script>`;
    expect(extract(html, "2026")).toBe(3662.3);
    expect(extract(html, "2025")).toBe(1114.52);
  });

  it("returns null rather than throwing when the year is absent", () => {
    const html = `<script>var d=[${rowFor("2025", ["1114.52"])}]</script>`;
    expect(extract(html, "2099")).toBeNull();
  });

  it("returns null on a malformed or truncated content string", () => {
    expect(extract('"content":"[1,2,"label":"2026"', "2026")).toBeNull();
    expect(extract('"content":"","label":"2026"', "2026")).toBeNull();
  });

  it("does not grab an unrelated content field far from the label", () => {
    const farContent = '"content":"[\\"9999.99\\"]"';
    const padding = "x".repeat(6000);
    const html = `${farContent}${padding}"label":"2026"`;
    expect(extract(html, "2026")).toBeNull();
  });

  it("stays linear-time on megabyte-scale HTML — guards against reintroducing a backtracking regex", () => {
    // An earlier draft used `(?:[^\]]|\\.)*` across the whole page and took
    // tens of seconds on real ~1MB input where this takes single-digit
    // milliseconds. This pins the fast behaviour so a future "simplify this"
    // edit can't quietly bring that back.
    const padding = "x".repeat(1_000_000);
    const html = `${padding}${rowFor("2026", ["3662.30"])}${padding}`;

    const start = Date.now();
    const result = extract(html, "2026");
    const elapsed = Date.now() - start;

    expect(result).toBe(3662.3);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("SSE currentIndex extractor", () => {
  /** Trimmed to the fields the extractor reads; the real payload has ~20 lanes. */
  function responseWith(composite: number | null): string {
    return JSON.stringify({
      data: {
        currentDate: "2026-09-30",
        lineDataList: [
          { dataItemTypeName: "SCFI_T", currentContent: composite },
          { dataItemTypeName: "SCFI_L1", currentContent: null },
        ],
      },
      msg: "Successfully obtained index data ！",
      status: 1,
    });
  }

  it("reads the composite value by its dataItemTypeName, not array position", () => {
    expect(extractSseCurrentIndex(responseWith(3662.2965))).toBe(3662.2965);
  });

  it("is not thrown off by an unrelated lane appearing first", () => {
    const json = JSON.stringify({
      data: {
        lineDataList: [
          { dataItemTypeName: "SCFI_L1", currentContent: 999 },
          { dataItemTypeName: "SCFI_T", currentContent: 3662.3 },
        ],
      },
    });
    expect(extractSseCurrentIndex(json)).toBe(3662.3);
  });

  it("returns null when the composite lane is missing entirely", () => {
    const json = JSON.stringify({ data: { lineDataList: [{ dataItemTypeName: "SCFI_L1" }] } });
    expect(extractSseCurrentIndex(json)).toBeNull();
  });

  it("returns null when the composite's value is null (a lane with no reading yet)", () => {
    expect(extractSseCurrentIndex(responseWith(null))).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", () => {
    expect(extractSseCurrentIndex("{not json")).toBeNull();
    expect(extractSseCurrentIndex("")).toBeNull();
  });

  it("returns null on a well-formed but unrelated JSON shape", () => {
    expect(extractSseCurrentIndex(JSON.stringify({ status: "ok" }))).toBeNull();
    expect(extractSseCurrentIndex(JSON.stringify({ data: {} }))).toBeNull();
    expect(extractSseCurrentIndex("[]")).toBeNull();
    expect(extractSseCurrentIndex("null")).toBeNull();
  });

  it("is wired into the SCFI config as the primary source", () => {
    expect(SCFI.urls[0].url).toContain("en.sse.net.cn/currentIndex");
    expect(SCFI.urls[0].extract).toBe(extractSseCurrentIndex);
  });
});

describe("Drewry meta-description extractor", () => {
  const extract = extractDrewryMetaDescription;

  function pageWith(description: string): string {
    return `<head><meta name="description" content="${description}"></head>`;
  }

  it("reads the composite from the real meta description shape", () => {
    const html = pageWith(
      "01 Oct 2026: Drewry’s World Container Index (WCI) fell 1% to $4,434 per 40ft container.",
    );
    expect(extract(html)).toBe(4434);
  });

  it("handles a comma thousands separator", () => {
    const html = pageWith("Drewry's World Container Index (WCI) rose 2% to $10,250 per 40ft container.");
    expect(extract(html)).toBe(10_250);
  });

  it("is wired into the Drewry config as the primary source", () => {
    const entry = DREWRY_WCI.urls.find((u) => u.extract === extractDrewryMetaDescription);
    expect(entry).toBeDefined();
  });

  it("falls back to the visible-text pipeline — a second URL entry with no extractor — if the meta tag is missing", () => {
    const withoutExtract = DREWRY_WCI.urls.filter((u) => u.extract === undefined);
    expect(withoutExtract.length).toBeGreaterThan(0);
  });

  it("returns null when there is no description meta tag at all", () => {
    expect(extract("<head><title>no meta here</title></head>")).toBeNull();
  });

  it("returns null when the description doesn't mention the WCI composite", () => {
    expect(extract(pageWith("Drewry is a supply chain advisory firm."))).toBeNull();
  });

  it("returns null rather than throwing on a truncated content attribute", () => {
    expect(extract('<meta name="description" content="unterminated')).toBeNull();
  });
});

describe("Ship & Bunker VLSFO extractor", () => {
  const extract = extractShipAndBunkerVlsfo;

  /** Minimal version of the real table's markup — row id + headers-linked cell, same as the live page. */
  function pageWith(price: string): string {
    return `
      <table>
        <tr>
          <th id="row-av-g20-VLSFO" scope="row">Global 20 Ports Average</th>
          <td headers="price-VLSFO">${price}<span class="indicator"></span></td>
          <td headers="change-VLSFO">+2.50</td>
        </tr>
      </table>
    `;
  }

  it("reads the Global 20 Ports Average VLSFO price", () => {
    expect(extract(pageWith("875.50"))).toBe(875.5);
  });

  it("ignores a nearby unrelated figure in another column", () => {
    // The change/high/low/spread columns sit right next to the price cell;
    // the lookup is by the `headers` attribute, not column position, so it
    // must not drift onto one of them.
    expect(extract(pageWith("809.00"))).toBe(809);
  });

  it("is wired into the config as the primary (and only) source", () => {
    expect(SHIP_AND_BUNKER_VLSFO.urls[0].extract).toBe(extractShipAndBunkerVlsfo);
  });

  it("returns null when the row is absent", () => {
    expect(extract("<table><tr><td>no bunker data here</td></tr></table>")).toBeNull();
  });

  it("returns null rather than throwing on empty or malformed HTML", () => {
    expect(extract("")).toBeNull();
    expect(extract("<not even close to html")).toBeNull();
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
