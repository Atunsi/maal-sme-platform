import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { AnomalyResponse, CreditResponse, ForecastResponse, ProfileResponse, ZakatResponse } from "@/lib/schemas";

const dir = join(__dirname, "..", "fixtures");
const SCHEMAS: Record<string, ZodType> = {
  credit: CreditResponse,
  forecast: ForecastResponse,
  anomaly: AnomalyResponse,
  zakat: ZakatResponse,
  profile: ProfileResponse,
};

describe("fixtures parse", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("covers 25 captured and 5 synthetic-state fixtures", () => {
    expect(files.filter((f) => f.includes("_synthetic_state"))).toHaveLength(5);
    expect(files.filter((f) => !f.includes("_synthetic_state"))).toHaveLength(25);
  });

  it.each(files)("%s", (file) => {
    const schema = SCHEMAS[file.split("_")[0]!]!;
    const result = schema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});
