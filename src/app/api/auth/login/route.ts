import { z } from "zod";

import { LOCKOUT_MINUTES, signIn } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "กรอกชื่อผู้ใช้").max(64),
  password: z.string().min(1, "กรอกรหัสผ่าน").max(200),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ" },
      { status: 422 },
    );
  }

  const result = await signIn(
    parsed.data.username,
    parsed.data.password,
    request.headers.get("user-agent"),
  );

  if (!result.ok) {
    if (result.reason === "LOCKED") {
      return Response.json(
        {
          error: `ลองรหัสผิดหลายครั้งเกินไป บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก ${
            result.retryAfterMinutes ?? LOCKOUT_MINUTES
          } นาที`,
        },
        { status: 429 },
      );
    }

    if (result.reason === "DISABLED") {
      return Response.json({ error: "บัญชีนี้ถูกปิดใช้งาน ติดต่อผู้ดูแลระบบ" }, { status: 403 });
    }

    // Deliberately generic: naming which half was wrong would let an
    // attacker enumerate valid usernames.
    return Response.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  return Response.json({ user: result.user });
}
