// Finding a business by name or ID: the admin's "Find a business" box and the search dialog share this.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessPicker } from "@/components/BusinessPicker";
import { paletteMatches } from "@/components/CommandPalette";
import { businessName, findBusinesses, nameOf } from "@/lib/business-names";
import { SERVING_IDS } from "@/lib/population";
import { en } from "./helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("findBusinesses", () => {
  it("digits match the start of the ID, in order", () => {
    expect(findBusinesses("1000", SERVING_IDS, 3)).toEqual([10001, 10002, 10003]);
    expect(findBusinesses("10037", SERVING_IDS)).toEqual([10037]);
    expect(findBusinesses("9999", SERVING_IDS)).toEqual([]);
  });

  it("words match the name in either language, ignoring case, accents and apostrophes", () => {
    const sidrah = businessName(10001);
    expect(findBusinesses(sidrah.en.toUpperCase(), SERVING_IDS)).toContain(10001);
    expect(findBusinesses(sidrah.ar, SERVING_IDS)).toContain(10001);
    // Every word must be found, so a second word narrows the list.
    const najd = findBusinesses("najd", SERVING_IDS, 1000);
    expect(najd.length).toBeGreaterThan(1);
    expect(najd.every((id) => nameOf(id, "en").toLowerCase().includes("najd"))).toBe(true);
    expect(findBusinesses("sidrah najd", SERVING_IDS, 1000)).toEqual([10001]);
    // The Arabic letters people type either way: a plain alef finds a hamza alef.
    const hamza = SERVING_IDS.find((id) => nameOf(id, "ar").includes("أ"))!;
    expect(findBusinesses(nameOf(hamza, "ar").replace(/أ/g, "ا"), SERVING_IDS, 1000)).toContain(hamza);
  });

  it("finds only among the IDs it is given, and nothing for one letter or no match", () => {
    expect(findBusinesses("najd", [10004, 10037])).toEqual([]);
    expect(findBusinesses("n", SERVING_IDS)).toEqual([]);
    expect(findBusinesses("abc", SERVING_IDS)).toEqual([]);
  });
});

describe("search dialog", () => {
  it("lists businesses by name after the pages and terms, within the given IDs", () => {
    const items = [{ id: "page-credit", label: "Credit", group: "Page", href: "/en/business/10001/credit" }];
    const found = paletteMatches(items, "sudair", "en", en, null);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((item) => item.id.startsWith("business-"))).toBe(true);
    expect(found[0]!.label).toBe(`Open ${nameOf(10004, "en")} (10004)`);
    // The online snapshot holds a few businesses: an ID it lacks is not offered.
    expect(paletteMatches(items, "10500", "en", en, null, [10001, 10004])).toEqual([]);
  });
});

describe("Find a business", () => {
  const labels = { input: en.picker.inputLabel, results: en.picker.results, submit: en.picker.submit, invalid: "none" };

  it("shows matches as you type and opens the one picked, keeping the role", () => {
    push.mockClear();
    render(<BusinessPicker locale="en" query="?as=admin" labels={labels} />);
    const box = screen.getByRole("combobox", { name: en.picker.inputLabel });
    fireEvent.change(box, { target: { value: "sidrah najd" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    fireEvent.mouseDown(options[0]!);
    expect(push).toHaveBeenCalledWith("/en/business/10001?as=admin", { transitionTypes: ["page"] }); // MT1: a page transition
  });

  it("opens a full ID, and says so before any call when nothing matches", () => {
    push.mockClear();
    render(<BusinessPicker locale="en" ids={[10001, 10004]} labels={labels} />);
    const box = screen.getByRole("combobox", { name: en.picker.inputLabel });
    fireEvent.change(box, { target: { value: "10500" } });
    fireEvent.click(screen.getByRole("button", { name: en.picker.submit }));
    expect(screen.getByRole("alert").textContent).toBe("none");
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "10004" } });
    fireEvent.click(screen.getByRole("button", { name: en.picker.submit }));
    expect(push).toHaveBeenCalledWith("/en/business/10004", { transitionTypes: ["page"] });
  });
});

describe("links keep the demo role", () => {
  it("withRole adds the page's ?as= to a link that has none, keeping the rest of the link", async () => {
    const { withRole } = await import("@/components/RoleLink");
    expect(withRole("/en/business/10004", "admin")).toBe("/en/business/10004?as=admin");
    expect(withRole("/en/business/10001?tour=verdict", "admin")).toBe("/en/business/10001?tour=verdict&as=admin");
    // A role the server already wrote stays.
    expect(withRole("/en/business/10001?tour=verdict&as=owner", "admin")).toBe("/en/business/10001?tour=verdict&as=owner");
    expect(withRole("/en/business/10001", null)).toBe("/en/business/10001");
    expect(withRole("/en/glossary#hawl", "owner")).toBe("/en/glossary?as=owner#hawl");
    expect(withRole("/en/business/10001", "root")).toBe("/en/business/10001"); // only the two demo roles
  });
});
