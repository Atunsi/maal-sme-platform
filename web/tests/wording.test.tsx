// Guard 5 (U1, U2, U8, U9): forbidden wording, forbidden fields and forbidden inputs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnomalyCard } from "@/components/AnomalyCard";
import { CreditCard } from "@/components/CreditCard";
import { ProfilePanel } from "@/components/ProfilePanel";
import { AnomalyFlag, AnomalyResponse, Credit, CreditResponse, ProfileResponse } from "@/lib/schemas";
import { ar, en, fixture, readJson, webRoot } from "./helpers";

const FORBIDDEN = /fraud|score/i;

describe("anomaly wording", () => {
  const data = fixture("anomaly_10001", AnomalyResponse);

  it("U8 the flags table never says fraud or score", () => {
    const { container } = render(<AnomalyCard data={data} locale="en" m={en} />);
    expect(container.querySelector("table")!.textContent).not.toMatch(FORBIDDEN);
  });

  it("U8 no UI text on the card says fraud or score", () => {
    // The backend's method string is shown verbatim and does say scores are withheld (§29).
    const { container } = render(<AnomalyCard data={data} locale="en" m={en} />);
    const anomaly = data.anomaly as Extract<typeof data.anomaly, { status: "computed" }>;
    const scope = data.receipt.scope!;
    const text = container.textContent!.replace(anomaly.method, "").replace(scope, "");
    expect(text).not.toMatch(FORBIDDEN);
  });

  it("U8 the catalogue's flag reasons and anomaly text avoid the words, in both languages", () => {
    for (const m of [en, ar]) {
      expect(JSON.stringify({ a: m.anomaly, r: m.enums.flag_reason })).not.toMatch(/fraud|score|احتيال/i);
    }
  });

  it("U8 frames the list as a review queue", () => {
    render(<AnomalyCard data={data} locale="en" m={en} />);
    expect(screen.getByText(en.anomaly.queue)).toBeTruthy();
  });

  it("U8 a flag carrying a score fails the schema", () => {
    const flag = { ...(data.anomaly as { flags: object[] }).flags[0], anomaly_score: 0.9 };
    expect(AnomalyFlag.safeParse(flag).success).toBe(false);
  });
});

describe("credit contract guards", () => {
  const credit = readJson("fixtures", "credit_10001.json") as { credit: Record<string, unknown> };

  it("U1 a stressed markup field fails the schema", () => {
    expect(Credit.safeParse({ ...credit.credit, stressed_markup_pct: 9 }).success).toBe(false);
  });

  it("U1 a markup not fixed at inception fails the schema", () => {
    expect(Credit.safeParse({ ...credit.credit, markup_fixed_at_inception: false }).success).toBe(false);
  });

  it("U2 any other late-penalty policy fails the schema", () => {
    expect(Credit.safeParse({ ...credit.credit, late_penalty_policy: "retained" }).success).toBe(false);
  });

  it("U1 the credit card has no input of any kind", () => {
    const { container } = render(
      <CreditCard data={fixture("credit_10001", CreditResponse)} initialView="public" locale="en" m={en} />,
    );
    expect(container.querySelector("input, select, textarea, [role=slider]")).toBeNull();
  });

  it("U1 the only input in the app is the business picker", () => {
    const withInput = readdirSync(join(webRoot, "components"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => /<(input|select|textarea)\b/.test(readFileSync(join(webRoot, "components", file), "utf8")));
    // Named allowlist, never a general relaxation. The sign-in is U15 as amended; its fields feed nothing.
    // CopyButton's only input is a read-only fallback holding a hash; HashCheck compares a pasted hash in the
    // browser (E4, DECISIONS 43). BusinessSearch searches the admin list (E10). CustomScenarioForm takes only
    // the API's shock parameters, each bounded; tests/custom.test.tsx checks its input names (E12). None of
    // them can reach a term. DECISIONS 45: ScenarioControls' phone select (I4) picks one of the library's
    // fixed scenarios and only navigates to its page, so it cannot reach a term either. BusinessSwitcher (I1,
    // 1a.9) takes digits of a business ID, searches serving IDs and opens that business: it names a business,
    // never a term. CustomScenarioForm's range sliders (I5, 1a.9) edit the same bounded shock values as its
    // number fields, so they reach no term either. CommandPalette (I8, 1a.9) matches typed text against fixed
    // lists of pages, scenarios, glossary terms and serving IDs, and only navigates.
    expect(withInput.sort()).toEqual([
      "BusinessPicker.tsx",
      "BusinessSearch.tsx",
      "BusinessSwitcher.tsx",
      "CommandPalette.tsx",
      "CopyButton.tsx",
      "CustomScenarioForm.tsx",
      "HashCheck.tsx",
      "ScenarioControls.tsx",
      "SignInForm.tsx",
    ]);
  });
});

describe("no peer benchmarking", () => {
  it("U9 features 55-59 appear as raw names, with no comparison wording", () => {
    const { container } = render(<ProfilePanel data={fixture("profile_10001", ProfileResponse)} m={en} />);
    expect(container.textContent).toContain("sector_relative_volatility_z");
    expect(container.textContent).not.toMatch(/peer|sector average|vs\.? sector|compared (to|with)/i);
  });

  it("U9 neither catalogue offers a peer comparison", () => {
    expect(JSON.stringify(en)).not.toMatch(/peer|sector average/i);
    expect(JSON.stringify(ar)).not.toMatch(/الأقران|متوسط القطاع/);
  });
});
