// Static-build only: scripts/build-static.mjs copies this to app/[locale]/business/[id]/layout.tsx for the
// online snapshot and removes it afterwards. It must never stay in app/: on the live server a route that lists
// its params is treated as pre-built, and the first lens call (fresh from the API) then fails the page with
// "changed from static to dynamic at runtime".
import type { ReactNode } from "react";
import { staticIds } from "@/lib/static-data";

export function generateStaticParams() {
  return staticIds().map((id) => ({ id: String(id) }));
}

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return children;
}
