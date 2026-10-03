import { describe, expect, it } from "vitest";

import { parsePositionReportMessage } from "./ais";

/** Shaped like aisstream.io's documented PositionReport envelope. */
function envelope(overrides: Record<string, unknown> = {}) {
  return {
    MessageType: "PositionReport",
    Message: {
      PositionReport: {
        UserID: 123456789,
        Latitude: 13.08,
        Longitude: 100.88,
        Sog: 14.2,
        Cog: 271.5,
        NavigationalStatus: 0,
        ...overrides,
      },
    },
  };
}

describe("parsePositionReportMessage", () => {
  it("reads mmsi, position, speed, course, and a human-readable nav status", () => {
    const report = parsePositionReportMessage(envelope());
    expect(report).toMatchObject({
      mmsi: 123456789,
      lat: 13.08,
      lon: 100.88,
      speedKnots: 14.2,
      courseDeg: 271.5,
      navStatus: "Under way using engine",
    });
    expect(report?.observedAt).toBeInstanceOf(Date);
  });

  it("maps other documented navigational status codes", () => {
    expect(parsePositionReportMessage(envelope({ NavigationalStatus: 1 }))?.navStatus).toBe(
      "At anchor",
    );
    expect(parsePositionReportMessage(envelope({ NavigationalStatus: 5 }))?.navStatus).toBe(
      "Moored",
    );
  });

  it("returns null navStatus for an undocumented/reserved code rather than guessing", () => {
    expect(parsePositionReportMessage(envelope({ NavigationalStatus: 9 }))?.navStatus).toBeNull();
  });

  it("returns null speed/course when the report omits them, without dropping the position", () => {
    const report = parsePositionReportMessage(envelope({ Sog: undefined, Cog: undefined }));
    expect(report?.speedKnots).toBeNull();
    expect(report?.courseDeg).toBeNull();
    expect(report?.lat).toBe(13.08);
  });

  it("ignores a non-PositionReport message type", () => {
    expect(parsePositionReportMessage({ MessageType: "ShipStaticData", Message: {} })).toBeNull();
  });

  it("returns null rather than throwing on missing mmsi or coordinates", () => {
    expect(parsePositionReportMessage(envelope({ UserID: undefined }))).toBeNull();
    expect(parsePositionReportMessage(envelope({ Latitude: undefined }))).toBeNull();
    expect(parsePositionReportMessage(envelope({ Longitude: "not a number" }))).toBeNull();
  });

  it("returns null rather than throwing on a malformed or empty payload", () => {
    expect(parsePositionReportMessage(null)).toBeNull();
    expect(parsePositionReportMessage(undefined)).toBeNull();
    expect(parsePositionReportMessage("just a string")).toBeNull();
    expect(parsePositionReportMessage({})).toBeNull();
    expect(parsePositionReportMessage({ MessageType: "PositionReport" })).toBeNull();
    expect(parsePositionReportMessage({ MessageType: "PositionReport", Message: {} })).toBeNull();
  });
});
