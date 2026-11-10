// C3 (DECISIONS 45): probabilities as a percentage with one decimal and the exact value as returned, and
// forecast horizons in catalogue words. formatRaw and its own test are unchanged.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComplianceView } from "@/components/ComplianceView";
import { ForecastCard } from "@/components/ForecastCard";
import { forecastReadout, ReadoutCard } from "@/components/Readouts";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { ZakatCard } from "@/components/ZakatCard";
import { formatInt, formatProbability, formatRaw } from "@/lib/format";
import { fill, pluralForm } from "@/lib/i18n";
import { CreditResponse, ForecastResponse, ScenarioObject, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture, readJson } from "./helpers";

const HORIZONS = ["30d", "60d", "90d"] as const;

describe("probabilities", () => {
  it("probabilities show a percentage and the exact value", () => {
    expect(formatProbability(0.346, "en").text).toBe("34.6% (0.346)");
    expect(formatProbability(0.025, "en").text).toBe("2.5% (0.025)");
    expect(formatProbability(0.052612, "en").text).toBe("5.3% (0.052612)");

    const forecast = fixture("forecast_10001", ForecastResponse);
    const f = forecast.forecast!;
    if (f.status !== "computed") throw new Error("10001 forecast fixture did not compute");
    const page = render(<ForecastCard data={forecast} locale="en" m={en} />);
    for (const key of HORIZONS) {
      const value = f.crunch_alert.liquidity_hazard[key];
      if (value !== null) expect(page.container.textContent).toContain(formatProbability(value, "en").text);
    }
    page.unmount();

    const card = render(<ReadoutCard lens="Forecast" href="#" readout={forecastReadout(forecast, "en", en)} index={0} m={en} />);
    const hazard = f.crunch_alert.liquidity_hazard["30d"];
    if (hazard !== null) expect(card.container.textContent).toContain(formatProbability(hazard, "en").text);
    card.unmount();

    const zakat = fixture("zakat_10001", ZakatResponse);
    const z = render(<ZakatCard data={zakat} locale="en" m={en} />);
    expect(z.container.textContent).toContain(formatProbability(zakat.zakat!.rate, "en").text);
    z.unmount();

    const baseline = ScenarioObject.parse(readJson("scenarios-data", "baseline.json"));
    const chosen = ScenarioObject.parse(readJson("scenarios-data", "severe_collapse.json"));
    const diff = render(<ScenarioCompare baseline={baseline} chosen={chosen} locale="en" m={en} />);
    expect(diff.container.textContent).toContain(formatProbability(chosen.credit_decision_detail!.pd, "en").text);
    diff.unmount();
  });

  it("the Compliance View keeps the exact PD alone", () => {
    const credit = fixture("credit_10001", CreditResponse);
    const { container } = render(
      <ComplianceView explanation={credit.credit_explanation!} detail={credit.credit_decision_detail!} receipt={credit.receipt} locale="en" m={en} />,
    );
    expect(container.textContent).toContain(formatRaw(credit.credit_decision_detail!.pd, "en"));
    expect(container.querySelector("[data-probability]")).toBeNull();
  });

  it("forecast horizons use catalogue words in both locales", () => {
    const forecast = fixture("forecast_10001", ForecastResponse);
    for (const [locale, m] of [["en", en], ["ar", ar]] as const) {
      const { container, unmount } = render(<ForecastCard data={forecast} locale={locale} m={m} />);
      const text = container.textContent!;
      for (const key of HORIZONS) {
        expect(text).not.toContain(`${key}:`);
        const days = Number.parseInt(key, 10);
        expect(text).toContain(fill(pluralForm(days, m.forecast.horizonDays, locale), { n: formatInt(days, locale) }));
      }
      unmount();
      // No digit is typed into the pattern: the formatter fills it, so the Arabic-Indic switch applies.
      for (const form of Object.values(m.forecast.horizonDays)) expect(form).not.toMatch(/[0-9٠-٩]/);
      expect(m.overview.hazardOver).not.toMatch(/[0-9٠-٩]/);
    }
  });
});

describe("forecast readout", () => {
  it("forecast card states the driver behind watch", () => {
    // C2: 10001 is on Watch with no negative balance projected; the card says why, in the driver's own text.
    const forecast = fixture("forecast_10001", ForecastResponse);
    const f = forecast.forecast!;
    if (f.status !== "computed") throw new Error("10001 forecast fixture did not compute");
    expect(f.crunch_alert.level).not.toBe("none");
    expect(f.crunch_alert.days_to_projected_negative_balance).toBeNull();
    for (const [locale, m] of [["en", en], ["ar", ar]] as const) {
      const { container, unmount } = render(<ReadoutCard lens="Forecast" href="#" readout={forecastReadout(forecast, locale, m)} index={0} m={m} />);
      const backend = container.querySelector("[data-backend]")!;
      // Verbatim (U4): the English driver, or in Arabic the backend's own Arabic driver (DECISIONS 57).
      expect(backend.textContent).toBe(locale === "ar" ? f.crunch_alert.drivers_ar![0] : f.crunch_alert.drivers[0]);
      expect(container.textContent).not.toContain(m.overview.noNegative);
      expect(container.textContent).not.toContain(ar.common.englishTemplate);
      unmount();
    }
    // With no alert, today's note stays.
    const calm = fixture("forecast_10004", ForecastResponse);
    expect(forecastReadout(calm, "en", en).note).toBe(en.overview.noNegative);
  });
});

describe("forecast chart", () => {
  it("forecast lines are dashed between points", () => {
    // C8: four values, so neither series is drawn as a solid line, and the two keep different patterns.
    const forecast = fixture("forecast_10001", ForecastResponse);
    const { container } = render(<ForecastCard data={forecast} locale="en" m={en} />);
    const dashes = [...container.querySelectorAll("polyline")].map((p) => p.getAttribute("stroke-dasharray"));
    expect(dashes).toHaveLength(2);
    for (const d of dashes) expect(d).toBeTruthy();
    expect(new Set(dashes).size).toBe(2);
    expect(container.querySelector("[data-points-note]")!.textContent).toBe(en.forecast.pointsNote);
    for (const m of [en, ar]) expect(m.forecast.pointsNote).not.toMatch(/[0-9٠-٩]/);
  });
});
