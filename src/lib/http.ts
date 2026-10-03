import axios, { type AxiosRequestConfig } from "axios";

/**
 * HTTP fetching for the ingestion jobs.
 *
 * Every scrape target here is a public site that rate-limits and occasionally
 * times out, so a bare axios call fails the weekly job far too often. Retries
 * are bounded and backed off; a job that cannot get a page gives up and lets
 * the caller record the failure rather than hanging the cron invocation.
 */

export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_RETRIES = 2;

/**
 * Some of these sites reject the default axios agent outright. This is an
 * ordinary desktop browser string — the goal is to be served the same public
 * page a person would see, not to hide what we are.
 */
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface FetchOptions extends AxiosRequestConfig {
  retries?: number;
  /** Base delay for exponential backoff, in milliseconds. */
  retryDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { retries = DEFAULT_RETRIES, retryDelayMs = 1_000, ...axiosOptions } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get<string>(url, {
        timeout: DEFAULT_TIMEOUT_MS,
        responseType: "text",
        // Let any 2xx through; anything else should retry or surface.
        validateStatus: (status) => status >= 200 && status < 300,
        ...axiosOptions,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...axiosOptions.headers,
        },
      });

      return typeof response.data === "string" ? response.data : String(response.data);
    } catch (error) {
      lastError = error;

      // A 404 or a 403 will not fix itself on retry; only back off for
      // transient failures.
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status === 404 || status === 401 || status === 403) break;
      }

      if (attempt < retries) await sleep(retryDelayMs * 2 ** attempt);
    }
  }

  throw new Error(`GET ${url} failed: ${describeError(lastError)}`);
}

export function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) return `HTTP ${error.response.status} ${error.response.statusText}`;
    if (error.code) return error.code;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
