// The reference number an owner quotes about one result (DECISIONS 58): M-{business}-{first 8 of output_sha256}.
// It points at the full technical record of that result. It is not a security token and proves nothing.
import type { Receipt } from "@/lib/types";

const LENGTH = 8;

/** The only builder of a reference number (PR4), so every place that shows one shows the same. */
export function referenceFor(receipt: Pick<Receipt, "output_sha256">, businessId: number): string {
  return `M-${businessId}-${receipt.output_sha256.slice(0, LENGTH).toUpperCase()}`;
}

/** A reference as typed by an admin, in any case; null when it is not one. */
export function parseReference(text: string): { businessId: number; prefix: string } | null {
  const found = /^M-(\d+)-([0-9A-F]{8})$/i.exec(text.trim());
  return found ? { businessId: Number(found[1]), prefix: found[2]!.toLowerCase() } : null;
}

/** Whether a reference still names this result: its 8 characters are the start of the current output hash. */
export function referenceMatches(prefix: string, receipt: Pick<Receipt, "output_sha256">): boolean {
  return receipt.output_sha256.toLowerCase().startsWith(prefix.toLowerCase());
}
