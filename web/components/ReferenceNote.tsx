"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Plate } from "@/components/ui";
import { fill } from "@/lib/i18n";
import { parseReference } from "@/lib/reference";

type Props = { businessId: number; current: string | null; labels: { opened: string; old: string } };

function Note({ businessId, current, labels }: Props) {
  const parsed = parseReference(useSearchParams().get("ref") ?? "");
  if (!parsed || parsed.businessId !== businessId) return null;
  const ref = `M-${parsed.businessId}-${parsed.prefix.toUpperCase()}`;
  // Only "earlier result": the UI cannot know whether the data or the method changed, so it never says which.
  const stale = current !== null && current !== ref;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm" data-reference-note>
      <span>
        {fill(labels.opened, { ref: "" }).trim()}{" "}
        <bdi dir="ltr" data-latin className="font-mono font-semibold">
          {ref}
        </bdi>
      </span>
      {stale && <Plate variant="warn">{labels.old}</Plate>}
    </p>
  );
}

/**
 * DECISIONS 58 (P8): an admin opened this business from the reference an owner quoted (?ref=). Shown beside the
 * heading; when the reference's characters no longer start the credit result's output hash, a plate says it is
 * from an earlier result. Read in the browser, so the online snapshot shows it too.
 */
export function ReferenceNote(props: Props) {
  return (
    <Suspense fallback={null}>
      <Note {...props} />
    </Suspense>
  );
}
