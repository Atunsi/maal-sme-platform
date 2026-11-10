// E2: the printable decision sheet, rendered from the captured fixtures. DECISIONS 51.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SheetPage from "@/app/[locale]/business/[id]/sheet/page";
import { AnomalyResponse, CreditResponse, ForecastResponse, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture } from "./helpers";
import { nisabPlate } from "@/lib/nisab";

vi.mock("@/lib/api", () => ({
  getCredit: async (id: number) => ({ ok: true, data: fixture(`credit_${id}`, CreditResponse) }),
  getZakat: async (id: number) => ({ ok: true, data: fixture(`zakat_${id}`, ZakatResponse) }),
  getForecast: async (id: number) => ({ ok: true, data: fixture(`forecast_${id}`, ForecastResponse) }),
  getAnomaly: async (id: number) => ({ ok: true, data: fixture(`anomaly_${id}`, AnomalyResponse) }),
}));

const sheet = async (id: number, locale: "en" | "ar" = "en") => render(await SheetPage({ params: Promise.resolve({ locale, id: String(id) }) }));

describe("print sheet", () => {
  it("print sheet shows the required labels", async () => {
    const credit = fixture("credit_10001", CreditResponse);
    const zakat = fixture("zakat_10001", ZakatResponse);
    const { container } = await sheet(10001);
    const text = container.textContent!;
    expect(text).toContain(en.overview.markupLabel); // U1
    expect(text).toContain(en.overview.lateValue); // U2
    expect(text).toContain(en.sharia.label); // U6
    expect(text).toContain(credit.sharia_screen.rule_table_status);
    expect(text).toContain(nisabPlate(zakat.zakat!.nisab_source_status, en)!.words); // U7, the fixture's own status
    expect(text).toContain(en.zakat.asReturned); // Not a ZATCA assessment
    expect(text).toContain(`${en.common.population}: ${en.enums.population.serving}`); // U11
    expect(text).toContain(credit.receipt.scope!); // U13, verbatim
    expect(text).toContain(credit.receipt.output_sha256); // full hash
    for (const line of credit.credit_explanation!.public_tier) expect(text).toContain(line.text); // U4, verbatim
    expect(screen.getByRole("button", { name: en.sheet.print }).hasAttribute("data-print-hide")).toBe(true);
  });

  it("carries no print timestamp", async () => {
    const { container } = await sheet(10001);
    const today = new Date().toISOString().slice(0, 10);
    expect(container.textContent).not.toContain(today);
  });

  it("print sheet insufficient_data for 10003", async () => {
    const { container } = await sheet(10003);
    expect(screen.getAllByText(en.enums.status.insufficient_data).length).toBeGreaterThan(0);
    expect(container.textContent).toContain(en.refusal.title); // U10: the refusal, never a low result
    expect(container.textContent).not.toContain(en.overview.markupLabel);
  });

  it("partial_profile shows its own state (10040)", async () => {
    await sheet(10040);
    expect(screen.getAllByText(en.enums.status.partial_profile).length).toBeGreaterThan(0);
  });

  it("print sheet renders in arabic", async () => {
    const { container } = await sheet(10001, "ar");
    expect(container.textContent).toContain(ar.sharia.label);
    expect(container.textContent).toContain(ar.overview.markupLabel);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(ar.sheet.heading.split("{name}")[0]!);
  });
});
