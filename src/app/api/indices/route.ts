import { getAllIndexSeries, getIndexSeries } from "@/lib/queries";
import type { IndexCode } from "@/generated/prisma/enums";

const VALID_CODES = new Set(["WCI", "SCFI", "BDRY", "WTI", "BRENT"]);

/**
 * Index series with derived metrics for the charts.
 *
 * `?code=WCI&route=SHA_RTM` narrows to one lane; omitting both returns every
 * lane that has data.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const route = url.searchParams.get("route") ?? "COMPOSITE";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 52) || 52, 520);

  if (code) {
    if (!VALID_CODES.has(code)) {
      return Response.json(
        { error: `Unknown index code "${code}". Expected one of ${[...VALID_CODES].join(", ")}.` },
        { status: 400 },
      );
    }

    const series = await getIndexSeries(code as IndexCode, route, limit);
    if (!series) {
      return Response.json(
        { error: `No readings stored for ${code} on lane ${route}.` },
        { status: 404 },
      );
    }
    return Response.json({ series: [series] });
  }

  return Response.json({ series: await getAllIndexSeries(limit) });
}
