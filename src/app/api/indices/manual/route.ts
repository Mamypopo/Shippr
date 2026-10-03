import { isAuthFailure, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodIssues, manualIndexSchema } from "@/lib/validation";

/**
 * Hand-enter an index reading.
 *
 * All of these indices are scraped automatically now (including WCI, via its
 * page's own meta description — see scraper-config.ts), so this is a true
 * last resort: both the primary and fallback sources failed, or a more
 * trustworthy figure is available from elsewhere. Entries are stamped MANUAL
 * with the user who keyed them, and the ingestion job will not overwrite a
 * manual figure with a later scrape of the same week.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = manualIndexSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: formatZodIssues(parsed.error) },
      { status: 422 },
    );
  }

  const { indexCode, routeCode, periodDate, value, unit } = parsed.data;

  // Normalize to midnight UTC so one publication week is one row regardless
  // of the entering user's timezone.
  const periodDay = new Date(
    Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), periodDate.getUTCDate()),
  );

  const row = await prisma.freightIndex.upsert({
    where: {
      indexCode_routeCode_periodDate: { indexCode, routeCode, periodDate: periodDay },
    },
    create: {
      indexCode,
      routeCode,
      periodDate: periodDay,
      value,
      unit,
      source: "MANUAL",
      enteredById: auth.user.id,
    },
    update: { value, unit, source: "MANUAL", enteredById: auth.user.id },
    select: { id: true, indexCode: true, routeCode: true, periodDate: true },
  });

  return Response.json({ saved: true, row }, { status: 201 });
}
