import { isAuthFailure, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPortSnapshots } from "@/lib/queries";
import { riskLevelForWaitDays } from "@/lib/risk";
import { formatZodIssues, portStatusSchema } from "@/lib/validation";

export async function GET(): Promise<Response> {
  return Response.json({ ports: await getPortSnapshots() });
}

/**
 * Record a port waiting-time observation.
 *
 * No free API publishes reliable berth waiting times, so this is the primary
 * path: an analyst keys in the weekly figure from whichever report the desk
 * subscribes to.
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

  const parsed = portStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: formatZodIssues(parsed.error) },
      { status: 422 },
    );
  }

  const { unlocode, observedOn, avgWaitDays, vesselsWaiting, note } = parsed.data;

  const port = await prisma.port.findUnique({ where: { unlocode }, select: { id: true } });
  if (!port) {
    return Response.json({ error: `No tracked port with UN/LOCODE "${unlocode}".` }, { status: 404 });
  }

  const observedDay = new Date(
    Date.UTC(observedOn.getUTCFullYear(), observedOn.getUTCMonth(), observedOn.getUTCDate()),
  );

  const row = await prisma.portStatus.upsert({
    where: { portId_observedOn: { portId: port.id, observedOn: observedDay } },
    create: {
      portId: port.id,
      observedOn: observedDay,
      avgWaitDays,
      vesselsWaiting: vesselsWaiting ?? null,
      riskLevel: riskLevelForWaitDays(avgWaitDays),
      source: "MANUAL",
      note: note ?? null,
      enteredById: auth.user.id,
    },
    update: {
      avgWaitDays,
      vesselsWaiting: vesselsWaiting ?? null,
      riskLevel: riskLevelForWaitDays(avgWaitDays),
      source: "MANUAL",
      note: note ?? null,
      enteredById: auth.user.id,
    },
    select: { id: true, observedOn: true, riskLevel: true },
  });

  return Response.json({ saved: true, row }, { status: 201 });
}
