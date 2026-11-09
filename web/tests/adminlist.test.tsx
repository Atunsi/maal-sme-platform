// E10: the searchable admin list over GET /businesses. DECISIONS 43.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllBusinesses, PAGE_SIZE } from "@/components/AllBusinesses";
import { BusinessSearch } from "@/components/BusinessSearch";
import { BusinessesResponse } from "@/lib/schemas";
import { nameOf } from "@/lib/business-names";
import { en, fixture } from "./helpers";

const page1 = fixture("businesses_page1", BusinessesResponse);
const list = async (page: number, data = page1) =>
  render(await AllBusinesses({ result: Promise.resolve({ ok: true, data }), locale: "en", m: en, query: "?as=admin", links: (n) => `/en/admin?page=${n}`, page }));

describe("admin list", () => {
  it("admin list shows serving population, with the total from the response", async () => {
    const { container } = await list(1);
    expect(page1.population).toBe("serving");
    expect(container.textContent).toContain(`${page1.total} serving businesses`);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(page1.businesses.length);
    expect(screen.getByRole("link", { name: `Open ${nameOf(page1.businesses[0]!.business_id, "en")}` }).getAttribute("href")).toBe(`/en/business/${page1.businesses[0]!.business_id}?as=admin`);
  });

  it("admin list pages through businesses", async () => {
    const pages = Math.ceil(page1.total / PAGE_SIZE);
    const first = await list(1);
    expect(screen.queryByRole("link", { name: en.admin.prev })).toBeNull();
    expect(screen.getByRole("link", { name: en.admin.next }).getAttribute("href")).toBe("/en/admin?page=2");
    expect(screen.getByText(`Page 1 of ${pages}`)).toBeTruthy();
    first.unmount();
    await list(2);
    expect(screen.getByRole("link", { name: en.admin.prev }).getAttribute("href")).toBe("/en/admin?page=1");
  });

  it("an empty result says so", async () => {
    await list(1, { ...page1, total: 0, businesses: [] });
    expect(screen.getByText(en.admin.none)).toBeTruthy();
  });

  it("admin search and sector filter are a plain GET form that keeps the role", () => {
    const { container } = render(
      <BusinessSearch
        locale="en"
        role="admin"
        q="1002"
        sector="construction"
        sectors={Object.entries(en.enums.sector).map(([value, label]) => ({ value, label }))}
        labels={{ search: en.admin.search, searchLabel: en.admin.searchLabel, searchHelp: en.admin.searchHelp, sectorLabel: en.admin.sectorLabel, anySector: en.admin.anySector, clear: en.admin.clear }}
      />,
    );
    const form = container.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/en/admin");
    expect((container.querySelector("input[name=as]") as HTMLInputElement).value).toBe("admin");
    expect((screen.getByLabelText(new RegExp(`^${en.admin.searchLabel}`)) as HTMLInputElement).value).toBe("1002");
    expect((screen.getByLabelText(en.admin.sectorLabel) as HTMLSelectElement).value).toBe("construction");
    expect(container.querySelectorAll("option")).toHaveLength(Object.keys(en.enums.sector).length + 1);
  });
});
