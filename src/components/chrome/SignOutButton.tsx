"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/chrome/Toast";

export function SignOutButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        // The session cookie may still be live server-side, so staying put
        // rather than navigating away avoids showing a signed-out page while
        // the account is, in fact, still signed in.
        toast.error("ออกจากระบบไม่สำเร็จ ลองอีกครั้ง");
        return;
      }

      toast.success("ออกจากระบบแล้ว");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-small text-ink-faint transition-colors hover:text-ink"
    >
      {busy ? "กำลังออก" : "ออกจากระบบ"}
    </button>
  );
}
