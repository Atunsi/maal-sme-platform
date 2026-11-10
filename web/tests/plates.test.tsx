// R1 (DECISIONS 45): different states never share a word, so colour is never the only difference between
// two plates. B2: an approval that is not unconditional reads "Approved, conditional" wherever it shows.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SheetPage from "@/app/[locale]/business/[id]/sheet/page";
import { CreditCard } from "@/components/CreditCard";
import { creditReadout, ReadoutCard } from "@/components/Readouts";
import { VerdictSheet } from "@/components/VerdictSheet";
import { creditPlate, DECISION_VARIANT, decisionWord } from "@/lib/decision";
import { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture, webRoot } from "./helpers";

vi.mock("@/lib/api", () => ({
  getCredit: async (id: number) => ({ ok: true, data: fixture(`credit_${id}`, CreditResponse) }),
  getZakat: async (id: number) => ({ ok: true, data: fixture(`zakat_${id}`, ZakatResponse) }),
  getForecast: async (id: number) => ({ ok: true, data: fixture(`forecast_${id}`, ForecastResponse) }),
  getAnomaly: async (id: number) => ({ ok: true, data: fixture(`anomaly_${id}`, AnomalyResponse) }),
}));

/** Every catalogue group whose words appear on a plate, keyed by state. */
const PLATE_GROUPS = ["decision_state", "status", "sharia", "level", "zakat_status", "offer_status", "magnitude", "direction"] as const;

function sources(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".tsx")) files.push(path);
    }
  };
  walk(join(webRoot, "components"));
  walk(join(webRoot, "app"));
  return files;
}

describe("plates", () => {
  it("every plate state has its own word", () => {
    for (const m of [en, ar]) {
      for (const group of PLATE_GROUPS) {
        const words = Object.values(m.enums[group]);
        expect(new Set(words).size, `${group} repeats a word`).toBe(words.length);
      }
      // The two approvals: the word, not only the plate colour, tells them apart.
      expect(m.enums.decision_state.approved_conditional).not.toBe(m.enums.decision_state.approved_unconditional);
      // Each nisab status has its own words (R7).
      const nisab = [...Object.values(m.zakat.nisabStatus), m.zakat.nisabUnknown];
      expect(new Set(nisab).size).toBe(nisab.length);
    }
    expect(Object.keys(DECISION_VARIANT).sort()).toEqual(Object.keys(en.enums.decision_state).sort());
    // Every decision plate call site goes through lib/decision.ts.
    const offenders = sources().filter((f) => /m\.enums\.decision\[/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("10037 reads Approved, conditional on the overview card, the credit page, the admin row and the print sheet", async () => {
    const data = fixture("credit_10037", CreditResponse);
    expect(data.credit!.decision).toBe("approved");
    expect(data.credit_decision_detail!.offer_status).not.toBe("unconditional");
    const word = en.enums.decision_state.approved_conditional;
    expect(word).toBe("Approved, conditional");
    expect(ar.enums.decision_state.approved_conditional).toBe("موافقة مشروطة");
    expect(decisionWord(data.credit!, data.credit_decision_detail, en)).toBe(word);

    const card = render(<ReadoutCard lens="Credit" href="#" readout={creditReadout(data, "en", en)} index={0} m={en} />);
    expect(card.getByText(word)).toBeTruthy();
    card.unmount();

    const verdict = render(<VerdictSheet data={data} locale="en" m={en} />);
    expect(verdict.getByText(word)).toBeTruthy();
    verdict.unmount();

    const credit = render(<CreditCard data={data} initialView="public" locale="en" m={en} />);
    expect(credit.getByText(word)).toBeTruthy();
    expect(credit.getByRole("heading", { level: 1 }).textContent).toContain(en.credit.titleConditional);
    credit.unmount();

    expect(creditPlate(data, en)).toEqual({ state: "approved_conditional", variant: "warn", word });

    render(await SheetPage({ params: Promise.resolve({ locale: "en", id: "10037" }) }));
    expect(screen.getByText(word)).toBeTruthy();
  });

  it("10001 stays Approved, unconditional", () => {
    const data = fixture("credit_10001", CreditResponse);
    expect(creditPlate(data, en)).toEqual({ state: "approved_unconditional", variant: "ok", word: en.enums.decision_state.approved_unconditional });
  });
});
