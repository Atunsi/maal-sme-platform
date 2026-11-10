"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Props = { owner: string; other: string; className?: string };

function Heading({ owner, other, className }: Props) {
  return <h1 className={className}>{useSearchParams().get("as") === "owner" ? owner : other}</h1>;
}

/**
 * C7: the overview's h1, "Welcome back" for the owner role and the business named for anyone else. Read in
 * the browser, so the online snapshot (one file for every query) greets the owner too.
 */
export function RoleHeading(props: Props) {
  return (
    <Suspense fallback={<h1 className={props.className}>{props.other}</h1>}>
      <Heading {...props} />
    </Suspense>
  );
}
