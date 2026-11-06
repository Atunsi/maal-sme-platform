// Reads the exported scenario objects. Scenarios run through the CLI, not the API, so these are
// files written by scripts/export-scenarios.mjs, each with its own receipt.
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import { ScenarioIndex, ScenarioObject } from "@/lib/schemas";
import type { ApiResult, ScenarioIndex as Index, ScenarioObject as Scenario } from "@/lib/types";

const DIR = join(process.cwd(), "scenarios-data");

async function load<S extends z.ZodType>(file: string, schema: S): Promise<ApiResult<z.output<S>>> {
  try {
    const parsed = schema.safeParse(JSON.parse(await readFile(join(DIR, file), "utf8")));
    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, kind: "contract", detail: `${file}: ${parsed.error.issues[0]?.message}` };
  } catch {
    return { ok: false, kind: "contract", detail: `${file}: could not be read` };
  }
}

export const getScenarioIndex = (): Promise<ApiResult<Index>> => load("index.json", ScenarioIndex);

/** `name` must already be on the menu, which keeps a URL parameter out of the file path. */
export const getScenario = (name: string): Promise<ApiResult<Scenario>> => load(`${name}.json`, ScenarioObject);
