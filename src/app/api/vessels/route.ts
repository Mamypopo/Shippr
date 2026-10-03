import { isAuthFailure, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodIssues, trackedVesselSchema } from "@/lib/validation";

/**
 * Start tracking a vessel by MMSI.
 *
 * Adding one here does not fetch a position immediately — the
 * `vessel-tracking` cron (every 15 minutes via GitHub Actions, same reason as
 * the news feed) picks it up on its next run. A vessel with no position yet
 * just shows "ยังไม่มีตำแหน่ง" until then, same as a freshly-added freight
 * index source before its first successful scrape.
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

  const parsed = trackedVesselSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: formatZodIssues(parsed.error) },
      { status: 422 },
    );
  }

  const { mmsi, label, destinationPortUnlocode } = parsed.data;

  let destinationPortId: string | null = null;
  if (destinationPortUnlocode) {
    const port = await prisma.port.findUnique({
      where: { unlocode: destinationPortUnlocode },
      select: { id: true },
    });
    if (!port) {
      return Response.json(
        { error: "Validation failed", fields: { destinationPortUnlocode: "ไม่พบท่าเรือนี้ในระบบ" } },
        { status: 422 },
      );
    }
    destinationPortId = port.id;
  }

  const existing = await prisma.trackedVessel.findUnique({ where: { mmsi } });
  if (existing) {
    // Re-adding a vessel that was already stopped resumes it, rather than
    // erroring — the operator asking to track it again is the whole point.
    const vessel = await prisma.trackedVessel.update({
      where: { mmsi },
      data: { label, destinationPortId, isActive: true, enteredById: auth.user.id },
    });
    return Response.json({ saved: true, vessel, resumed: !existing.isActive }, { status: 200 });
  }

  const vessel = await prisma.trackedVessel.create({
    data: { mmsi, label, destinationPortId, enteredById: auth.user.id },
  });

  return Response.json({ saved: true, vessel, resumed: false }, { status: 201 });
}
