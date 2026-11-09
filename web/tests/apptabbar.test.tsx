// The app variant's bottom tab bar (lib/app-mode.ts).
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTabBar } from "@/components/AppTabBar";
import { APP_BOOT } from "@/lib/app-mode";
import { ar, en } from "./helpers";

const nav = { params: new URLSearchParams(), pathname: "/en/business/10001" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
  usePathname: () => nav.pathname,
}));

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
  sessionStorage.clear();
});

describe("app tab bar", () => {
  it("links four business pages, keeps the role, and marks the current one", () => {
    nav.pathname = "/en/business/10037/forecast";
    nav.params = new URLSearchParams("as=owner");
    render(<AppTabBar locale="en" nav={en.nav} />);
    const bar = screen.getByRole("navigation", { name: en.nav.appTabs });
    const links = [...bar.querySelectorAll(".app-tabs a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/en/business/10037?as=owner", "/en/business/10037/credit?as=owner", "/en/business/10037/forecast?as=owner", "/en/business/10037/review?as=owner"]);
    expect(screen.getByRole("link", { name: en.nav.forecast }).getAttribute("aria-current")).toBe("page");
  });

  it("More opens the other pages and closes on Escape", () => {
    nav.pathname = "/ar/business/10001/zakat";
    nav.params = new URLSearchParams("as=admin");
    render(<AppTabBar locale="ar" nav={ar.nav} />);
    const more = screen.getByRole("button", { name: ar.nav.more });
    // Zakat lives under More, so More carries the current mark.
    expect(more.hasAttribute("data-current")).toBe(true);
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    for (const label of [ar.nav.sharia, ar.nav.zakat, ar.nav.scenarios, ar.nav.admin]) expect(screen.getByRole("link", { name: label })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows nothing off the business pages or on the printable sheet", () => {
    for (const path of ["/en", "/en/scenarios", "/en/admin", "/en/business/10001/sheet"]) {
      nav.pathname = path;
      const { container, unmount } = render(<AppTabBar locale="en" nav={en.nav} />);
      expect(container.innerHTML, path).toBe("");
      unmount();
    }
  });
});

describe("app mode boot", () => {
  const boot = (search: string) => {
    window.history.replaceState(null, "", `/en${search}`);
    document.documentElement.className = "";
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
    new Function(APP_BOOT)();
    return document.documentElement.classList.contains("app-mode");
  };

  it("?app=1 previews the app for the tab, ?app=0 turns it off, and a plain visit is the website", () => {
    expect(boot("")).toBe(false);
    expect(boot("?app=1")).toBe(true);
    expect(boot("")).toBe(true);
    expect(boot("?app=0")).toBe(false);
    expect(boot("")).toBe(false);
  });
});
