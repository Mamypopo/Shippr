import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeError, fetchText, HttpStatusError } from "./http";

describe("fetchText", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the body text on a 2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("hello world", { status: 200 }));

    expect(await fetchText("https://example.com")).toBe("hello world");
  });

  it("retries a transient failure and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;

    const result = await fetchText("https://example.com", { retryDelayMs: 1 });

    expect(result).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries and reports the reason", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      fetchText("https://example.com", { retries: 2, retryDelayMs: 1 }),
    ).rejects.toThrow(/fetch failed/);
  });

  it("does not retry a 404 — it will not fix itself", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404, statusText: "Not Found" }));
    globalThis.fetch = fetchMock;

    await expect(fetchText("https://example.com", { retryDelayMs: 1 })).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401 or a 403 either", async () => {
    for (const status of [401, 403]) {
      const fetchMock = vi.fn().mockResolvedValue(new Response("", { status }));
      globalThis.fetch = fetchMock;

      await expect(fetchText("https://example.com", { retryDelayMs: 1 })).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("does retry a 500 — the server may recover", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("recovered", { status: 200 }));
    globalThis.fetch = fetchMock;

    expect(await fetchText("https://example.com", { retryDelayMs: 1 })).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the configured User-Agent and Accept headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;

    await fetchText("https://example.com");

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("Mozilla");
    expect(headers.Accept).toContain("text/html");
  });

  it("lets caller-supplied headers override the defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;

    await fetchText("https://example.com", { headers: { "User-Agent": "custom-agent" } });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("custom-agent");
  });

  it("passes an abort signal so a slow-trickling body is actually bounded", async () => {
    // This is the exact failure mode that motivated dropping axios: a
    // request that takes far longer than its configured timeout to finish
    // receiving the body must still be aborted, not merely timed out on
    // connect.
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;

    await fetchText("https://example.com", { timeoutMs: 5_000 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("describeError", () => {
  it("formats an HttpStatusError as its status line", () => {
    expect(describeError(new HttpStatusError(404, "Not Found", "https://x"))).toBe(
      "HTTP 404 Not Found",
    );
  });

  it("formats a timeout abort as ETIMEDOUT", () => {
    const timeoutError = new DOMException("The operation timed out.", "TimeoutError");
    expect(describeError(timeoutError)).toBe("ETIMEDOUT");
  });

  it("falls back to the error message for anything else", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies a non-Error value rather than throwing", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(null)).toBe("null");
  });
});

describe("retry backoff timing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits with exponential backoff between attempts", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fail 1"))
      .mockRejectedValueOnce(new TypeError("fail 2"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchMock;

    const promise = fetchText("https://example.com", { retries: 2, retryDelayMs: 100 });

    await vi.advanceTimersByTimeAsync(100); // first backoff: 100 * 2^0
    await vi.advanceTimersByTimeAsync(200); // second backoff: 100 * 2^1

    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    globalThis.fetch = originalFetch;
  });
});
