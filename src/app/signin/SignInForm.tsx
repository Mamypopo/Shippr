"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        setPassword("");
        return;
      }

      // Only same-origin paths, so a crafted link cannot bounce a freshly
      // signed-in user off to someone else's site.
      router.push(next?.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="block">
        <span className="label">ชื่อผู้ใช้</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="mt-1.5 w-full px-3 py-2 text-body"
        />
      </label>

      <label className="block">
        <span className="label">รหัสผ่าน</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1.5 w-full px-3 py-2 text-body"
        />
      </label>

      {error && (
        <p className="text-small" style={{ color: "var(--color-bad)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || username.trim() === "" || password === ""}
        className="btn-primary mt-1 w-full px-4 py-2.5 text-small"
      >
        {busy ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
