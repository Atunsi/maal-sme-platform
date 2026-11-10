"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";
import { roleQuery } from "@/lib/businesses";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * The link with the given demo role (?as=) added, keeping any other query and the hash. A link that names a
 * role already keeps its own: the server knew it, and the browser only fills in what a snapshot left out.
 */
export function withRole(href: string, role: string | null): string {
  const [pathQuery = "", hash] = href.split("#");
  const [path = "", search = ""] = pathQuery.split("?");
  const params = new URLSearchParams(search);
  const q = roleQuery(role);
  if (params.has("as") || !q) return href;
  params.set("as", q.slice("?as=".length));
  const s = params.toString();
  return `${path}${s ? `?${s}` : ""}${hash !== undefined ? `#${hash}` : ""}`;
}

function WithRole({ href, ...rest }: Props) {
  return <Link href={withRole(href, useSearchParams().get("as"))} {...rest} />;
}

/**
 * A link that keeps the demo role of the page it is on. The role is read in the browser, so the online
 * snapshot (one file for every query, rendered with no role) keeps it too: an admin who opens a business
 * from the list is still the admin there. Before the browser takes over, the link is the href as given.
 */
export function RoleLink(props: Props) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <WithRole {...props} />
    </Suspense>
  );
}
