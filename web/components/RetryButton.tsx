"use client";

import { useRouter } from "next/navigation";

export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-2 min-h-11 border border-bad bg-card px-3 text-sm font-medium text-bad"
    >
      {label}
    </button>
  );
}
