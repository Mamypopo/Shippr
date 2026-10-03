"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Magic-link sign-in.
 *
 * No password to store, reset or leak, and a shared desk mailbox is how
 * forwarding teams already share access to carrier portals.
 */
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) {
        setState("error");
        setMessage(error.message);
        return;
      }

      setState("sent");
    } catch {
      setState("error");
      setMessage("ยังตั้งค่า Supabase ไม่ครบ ตรวจ NEXT_PUBLIC_SUPABASE_URL และ ANON_KEY ใน .env");
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-5 text-small leading-relaxed" style={{ color: "var(--color-clear)" }}>
        ส่งลิงก์เข้าสู่ระบบไปที่ {email} แล้ว เปิดลิงก์ในอีเมลเพื่อเข้าใช้งาน
        ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      <label className="block">
        <span className="block text-micro text-hull-faint">อีเมล</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@company.co.th"
          className="mt-1 w-full px-2 py-2 text-base"
        />
      </label>

      <button
        type="submit"
        disabled={state === "sending" || email.trim() === ""}
        className="mt-4 w-full btn-solid px-4 py-2 text-small"
      >
        {state === "sending" ? "กำลังส่งลิงก์" : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>

      {state === "error" && <p className="mt-3 text-small text-hazard">{message}</p>}
    </form>
  );
}
