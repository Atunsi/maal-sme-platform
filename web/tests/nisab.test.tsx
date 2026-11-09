// R7 (DECISIONS 45): U7 widened. The nisab plate shows for every status the catalogue does not name as verified.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZakatCard } from "@/components/ZakatCard";
import { zakatReadout } from "@/components/Readouts";
import { NisabPlate } from "@/components/ui";
import { nisabPlate } from "@/lib/nisab";
import { ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";

const KNOWN = ["placeholder_unverified", "commercial_quote_documented_pending_independent_verification"] as const;

function withStatus(status: string) {
  const data = fixture("zakat_10001", ZakatResponse);
  return { ...data, zakat: { ...data.zakat!, nisab_source_status: status } };
}

describe("nisab plate", () => {
  it("nisab plate shows for every unverified status", () => {
    // No status counts as verified today.
    expect(en.zakat.nisabVerified).toEqual([]);
    expect(ar.zakat.nisabVerified).toEqual([]);
    for (const status of KNOWN) {
      for (const m of [en, ar]) {
        const plate = nisabPlate(status, m);
        expect(plate).toEqual({ words: m.zakat.nisabStatus[status], code: null });
      }
      // Each known status has its own words (R1).
      const { unmount } = render(<ZakatCard data={withStatus(status)} locale="en" m={en} />);
      expect(screen.getByText(en.zakat.nisabStatus[status])).toBeTruthy();
      unmount();
      expect(zakatReadout(withStatus(status), "en", en).note).toBe(en.zakat.nisabStatus[status]);
    }
    expect(new Set(KNOWN.map((s) => en.zakat.nisabStatus[s])).size).toBe(KNOWN.length);

    // An unknown status gets the generic words and its raw code beside the plate.
    const unknown = "some_future_status";
    expect(nisabPlate(unknown, en)).toEqual({ words: en.zakat.nisabUnknown, code: unknown });
    const { container } = render(<ZakatCard data={withStatus(unknown)} locale="en" m={en} />);
    expect(screen.getByText(en.zakat.nisabUnknown)).toBeTruthy();
    expect([...container.querySelectorAll("code")].some((c) => c.textContent === unknown)).toBe(true);

    // Even a status that sounds verified shows the plate until the catalogue names it.
    render(<NisabPlate status="verified" m={en} />);
    expect(screen.getAllByText(en.zakat.nisabUnknown).length).toBeGreaterThan(0);
  });

  it("only lib/nisab.ts reads nisab_source_status against a value", () => {
    const root = resolve(import.meta.dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name)) files.push(path);
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(join(root, dir));
    const offenders = files.filter((f) => /nisab_source_status\s*[!=]==?\s*["'`]/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
