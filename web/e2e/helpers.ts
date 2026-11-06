import { readFileSync } from "node:fs";
import { join } from "node:path";

export function apiEnv(): { MAAL_API_URL: string; MAAL_API_KEY: string } {
  const env = Object.fromEntries(
    readFileSync(join(__dirname, "..", ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return { MAAL_API_URL: env.MAAL_API_URL!, MAAL_API_KEY: env.MAAL_API_KEY! };
}
