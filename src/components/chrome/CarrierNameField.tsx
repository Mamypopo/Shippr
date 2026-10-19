"use client";

import { useState } from "react";

import { KNOWN_CARRIERS } from "@/lib/carriers";

const OTHER = "__OTHER__";

/**
 * A dropdown of known carriers with a "พิมพ์เอง" escape hatch, used both for
 * a carrier quote's name and for the carrier on a tracked vessel — same
 * control, same list, so picking "Maersk" means the same thing in both
 * places and both can link out to that carrier's own tracking page.
 *
 * Stays a plain string underneath (not an enum): a smaller regional carrier
 * not on the list is still a valid value, just typed rather than picked.
 */
export function CarrierNameField({
  value,
  onChange,
  label = "สายเรือ",
  placeholder = "เช่น Maersk",
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const initiallyOther = value !== "" && !KNOWN_CARRIERS.some((c) => c.name === value);
  const [mode, setMode] = useState<"select" | "other">(initiallyOther ? "other" : "select");

  return (
    <label className="block">
      <span className="block text-micro text-ink-faint">{label}</span>
      <select
        value={mode === "other" ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setMode("other");
            onChange("");
          } else {
            setMode("select");
            onChange(e.target.value);
          }
        }}
        className="mt-1 w-full px-2 py-1.5 text-small"
      >
        <option value="" disabled>
          เลือกสายเรือ
        </option>
        {KNOWN_CARRIERS.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
        <option value={OTHER}>อื่นๆ (พิมพ์เอง)</option>
      </select>
      {mode === "other" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="mt-1.5 w-full px-2 py-1.5 text-small"
        />
      )}
    </label>
  );
}
