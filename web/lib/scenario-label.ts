/**
 * A library label reads "Name — what happens". The dash is a separator, and the design shows the two
 * parts on separate lines, so splitting there drops no word and keeps the symbol off the page.
 */
export function scenarioName(label: string): { name: string; detail: string | null } {
  const at = label.indexOf(" — ");
  if (at === -1) return { name: label, detail: null };
  const detail = label.slice(at + 3);
  return { name: label.slice(0, at), detail: detail.charAt(0).toUpperCase() + detail.slice(1) };
}
