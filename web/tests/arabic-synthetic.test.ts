// MO9 (DECISIONS 61): Arabic never calls the data «اصطناعية». The word for synthetic data is «مصطنعة»;
// «اصطناعي» stays only inside «ذكاء اصطناعي» and «الذكاء الاصطناعي» (artificial intelligence).
// The browser check is in e2e/polish.spec.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webRoot } from "./helpers";

const FILES = ["messages/ar.json", "lib/tour.ts", "lib/glossary.ts", "lib/howItWorks.ts"];
const AI = /(?:ال)?ذكاء (?:ال)?اصطناعي/g;

describe("the Arabic word for synthetic data", () => {
  it("arabic synthetic is not اصطناعية", () => {
    const left: string[] = [];
    for (const file of FILES) {
      const lines = readFileSync(join(webRoot, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.replace(AI, "").includes("اصطناعي")) left.push(`${file}:${i + 1}`);
      });
    }
    expect(left).toEqual([]);
  });

  it("the catalogue names the data source مصطنعة", () => {
    const ar = JSON.parse(readFileSync(join(webRoot, "messages/ar.json"), "utf8"));
    expect(ar.enums.data_source.synthetic).toBe("مصطنعة");
    expect(ar.footer.scope).toContain("بيانات مصطنعة فقط.");
  });
});
