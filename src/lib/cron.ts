/**
 * Shared plumbing for the scheduled ingestion routes: authorisation and the
 * run log that makes a silent failure visible on the dashboard.
 */

import { timingSafeEqual } from "node:crypto";

import { prisma } from "./db";
import { describeError } from "./http";

export type RunStatusKey = "SUCCESS" | "PARTIAL" | "FAILED";

/** Constant-time compare so a wrong secret cannot be discovered by timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Ingestion routes write to the database on a GET, so they are not open.
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * A missing CRON_SECRET denies rather than allows: a misconfigured deploy
 * should fail closed, not expose a public write endpoint.
 */
export function assertCronAuthorized(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || !secretsMatch(token, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export interface RunSummary {
  status: RunStatusKey;
  rowsWritten: number;
  errorMessage?: string;
  /** Anything the route wants to show the caller; not persisted. */
  detail?: unknown;
}

/**
 * Run an ingestion job and record the attempt either way.
 *
 * The log is what lets the UI say "Drewry: last success 3 days ago" instead
 * of presenting a stale figure as if it were this week's.
 */
export async function withScrapeRun(
  source: string,
  job: () => Promise<RunSummary>,
): Promise<Response> {
  const startedAt = Date.now();

  let summary: RunSummary;
  try {
    summary = await job();
  } catch (error) {
    summary = { status: "FAILED", rowsWritten: 0, errorMessage: describeError(error) };
  }

  const durationMs = Date.now() - startedAt;

  try {
    await prisma.scrapeRun.create({
      data: {
        source,
        status: summary.status,
        rowsWritten: summary.rowsWritten,
        // Long stack traces are noise in a log row; the first lines carry
        // the useful part.
        errorMessage: summary.errorMessage?.slice(0, 1000),
        durationMs,
      },
    });
  } catch {
    // Losing the log entry must not turn a successful ingest into a failure.
  }

  return Response.json(
    {
      source,
      status: summary.status,
      rowsWritten: summary.rowsWritten,
      durationMs,
      error: summary.errorMessage,
      detail: summary.detail,
    },
    { status: summary.status === "FAILED" ? 500 : 200 },
  );
}

/** SUCCESS when everything landed, PARTIAL when some did, FAILED when none. */
export function statusFor(okCount: number, totalCount: number): RunStatusKey {
  if (totalCount === 0 || okCount === 0) return "FAILED";
  return okCount === totalCount ? "SUCCESS" : "PARTIAL";
}
