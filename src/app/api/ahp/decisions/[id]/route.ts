import { prisma } from "@/lib/db";

/**
 * Rehydrate a saved decision for the detail and memo views.
 *
 * Reads the stored result rather than recomputing it. A memo is a record of
 * the call that was made, and recomputing would quietly rewrite it if the
 * engine were ever tuned.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  const decision = await prisma.aHPDecisionLog.findUnique({
    where: { id },
    include: { quotes: { orderBy: { createdAt: "asc" } } },
  });

  if (!decision) {
    return Response.json({ error: "No decision with that id." }, { status: 404 });
  }

  return Response.json({ decision });
}
