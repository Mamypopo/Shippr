"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/chrome/Toast";

/**
 * "ดึงตอนนี้" — runs one ingestion job immediately instead of waiting for its
 * cron schedule, useful for checking a source works at all or pulling this
 * week's figure the moment it publishes rather than at the scheduled hour.
 *
 * Posts to the session-gated route, never the cron one — see that route's
 * own comment for why the cron secret can't be the thing guarding a button.
 */
export function RunIngestionButton({ jobKey, label }: { jobKey: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);

    try {
      const response = await fetch(`/api/admin/run/${jobKey}`, { method: "POST" });
      const body = await response.json();

      if (!response.ok && response.status !== 500) {
        // 401/403/404 — the request itself was rejected, not the job.
        toast.error(body.error ?? "สั่งรันไม่สำเร็จ");
        return;
      }

      // A 500 here means the job ran and every source inside it failed —
      // still a completed run worth reporting, not a request-level error.
      const written = body.rowsWritten ?? 0;
      if (body.status === "SUCCESS") {
        toast.success(`${label}: ดึงสำเร็จ เขียน ${written} แถว`);
      } else if (body.status === "PARTIAL") {
        toast.info(`${label}: สำเร็จบางส่วน เขียน ${written} แถว — ${body.error ?? ""}`);
      } else {
        toast.error(`${label}: ล้มเหลวทั้งหมด — ${body.error ?? "ไม่ทราบสาเหตุ"}`);
      }

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
      className="btn px-2.5 py-1 text-micro disabled:opacity-60"
    >
      {busy ? "กำลังดึง…" : "ดึงตอนนี้"}
    </button>
  );
}
