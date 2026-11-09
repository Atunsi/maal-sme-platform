// R4 (DECISIONS 45): every element with a click handler has a keyboard path. Clicks live on buttons and links;
// a non-interactive element may carry one only when the same action sits on a button inside it, named here.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewBoard } from "@/components/ReviewBoard";
import { AnomalyResponse } from "@/lib/schemas";
import { en, fixture, webRoot } from "./helpers";

/** file: tag, and the button inside that does the same thing. */
const ALLOWED: Record<string, { tag: string; reason: string }[]> = {
  "components/ReviewBoard.tsx": [{ tag: "tr", reason: "the date cell's button picks the same row (B8)" }],
};

function tsxFiles(): string[] {
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

describe("keyboard paths", () => {
  it("every click handler has a keyboard path", () => {
    const found: string[] = [];
    for (const path of tsxFiles()) {
      const file = relative(webRoot, path).replaceAll("\\", "/");
      const code = readFileSync(path, "utf8");
      // Opening tags of non-interactive elements, across lines, that carry onClick.
      for (const [, tag] of code.matchAll(/<(tr|td|th|div|span|li|ul|section|article|p|img|svg|g|rect)\b[^>]*?\bonClick=/gs)) {
        if (!(ALLOWED[file] ?? []).some((a) => a.tag === tag)) found.push(`${file}: <${tag}> has onClick`);
      }
    }
    expect(found).toEqual([]);
  });

  it("review rows carry a button that picks the same row", () => {
    const anomaly = fixture("anomaly_10001", AnomalyResponse).anomaly!;
    if (anomaly.status !== "computed") throw new Error("10001 anomaly fixture did not compute");
    const { container } = render(<ReviewBoard a={anomaly} locale="en" labels={en} />);
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(anomaly.flags.length);
    for (const row of rows) expect(within(row as HTMLElement).getAllByRole("button")).toHaveLength(1);
    const button = within(rows[0] as HTMLElement).getByRole("button");
    expect(button.getAttribute("aria-label")).toContain(en.enums.flag_reason[anomaly.flags[0]!.flag_reason]);
    fireEvent.click(button);
    expect(rows[0]!.getAttribute("data-picked")).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });
});
