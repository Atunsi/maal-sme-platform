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
      className={`min-h-11 cursor-pointer border-0 px-4.5 py-2.5 text-sm transition-colors ${
        view === value ? "bg-ink font-semibold text-page" : "bg-card font-medium text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={labels.group} className="rise flex self-start border border-ink" style={{ animationDelay: "0.15s" }}>
        {button("public", labels.public)}
        {button("compliance", labels.compliance)}
      </div>
      {/* `hidden` removes the slot from layout, so its entrance replays each time it is shown. */}
      <div hidden={view !== "public"}>{publicSlot}</div>
      <div hidden={view !== "compliance"}>{complianceSlot}</div>
    </div>
  );
}
