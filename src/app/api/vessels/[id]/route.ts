import { isAuthFailure, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Stop tracking a vessel — sets `isActive: false` rather than deleting it.
 *
 * The position history stays (useful after the fact: "when did it actually
 * arrive"), and the cron skips it going forward since the job only queries
 * `isActive: true`. A real delete would also cascade away every position
 * ever recorded for it, which a careless click should not be able to do.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await context.params;

  const vessel = await prisma.trackedVessel.findUnique({ where: { id } });
  if (!vessel) {
    return Response.json({ error: "ไม่พบเรือนี้" }, { status: 404 });
  }

  await prisma.trackedVessel.update({ where: { id }, data: { isActive: false } });

  return Response.json({ stopped: true });
}
