"use client";

import { useState, type ReactNode } from "react";

type View = "public" | "compliance";

type Props = {
  initialView: View;
  labels: { group: string; public: string; compliance: string };
  publicSlot: ReactNode;
  complianceSlot: ReactNode;
};

/**
 * Both tiers arrive in one API response, so toggling needs no new request. A live demo can flip it
 * freely without touching the API's per-business rate limit. State sits in ?view=compliance, so the
 * view can be shared; pushState keeps Next's router in step without a server round trip.
 */
export function CreditViewSwitch({ initialView, labels, publicSlot, complianceSlot }: Props) {
  const [view, setView] = useState<View>(initialView);

  function choose(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "compliance") url.searchParams.set("view", "compliance");
    else url.searchParams.delete("view");
    window.history.pushState(null, "", url);
  }

  const button = (value: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => choose(value)}
      className={`rounded px-3 py-1 text-sm font-medium ${
        view === value ? "bg-brand text-white" : "border border-line bg-card text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="group" aria-label={labels.group} className="mb-3 flex gap-2">
        {button("public", labels.public)}
        {button("compliance", labels.compliance)}
      </div>
      <div hidden={view !== "public"}>{publicSlot}</div>
      <div hidden={view !== "compliance"}>{complianceSlot}</div>
    </div>
  );
}
