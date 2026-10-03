import { getRecentNews } from "@/lib/queries";

const VALID_SEVERITIES = new Set(["INFO", "WATCH", "ALERT"]);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const severity = url.searchParams.get("severity") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);

  if (severity && !VALID_SEVERITIES.has(severity)) {
    return Response.json(
      { error: `Unknown severity "${severity}". Expected INFO, WATCH or ALERT.` },
      { status: 400 },
    );
  }

  return Response.json({ items: await getRecentNews(limit, severity) });
}
