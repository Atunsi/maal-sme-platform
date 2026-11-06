import index from "../scenarios-data/index.json";

export const LOCALES = ["en", "ar"] as const;
export const THEMES = ["light", "dark"] as const;

export const SCENARIO_PAGES = index.scenarios.map(({ name }) => `/scenarios?s=${name}`);

export const PAGES = [
  "",
  "/business/10001",
  "/business/10003",
  "/business/10004",
  "/business/10037",
  "/business/10040",
  ...SCENARIO_PAGES,
];
