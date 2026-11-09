// Guards from the redesign (DECISIONS 42): every visual is computed from the response at render time,
// and no figure from the mockups reached the code.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnomalyCard } from "@/components/AnomalyCard";
import { CreditCard } from "@/components/CreditCard";
import { ForecastCard } from "@/components/ForecastCard";
import { creditReadout, forecastReadout, reviewReadout, shariaReadout, zakatReadout } from "@/components/Readouts";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { DEMO_PASSWORD, SignInForm } from "@/components/SignInForm";
import { VerdictSheet } from "@/components/VerdictSheet";
import { ZakatCard } from "@/components/ZakatCard";
import { DEMO_BUSINESSES } from "@/lib/businesses";
import { scenarioName } from "@/lib/scenario-label";
import { AnomalyResponse, CreditResponse, ForecastResponse, ScenarioObject, ZakatResponse } from "@/lib/schemas";
import { ar, en, fixture, readJson, webRoot } from "./helpers";

const source = (dir: string) =>
  readdirSync(join(webRoot, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith("logoPaths.ts"))
    .map((file) => [file, readFileSync(join(webRoot, dir, file), "utf8")] as const);
const allSource = [...source("app"), ...source("components"), ...source("lib")];
const scenario = (name: string) => ScenarioObject.parse(readJson("scenarios-data", `${name}.json`));
const percent = (css: string) => Number.parseFloat(css);

describe("no figure from the mockups", () => {
  it.each(["47,000", "47000", "5,963", "638,310", "399,779", "238,530", "33,019", "76,711", "51,092", "0.346", "0.055732", "73738c1695f1", "10 of 10", "2,650"])(
    "%s appears in no source file",
    (figure) => {
      expect(allSource.filter(([, text]) => text.includes(figure)).map(([file]) => file)).toEqual([]);
    },
  );

  it("the five demo IDs live in one constant and nowhere else", () => {
    expect([...DEMO_BUSINESSES].sort()).toEqual([10001, 10003, 10004, 10037, 10040]);
    const holders = allSource.filter(([, text]) => /\b(10004|10037|10040)\b/.test(text)).map(([file]) => file.replaceAll("\\", "/"));
    expect(holders).toEqual(["businesses.ts"]);
  });

  it("no hash-derived visual pattern exists", () => {
    const patterned = allSource.filter(([, text]) => /seal|fingerprint|parseInt\(hex/i.test(text)).map(([file]) => file);
    expect(patterned).toEqual([]);
  });
});

describe("credit factors", () => {
  const credit = fixture("credit_10001", CreditResponse);
  const view = () => render(<CreditCard data={credit} initialView="public" locale="en" m={en} />);

  it("U4 each factor renders the API's text word for word", () => {
    view();
    for (const line of credit.credit_explanation!.public_tier) expect(screen.getByText(line.text)).toBeTruthy();
  });

  it("bar length comes from the magnitude word alone", () => {
    const { container } = view();
    const widths = [...container.querySelectorAll<HTMLElement>("section[aria-label=Factors] .bar-grow")].map((bar) => bar.style.width);
    expect(widths.length).toBe(credit.credit_explanation!.public_tier.length);
    expect(new Set(widths).size).toBe(1); // all three lines of 10001 say "strongly"
  });

  it("an against line sits on the other side of the axis from a supports line", () => {
    const { container } = view();
    const rows = [...container.querySelectorAll("section[aria-label=Factors] .grid.min-h-\\[88px\\]")];
    const sideOf = (row: Element) => (row.children[0]!.textContent ? "first" : "second");
    const lines = credit.credit_explanation!.public_tier;
    expect(rows.map(sideOf)).toEqual(lines.map((line) => (line.direction === "against" ? "first" : "second")));
  });
});

describe("zakat visuals", () => {
  const zakat = fixture("zakat_10001", ZakatResponse);

  it("the waterfall and the nisab marker take their scale from the response", () => {
    const body = zakat.zakat!;
    const { container } = render(<ZakatCard data={zakat} locale="en" m={en} />);
    const bars = [...container.querySelectorAll<HTMLElement>("[role=img] .fill-bar")];
    expect(percent(bars[0]!.style.width)).toBe(100); // assets are the largest value on this scale
    expect(percent(bars[2]!.style.width)).toBeCloseTo((body.zakat_base_sar! / body.zakatable_assets_sar!) * 100, 2);
  });

  it("a different response draws a different waterfall", () => {
    const body = { ...zakat.zakat!, zakatable_assets_sar: 100000, deductible_liabilities_sar: 75000, zakat_base_sar: 25000 };
    const { container } = render(<ZakatCard data={{ ...zakat, zakat: body }} locale="en" m={en} />);
    expect(percent([...container.querySelectorAll<HTMLElement>("[role=img] .fill-bar")][2]!.style.width)).toBe(25);
  });

  it("every visual has a text alternative built from the same values", () => {
    render(<ZakatCard data={zakat} locale="en" m={en} />);
    const [waterfall, hawl] = screen.getAllByRole("img");
    expect(waterfall!.getAttribute("aria-label")).toContain("638,310.41");
    expect(waterfall!.getAttribute("aria-label")).toContain("34,000.00");
    expect(hawl!.getAttribute("aria-label")).toContain("2025");
  });

  it("the snapshot marker is placed by date between hawl start and completion", () => {
    const { container } = render(<ZakatCard data={zakat} locale="en" m={en} />);
    const body = zakat.zakat!;
    const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
    const expected = (day(body.snapshot_month_end!) - day(body.hawl_start_date!)) / (day(body.hawl_completion_date!) - day(body.hawl_start_date!));
    const marker = container.querySelector<HTMLElement>(".border-\\[3px\\]")!;
    expect(percent(marker.style.left)).toBeCloseTo(expected * 100, 2);
  });

  it("Not a ZATCA assessment is stated", () => {
    render(<ZakatCard data={zakat} locale="en" m={en} />);
    expect(screen.getByText(en.zakat.asReturned).textContent).toContain("Not a ZATCA assessment");
  });
});

describe("forecast chart", () => {
  const forecast = fixture("forecast_10001", ForecastResponse);
  type Computed = Extract<NonNullable<typeof forecast.forecast>, { status: "computed" }>;
  const body = forecast.forecast as Computed;
  const lines = (data: typeof forecast) => {
    const { container, unmount } = render(<ForecastCard data={data} locale="en" m={en} />);
    const points = [...container.querySelectorAll("polyline")].map((line) => line.getAttribute("points"));
    unmount();
    return points;
  };

  it("draws the model and the naive baseline from today to the last horizon", () => {
    const [model, baseline] = lines(forecast);
    expect(model!.split(" ")).toHaveLength(body.model.length + 1);
    expect(baseline!.split(" ")).toHaveLength(body.naive_baseline.length + 1);
  });

  it("a different response draws different lines", () => {
    const changed = { ...body, model: body.model.map((row) => ({ ...row, projected_balance_sar: row.projected_balance_sar * 3 })) };
    expect(lines({ ...forecast, forecast: changed })).not.toEqual(lines(forecast));
  });

  it("the cash floor is labelled at SAR 0", () => {
    const { container } = render(<ForecastCard data={forecast} locale="en" m={en} />);
    expect(container.textContent).toContain("the cash floor");
  });
});

describe("review board", () => {
  const anomaly = fixture("anomaly_10001", AnomalyResponse);
  type Computed = Extract<NonNullable<typeof anomaly.anomaly>, { status: "computed" }>;
  const body = anomaly.anomaly as Computed;

  it("one mark per queued transaction, placed by date in the scan window", () => {
    const { container } = render(<AnomalyCard data={anomaly} locale="en" m={en} />);
    const marks = [...container.querySelectorAll<HTMLElement>(".tick")];
    expect(marks).toHaveLength(body.flags.length);
    const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
    const span = day(body.scan_window.to) - day(body.scan_window.from);
    marks.forEach((mark, i) => {
      expect(percent(mark.style.left)).toBeCloseTo(((day(body.flags[i]!.date) - day(body.scan_window.from)) / span) * 100, 2);
    });
  });

  it("clicking a mark highlights its row, and clicking a row highlights its mark", () => {
    const { container } = render(<AnomalyCard data={anomaly} locale="en" m={en} />);
    const marks = [...container.querySelectorAll("button.tick")];
    const rows = [...container.querySelectorAll("tbody tr")];
    fireEvent.click(marks[2]!);
    expect(rows[2]!.getAttribute("data-picked")).toBe("true");
    expect(marks[2]!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(rows[4]!);
    expect(marks[4]!.getAttribute("aria-pressed")).toBe("true");
    expect(rows[2]!.getAttribute("data-picked")).toBe("false");
  });

  it("U8 a mark names its reason and carries no score", () => {
    render(<AnomalyCard data={anomaly} locale="en" m={en} />);
    const marks = screen.getAllByRole("button");
    expect(marks.every((mark) => !/fraud|score/i.test(mark.getAttribute("aria-label") ?? ""))).toBe(true);
  });

  it("the count shows no cap, because no response carries one", () => {
    const { container } = render(<AnomalyCard data={anomaly} locale="en" m={en} />);
    expect(container.textContent).not.toMatch(/\d+ of \d+/);
  });
});

describe("scenario diff sheet", () => {
  const baseline = scenario("baseline");
  const plates = (name: string) => {
    const { container, unmount } = render(<ScenarioCompare baseline={baseline} chosen={scenario(name)} locale="en" m={en} />);
    const rows = [...container.querySelectorAll("tbody tr")].map((row) => row.querySelector("th")!.textContent);
    unmount();
    return rows;
  };

  it("the baseline against itself is the same on every row", () => {
    expect(plates("baseline").every((row) => row!.startsWith(en.scenarios.same))).toBe(true);
  });

  it("Changed and Same are computed by comparing the two objects", () => {
    const rows = plates("severe_collapse");
    expect(rows.find((row) => row!.endsWith(en.credit.decision))).toContain(en.scenarios.changed);
    expect(rows.find((row) => row!.endsWith(en.sharia.title))).toContain(en.scenarios.same);
  });

  it("a scenario label splits on its separator and loses no word", () => {
    for (const name of ["baseline", "severe_collapse", "thin_file_newcomer"]) {
      const { label } = scenario(name).scenario;
      const { name: head, detail } = scenarioName(label);
      expect(`${head} ${detail}`.toLowerCase()).toBe(label.replace(" — ", " ").toLowerCase());
      expect(`${head}${detail}`).not.toContain("—");
    }
  });
});

describe("overview", () => {
  const credit = fixture("credit_10001", CreditResponse);

  it("U1 U2 the verdict sheet states the fixed markup and the charity-directed late payments", () => {
    render(<VerdictSheet data={credit} locale="en" m={en} />);
    expect(screen.getByText(en.overview.markupLabel)).toBeTruthy();
    expect(screen.getByText(en.overview.lateValue)).toBeTruthy();
  });

  it("U13 the receipt panel is plain text with the scope verbatim", () => {
    const { container } = render(<VerdictSheet data={credit} locale="en" m={en} />);
    expect(screen.getByText(en.overview.receiptTitle)).toBeTruthy();
    expect(screen.getByText(credit.receipt.output_sha256.slice(0, 12))).toBeTruthy();
    expect(screen.getByText(credit.receipt.scope!)).toBeTruthy();
    expect(within(container).queryByRole("img")).toBeNull();
  });

  it("U10 insufficient_data (10003): the sheet refuses and no card shows a figure", () => {
    const refused = fixture("credit_10003", CreditResponse);
    render(<VerdictSheet data={refused} locale="en" m={en} />);
    expect(screen.getByText(en.refusal.body)).toBeTruthy();
    const zakat = zakatReadout(fixture("zakat_10003", ZakatResponse), "en", en);
    const forecast = forecastReadout(fixture("forecast_10003", ForecastResponse), "en", en);
    const review = reviewReadout(fixture("anomaly_10003", AnomalyResponse), "en", en);
    for (const card of [creditReadout(refused, "en", en), zakat, forecast, review]) {
      expect(card.state).toBe(en.refusal.title);
      expect(card.figure).toBe(en.common.dash);
    }
  });

  it("U10 partial_profile (10040): the sheet names the unavailable features", () => {
    const partial = fixture("credit_10040", CreditResponse);
    render(<VerdictSheet data={partial} locale="en" m={en} />);
    expect(screen.getByText(en.enums.status.partial_profile)).toBeTruthy();
    for (const feature of partial.partial_profile_unavailable_features!) expect(screen.getByText(feature)).toBeTruthy();
  });

  it("U6 the Sharia card always carries the fixed label", () => {
    expect(shariaReadout(credit, "en", en).note).toBe(en.sharia.label);
  });

  it("U7 the Zakat card carries the placeholder line", () => {
    expect(zakatReadout(fixture("zakat_10001", ZakatResponse), "en", en).note).toBe(en.zakat.nisabStatus.placeholder_unverified);
  });
});

describe("demo sign-in", () => {
  it("U15 the page's text says what it is, in both languages", () => {
    expect(en.signIn.demo).toBe("Demo sign-in. No accounts exist. The password is checked in this browser only, and nothing you type is saved or sent.");
    expect(ar.signIn.demo).toContain("تجريبي");
  });

  it("U15 no field has a name, and the form sends and stores nothing", () => {
    const { container } = render(<SignInForm locale="en" s={en.signIn} />);
    const fields = [...container.querySelectorAll("input")];
    expect(fields.length).toBeGreaterThan(1);
    for (const field of fields) expect(field.getAttribute("name")).toBeNull();
    const code = readFileSync(join(webRoot, "components", "SignInForm.tsx"), "utf8");
    expect(code).not.toMatch(/FormData|fetch\(|localStorage|sessionStorage|document\.cookie/);
    // The password is the only field the form reads.
    expect(code.match(/\.value\b/g)).toHaveLength(1);
  });

  it("U15 the demo password is pass, and the username is not checked as an email", () => {
    expect(DEMO_PASSWORD).toBe("pass");
    render(<SignInForm locale="en" s={en.signIn} />);
    fireEvent.click(screen.getByRole("button", { name: /Admin/ }));
    expect(screen.getByLabelText("Username").getAttribute("type")).toBe("text");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    expect(screen.getByRole("alert").textContent).toBe(en.signIn.wrongPassword);
    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
  });

  it("U11 landing, sign-in and admin say synthetic data in their body copy", () => {
    expect(en.landing.lead).toContain("synthetic data");
    expect(en.signIn.synthetic).toContain("synthetic data");
    expect(en.admin.eyebrow).toContain("synthetic data");
    expect(en.footer.scope).toContain("Synthetic data only. Population: serving.");
    expect(ar.footer.scope).toContain("بيانات اصطناعية فقط. المجموعة: الخدمة.");
  });
});
