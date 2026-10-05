import { isAuthFailure, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatZodIssues, carrierBookingSchema } from "@/lib/validation";

/** Record one booking actually placed with a carrier. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = carrierBookingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", fields: formatZodIssues(parsed.error) },
      { status: 422 },
    );
  }

  const booking = await prisma.carrierBooking.create({
    data: { ...parsed.data, enteredById: auth.user.id },
    select: { id: true, carrierName: true, bookedOn: true },
  });

  return Response.json({ saved: true, booking }, { status: 201 });
}
