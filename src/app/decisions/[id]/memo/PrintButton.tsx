"use client";

/**
 * The browser's own print dialog is the PDF export: "save as PDF" there
 * produces the A4 document the print stylesheet lays out, with no server-side
 * renderer to deploy or keep working.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-rule-heavy bg-plan px-3 py-1.5 text-small hover:bg-plan-sunk"
    >
      พิมพ์ หรือบันทึกเป็น PDF
    </button>
  );
}
