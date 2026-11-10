import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import {
  AnomalyResponse,
  BusinessesResponse,
  CreditResponse,
  ForecastResponse,
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
};

describe("fixtures parse", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("covers 29 captured (25 lens, 4 from the DECISIONS 44 routes) and 5 synthetic-state fixtures", () => {
    expect(files.filter((f) => f.includes("_synthetic_state"))).toHaveLength(5);
    expect(files.filter((f) => !f.includes("_synthetic_state"))).toHaveLength(29);
  });

  it.each(files)("%s", (file) => {
    const schema = SCHEMAS[file.split("_")[0]!]!;
    const result = schema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});
