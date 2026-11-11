// CR1 (DECISIONS 62): the one validator for a typed commercial registration number.
//
// A real Saudi commercial registration number is the 10-digit unified number that starts with 7. This demo holds
// only synthetic businesses with 5-digit demo numbers, so the field accepts a demo number and tells the truth
// about a real one. It never claims a demo number is a real registration (CR-V2). Nothing here calls the API:
// input that fails a format step is refused before any call (CR-V1), and whether a demo number exists is
// answered from the list or range the server page was given.

export type RegistrationProblem =
  | "empty" // nothing typed
  | "notDigits" // something that is not a digit
  | "real" // 10 digits starting with 7: well formed for a real registration, which this demo does not hold
  | "notSeven" // 10 digits not starting with 7
  | "length" // any other length
  | "unknown" // 5 digits, but no demo business has this number
  | "notInPreview"; // 5 digits, a demo number, but the online preview did not capture it

export type RegistrationCheck = { ok: true; id: number } | { ok: false; problem: RegistrationProblem };

/** What the page knows about the demo numbers: the range, and in the online preview the captured few. */
export type DemoNumbers = { from: number; to: number; only?: readonly number[] };

export const DEMO_NUMBER_LENGTH = 5;
export const REAL_NUMBER_LENGTH = 10;
export const REAL_NUMBER_FIRST_DIGIT = "7";

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** Trim, drop spaces and dashes inside, and turn Arabic-Indic and Persian digits into Western digits. */
export function normaliseRegistrationNumber(input: string): string {
  return input
    .trim()
    .replace(/[\s\-‐-―−]/g, "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO));
}

/** The format steps only, in order. `null` means the text is a well-formed demo number. */
export function formatProblem(input: string): Exclude<RegistrationProblem, "unknown" | "notInPreview"> | null {
  const text = normaliseRegistrationNumber(input);
  if (text === "") return "empty";
  if (!/^[0-9]+$/.test(text)) return "notDigits";
  if (text.length === DEMO_NUMBER_LENGTH) return null;
  if (text.length === REAL_NUMBER_LENGTH) return text.startsWith(REAL_NUMBER_FIRST_DIGIT) ? "real" : "notSeven";
  return "length";
}

/** The whole check: the format steps, then whether a demo business has the number. */
export function checkRegistrationNumber(input: string, demo: DemoNumbers): RegistrationCheck {
  const problem = formatProblem(input);
  if (problem) return { ok: false, problem };
  const id = Number(normaliseRegistrationNumber(input));
  if (id < demo.from || id > demo.to) return { ok: false, problem: "unknown" };
  if (demo.only && !demo.only.includes(id)) return { ok: false, problem: "notInPreview" };
  return { ok: true, id };
}
