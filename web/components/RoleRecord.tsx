"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type Props = {
  card: ReactNode;
  /** The technical record, open (admin) and closed (public demo). Absent for the owner. */
  open: ReactNode;
  closed: ReactNode;
  /** The credit page only: in the Compliance View the card gives way to the technical record, open. */
  followsView?: boolean;
};

function Pick({ card, open, closed, followsView }: Props) {
  const params = useSearchParams();
  if (followsView && params.get("view") === "compliance") return <>{open}</>;
  const role = params.get("as");
  return (
    <>
      {card}
      {role === "owner" ? null : role === "admin" ? open : closed}
    </>
  );
}

/**
 * DECISIONS 58: who sees what. The demo role rides in ?as= (lib/businesses.ts) and proves nothing; it is read
 * in the browser, as RoleHeading does, so the online snapshot (one file for every query) switches too. Nothing
 * is stored. Before the query is read, the public demo's view shows: the card and the closed record.
 */
export function RoleRecord(props: Props) {
  return (
    <Suspense
      fallback={
        <>
          {props.card}
          {props.closed}
        </>
      }
    >
      <Pick {...props} />
    </Suspense>
  );
}
