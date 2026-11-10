import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Serious and critical WCAG 2.1 A and AA violations on the page as it stands (U14). */
export async function expectAxeClean(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}
