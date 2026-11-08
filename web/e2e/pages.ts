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
  "/how-it-works",
  "/business/10001/sheet",
  "/business/10003/sheet",
  "/scenarios/custom",
  "/scenarios/custom?shock=cash_crunch.16.40&shock=large_transfer.10",
  "/admin?q=1002&sector=retail_trade",
  ...BUSINESSES.flatMap((id) => [`/business/${id}`, ...LENS_ROUTES.map((route) => `/business/${id}/${route}`)]),
  ...SCENARIO_PAGES,
];
