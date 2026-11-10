import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { getMessages } from "@/lib/i18n";

export const webRoot = join(__dirname, "..");
export const en = getMessages("en");
export const ar = getMessages("ar");

export function readJson(...path: string[]): unknown {
  return JSON.parse(readFileSync(join(webRoot, ...path), "utf8"));
}

export function fixture<S extends z.ZodType>(name: string, schema: S): z.output<S> {
  return schema.parse(readJson("fixtures", `${name}.json`));
}
