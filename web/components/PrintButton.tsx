"use client";

/** E2: opens the browser's print dialog, where "Save as PDF" is one of the printers. Hidden on paper. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" data-print-hide className="themebtn" onClick={() => window.print()}>
      {label}
    </button>
  );
}
