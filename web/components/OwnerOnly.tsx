"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

function Pick({ children }: { children: ReactNode }) {
  return useSearchParams().get("as") === "owner" ? <>{children}</> : null;
}

/**
 * IN1 (DECISIONS 62): a block only the business owner sees. The demo role rides in ?as= and is read in the
 * browser, as RoleRecord does (DECISIONS 58), so the online snapshot switches too. It proves nothing and
 * stores nothing. Before the query is read, and for the admin, the public demo and the Compliance View,
 * nothing shows.
 */
export function OwnerOnly({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Pick>{children}</Pick>
    </Suspense>
  );
}
