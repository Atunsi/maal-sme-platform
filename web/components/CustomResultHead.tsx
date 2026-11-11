"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { CopyButton, type CopyLabels } from "@/components/CopyButton";

/**
 * I5 (DECISIONS 45): the custom result's heading and its link. After a run (?ran=1, which the builder's
 * action adds) the page scrolls to the heading and focuses it, then drops the marker. The Copy button copies
 * the full result URL with its ?shock= parameters, so the result can be shared and re-run.
 */
export function CustomResultHead({ title, path, copy }: { title: string; path: string; copy: CopyLabels }) {
  const params = useSearchParams();
  const ref = useRef<HTMLHeadingElement>(null);
  // The server does not know the origin, so the full URL is filled in on the client.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const ran = params?.get("ran") === "1";
  useEffect(() => {
    if (!ran || !ref.current) return;
    ref.current.scrollIntoView({ block: "start" });
    ref.current.focus({ preventScroll: true });
    const url = new URL(window.location.href);
    url.searchParams.delete("ran");
    window.history.replaceState(null, "", url);
  }, [ran]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 ref={ref} id="custom-result" tabIndex={-1} className="heading scroll-mt-4 text-heading outline-none focus-visible:outline-2">
        {title}
      </h2>
      <span className="flex items-center gap-2 text-label" data-copy-link>
        <CopyButton value={`${origin}${path}`} name="result_url" labels={copy} />
      </span>
    </div>
  );
}
