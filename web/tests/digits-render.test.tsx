// R2 (DECISIONS 45): with Arabic-Indic digits on, every eligible number converts, inside links and before
// the percent sign too. Only N3's elements keep Western digits: [data-latin], code, pre, [lang=en] and fields.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { creditReadout, forecastReadout, ReadoutCard, reviewReadout, shariaReadout, zakatReadout } from "@/components/Readouts";
import { VerdictSheet } from "@/components/VerdictSheet";
import { applyDigits, toArabDigits, toLatnDigits } from "@/lib/digits";
import { formatPct } from "@/lib/format";
import { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/schemas";
import { ar, fixture } from "./helpers";

const N3 = "[data-latin], code, pre, [lang=en], input, textarea, select";

/** Text nodes under root that still hold a Western digit outside the N3 elements. */
export function westernDigitsLeft(root: Element): string[] {
  const left: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(N3)) continue;
    if (/[0-9]/.test(node.nodeValue ?? "")) left.push(node.nodeValue!);
  }
  return left;
}

afterEach(() => {
  document.documentElement.lang = "en";
});

describe("arabic digits", () => {
  it("formatPct gives one string the page rewrite converts exactly, both ways", () => {
    for (const v of [0, 6.5, 12.25, 2.5, 34.6, 100]) {
      expect(toArabDigits(formatPct(v, "ar"))).toBe(formatPct(v, "ar", "arab"));
      expect(toLatnDigits(formatPct(v, "ar", "arab"))).toBe(formatPct(v, "ar"));
      expect(formatPct(v, "en")).toMatch(/^[0-9.]+%$/);
    }
    expect(formatPct(34.6, "ar", "arab", 1)).toBe("٣٤٫٦٪");
    expect(formatPct(6.5, "en")).toBe("6.5%");
  });

  it("arabic digits convert every eligible number", () => {
    document.documentElement.lang = "ar";
    const credit = fixture("credit_10001", CreditResponse);
    const readouts = [
      creditReadout(credit, "ar", ar),
      shariaReadout(credit, "ar", ar),
      zakatReadout(fixture("zakat_10001", ZakatResponse), "ar", ar),
      forecastReadout(fixture("forecast_10001", ForecastResponse), "ar", ar),
      reviewReadout(fixture("anomaly_10001", AnomalyResponse), "ar", ar),
    ];
    const { container } = render(
      <main>
        <VerdictSheet data={credit} locale="ar" m={ar} />
        {readouts.map((readout, i) => (
          <ReadoutCard key={i} lens={`lens ${i}`} href={`/ar/business/10001/x${i}`} readout={readout} index={i} m={ar} />
        ))}
      </main>,
    );
    const main = container.querySelector("main")!;
    // Before the switch, the page holds Western digits inside links (the readout cards) and before "%".
    expect(westernDigitsLeft(main).length).toBeGreaterThan(0);
    expect([...main.querySelectorAll("a")].some((a) => /[0-9]/.test(a.textContent!))).toBe(true);
    applyDigits(main, "arab");
    expect(westernDigitsLeft(main)).toEqual([]);
    // The markup and the readout cards' figures converted, sign and all.
    expect(main.textContent).toContain(formatPct(credit.credit!.base_markup_pct!, "ar", "arab"));
    // N3 still holds: the reference number (DECISIONS 58, in place of the aside's short hashes) stays Latin.
    expect(main.querySelector("[data-reference]")!.textContent).toMatch(/^M-10001-[0-9A-F]{8}$/);
  });
});
