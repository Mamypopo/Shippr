import { destroySession } from "@/lib/session";

export async function POST(): Promise<Response> {
  await destroySession();
  return Response.json({ ok: true });
}
