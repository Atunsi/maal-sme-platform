"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { factorValues, type FactorValue } from "@/app/actions";
import { Code, Num } from "@/components/ui";
import type { Locale } from "@/lib/i18n";

// One request per business and page visit, shared by every factor row: /profile is fetched on the first
// open only, through a server action (and so through the queue), never from the browser to the API.
const profiles = new Map<number, Promise<FactorValue>>();

type Labels = { more: string; value: string; nullReason: string; none: string; glossary: string; loading: string };

/**
 * I3 (DECISIONS 45): a credit factor's disclosure. Opening it shows the feature's raw named value and its
 * null reason from /profile (U9: raw values only, never a peer or sector comparison) and a link to the
 * glossary. The factor's own text above stays verbatim (U4).
 */
export function FactorDetails({ businessId, feature, features, locale, glossaryHref, labels }: { businessId: number; feature: string; features: string[]; locale: Locale; glossaryHref: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FactorValue | null>(null);
  const panelId = useId();

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || result) return;
    if (!profiles.has(businessId)) profiles.set(businessId, factorValues(businessId, features, locale));
    setResult(await profiles.get(businessId)!);
  }

  const entry = result?.ok ? result.values[feature] : undefined;
  return (
    <span className="mt-1 block">
      <button type="button" className="textlink text-sm font-semibold" aria-expanded={open} aria-controls={panelId} data-factor={feature} onClick={toggle}>
        {labels.more}
      </button>
      <span id={panelId} hidden={!open} className="mt-1 block border-s-2 border-line ps-3 text-sm" data-factor-panel>
        {!result ? (
          open && <span role="status">{labels.loading}</span>
        ) : !result.ok ? (
          <span className="text-bad">{result.word}</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span>
              <Code>{feature}</Code>
            </span>
            <span>
              {labels.value}: <Num>{entry === undefined || entry.value === null ? labels.none : String(entry.value)}</Num>
            </span>
            {entry?.nullReason && (
              <span>
                {labels.nullReason}: <Code>{entry.nullReason}</Code>
              </span>
            )}
          </span>
        )}
        <Link href={glossaryHref} prefetch={false} className="textlink">
          {labels.glossary}
        </Link>
      </span>
    </span>
  );
}
