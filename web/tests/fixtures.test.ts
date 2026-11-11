import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import {
  AnomalyResponse,
  BusinessesResponse,
  CreditResponse,
  ForecastResponse,
  HistoryResponse,
  ProfileResponse,
  ScenarioCatalog,
  ScenarioObject,
  ZakatResponse,
} from "@/lib/schemas";

const dir = join(__dirname, "..", "fixtures");
const SCHEMAS: Record<string, ZodType> = {
  credit: CreditResponse,
  forecast: ForecastResponse,
  anomaly: AnomalyResponse,
  zakat: ZakatResponse,
  profile: ProfileResponse,
  // DECISIONS 44 routes (E10, E12)
  businesses: BusinessesResponse,
  scenarios: ScenarioCatalog,
  custom: ScenarioObject,
  // DECISIONS 62 (IN3): GET /insights/history
  history: HistoryResponse,
};

describe("fixtures parse", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("covers 34 captured (25 lens, 4 from the DECISIONS 44 routes, 5 history) and 5 synthetic-state fixtures", () => {
    expect(files.filter((f) => f.includes("_synthetic_state"))).toHaveLength(5);
    expect(files.filter((f) => !f.includes("_synthetic_state") && !f.startsWith("history_"))).toHaveLength(29);
    expect(files.filter((f) => f.startsWith("history_"))).toHaveLength(5); // 4, 3, 2 and 0 dates, and one refusal
  });

  it.each(files)("%s", (file) => {
    const schema = SCHEMAS[file.split("_")[0]!]!;
    const result = schema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});
