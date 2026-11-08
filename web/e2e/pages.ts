import index from "../scenarios-data/index.json";

export const LOCALES = ["en", "ar"] as const;
export const THEMES = ["light", "dark"] as const;

export const BUSINESSES = [10001, 10003, 10004, 10037, 10040];
export const LENS_ROUTES = ["credit", "credit?view=compliance", "sharia", "zakat", "forecast", "review"];

export const SCENARIO_PAGES = index.scenarios.map(({ name }) => `/scenarios?s=${name}`);

export const PAGES = [
  "",
  "/sign-in",
  "/admin",
  "/glossary",
  "/business/10001/sheet",
  "/business/10003/sheet",
  ...BUSINESSES.flatMap((id) => [`/business/${id}`, ...LENS_ROUTES.map((route) => `/business/${id}/${route}`)]),
  ...SCENARIO_PAGES,
];
