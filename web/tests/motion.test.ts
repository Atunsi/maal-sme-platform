// R6 (DECISIONS 45, M1): outside the landing page and sign-in, no entrance delay is longer than 0.4 s and no
// entrance runs longer than 0.6 s. Inline delays come from lib/motion.ts delay(); CSS keeps its own caps.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAY_STEP_MS } from "@/components/ScenarioPlayer";
import { delay } from "@/lib/motion";
import { webRoot } from "./helpers";

/** The two pages that keep their full sequence, and the form only the sign-in page uses. */
const FULL = ["app/[locale]/page.tsx", "app/[locale]/sign-in/page.tsx", "components/SignInForm.tsx"];

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
  return files.map((f) => relative(webRoot, f).replaceAll("\\", "/"));
}

const seconds = (t: string) => (t.endsWith("ms") ? Number.parseFloat(t) / 1000 : Number.parseFloat(t));

describe("motion", () => {
  it("entrance motion stays under the cap", () => {
    expect(delay(-1)).toBe("var(--d-0)");
    expect(delay(9)).toBe("var(--d-4)");

    const offenders: string[] = [];
    for (const file of tsxFiles().filter((f) => !FULL.includes(f))) {
      const code = readFileSync(join(webRoot, file), "utf8");
      if (/animationDuration/.test(code)) offenders.push(`${file}: inline animationDuration`);
      for (const [, value] of code.matchAll(/animationDelay:\s*(.+)$/gm)) {
        const v = value!.trim();
        // delay(step), a variable holding one, Flow's landing-only branch beside a delay() fallback, or the
        // flow dots' offset, which staggers a looping animation and is not an entrance.
        const flow = file === "components/Flow.tsx";
        const ok = v.startsWith("delay(") || v.startsWith("entrance") || (flow && /^full \?.*: delay\(/.test(v)) || (flow && v.startsWith("`${(i * 0.6)"));
        if (!ok) offenders.push(`${file}: animationDelay ${v}`);
      }
    }
    expect(offenders).toEqual([]);

    // CSS: every non-looping animation outside the full-motion rules fits the cap.
    const css = readFileSync(join(webRoot, "app", "globals.css"), "utf8");
    const steps = [...css.matchAll(/--d-(\d):\s*([\d.]+)s/g)].map(([, n, s]) => [Number(n), Number(s)]);
    expect(steps).toEqual([[0, 0], [1, 0.1], [2, 0.2], [3, 0.3], [4, 0.4]]);
    // Play all's step timer (I4) fills over the 8 s step; it is a timer, not an entrance, and is checked below.
    const TIMERS = [".play-progress-fill"];
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => !selector!.includes('data-motion="full"') && !TIMERS.includes(selector!.trim()));
    const over: string[] = [];
    for (const [, selector, body] of rules) {
      for (const [, decl] of body!.matchAll(/animation:\s*([^;]+);/g)) {
        if (/infinite|none/.test(decl!)) continue; // looping motion is not an entrance
        const times = [...decl!.matchAll(/([\d.]+m?s)\b/g)].map(([t]) => seconds(t!));
        if ((times[0] ?? 0) > 0.6 || (times[1] ?? 0) > 0.4) over.push(`${selector!.trim()}: ${decl}`);
      }
      for (const [, t] of body!.matchAll(/animation-delay:\s*([\d.]+m?s)/g)) if (seconds(t!) > 0.4) over.push(`${selector!.trim()}: delay ${t}`);
    }
    expect(over).toEqual([]);
    expect(css).toMatch(new RegExp(`\.play-progress-fill \{[^}]*animation: growx ${PLAY_STEP_MS / 1000}s linear both`));
  });
});
