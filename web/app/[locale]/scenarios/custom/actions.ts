"use server";

import { redirect } from "next/navigation";
import { getScenarioCatalog } from "@/lib/api";
import { encodeShock, paramNames, type Shock } from "@/lib/custom-scenario";
import { isLocale } from "@/lib/i18n";

/**
 * E12: the builder's server action. It reads the form, puts the chosen shocks in the URL and sends the
 * visitor there; the page then asks the API (which checks the bounds again). Nothing is saved.
 */
export async function runCustomScenarioForm(form: FormData) {
  const locale = String(form.get("locale"));
  if (!isLocale(locale)) redirect("/en/scenarios/custom");
  const role = String(form.get("as") ?? "");
  const roleParam = role === "owner" || role === "admin" ? `as=${role}` : "";
  const base = `/${locale}/scenarios/custom`;
  const withRole = (params: URLSearchParams) => {
    if (roleParam) params.set("as", role);
    return `${base}?${params}`;
  };
  const catalog = await getScenarioCatalog();
  if (!catalog.ok) redirect(withRole(new URLSearchParams({ error: "unavailable" })));
  const picked: Shock[] = [];
  for (const type of form.getAll("include").map(String)) {
    if (!(type in catalog.data.shock_types)) continue;
    const params: Record<string, number> = {};
    for (const name of paramNames(catalog.data, type)) params[name] = Number.parseInt(String(form.get(`${type}.${name}`) ?? ""), 10);
    picked.push({ type, params });
  }
  if (picked.length === 0) redirect(withRole(new URLSearchParams({ error: "none" })));
  if (picked.length > catalog.data.max_shocks) redirect(withRole(new URLSearchParams({ error: "many" })));
  const params = new URLSearchParams();
  for (const shock of picked) params.append("shock", encodeShock(catalog.data, shock));
  redirect(withRole(params));
}
