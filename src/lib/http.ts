/**
 * HTTP fetching for the ingestion jobs.
 *
 * Built on Node's native `fetch` (undici), not axios. Measured against the
 * SCFI mirror this project actually scrapes: a single axios request for that
 * page took 60+ seconds — past its own configured 15-second timeout, which
 * never fired — while native `fetch` for the identical URL and headers
 * completed in a few seconds, repeatedly. `AbortSignal.timeout` is also
 * enforced for the whole request, including a slow-trickling body, which is
 * exactly the phase axios's timeout did not cover here. Whatever the root
 * cause on axios's side, this is the one that is actually fast and whose
 * timeout actually fires — see http.test.ts for the enforcement test.
 *
 * Every scrape target here is a public site that rate-limits and occasionally
 * times out, so a bare fetch call fails the weekly job far too often. Retries
 * are bounded and backed off; a job that cannot get a page gives up and lets
 * the caller record the failure rather than hanging the cron invocation.
 */

export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_RETRIES = 2;

/**
 * Some of these sites reject the default Node agent outright. This is an
 * ordinary desktop browser string — the goal is to be served the same public
 * page a person would see, not to hide what we are.
 */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface FetchOptions {
  retries?: number;
  /** Base delay for exponential backoff, in milliseconds. */
  retryDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Raised for a non-2xx response, carrying the status for retry decisions. */
export class HttpStatusError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    url: string,
  ) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = "HttpStatusError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A 404/401/403 will not fix itself on retry; everything else is worth another attempt. */
function isPermanentFailure(error: unknown): boolean {
  return error instanceof HttpStatusError && [401, 403, 404].includes(error.status);
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelayMs = 1_000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        // Covers the whole request, including a slow response body — the
        // specific phase a plain per-call axios timeout did not reach here.
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new HttpStatusError(response.status, response.statusText, url);
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      if (isPermanentFailure(error)) break;
      if (attempt < retries) await sleep(retryDelayMs * 2 ** attempt);
    }
  }

  throw new Error(`GET ${url} failed: ${describeError(lastError)}`);
}

export function describeError(error: unknown): string {
  if (error instanceof HttpStatusError) return `HTTP ${error.status} ${error.statusText}`;
  // AbortSignal.timeout() rejects with a DOMException named "TimeoutError".
  if (error instanceof DOMException && error.name === "TimeoutError") return "ETIMEDOUT";
  if (error instanceof Error) return error.message;
  return String(error);
}
