// The theme choice lives in localStorage only, never in a cookie (DECISIONS 42).
export const THEME_KEY = "maal-theme";

/** The phone's status bar and app switcher take the header's colour (`--surface`) in each theme. */
export const BAR_COLOUR = { light: "#ffffff", dark: "#141922" } as const;

/** Runs before first paint, so a dark visitor never sees a light flash. It also colours the status bar for
 * the chosen theme, which may differ from the system's (the viewport metas only follow the system). */
export const THEME_BOOT = `(function(){var c=document.documentElement.classList,d=false;try{var t=localStorage.getItem("${THEME_KEY}");d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}c.add(d?"th-dark":"th-light");document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",d?"${BAR_COLOUR.dark}":"${BAR_COLOUR.light}")})})})()`;

function colourBar(dark: boolean): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", dark ? BAR_COLOUR.dark : BAR_COLOUR.light));
}

const CHANGE = "maal-theme-change";

/**
 * Puts the chosen theme back on <html>: the stored choice, else the system's. The root layout re-renders <html>
 * when the locale changes, which drops the class THEME_BOOT added, so components/HtmlState.tsx calls this.
 */
export function applyStoredTheme(): void {
  let dark = false;
  try {
    const stored = localStorage.getItem(THEME_KEY);
    dark = stored ? stored === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  } catch {
    // Storage refused: the system's choice, as THEME_BOOT does.
    dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
  }
  const { classList } = document.documentElement;
  classList.toggle("th-dark", dark);
  classList.toggle("th-light", !dark);
  colourBar(dark);
}

export function isDark(): boolean {
  return document.documentElement.classList.contains("th-dark");
}

export function setDark(dark: boolean): void {
  const { classList } = document.documentElement;
  classList.toggle("th-dark", dark);
  classList.toggle("th-light", !dark);
  colourBar(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Private browsing can refuse storage. The theme still changes for this visit.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function onThemeChange(listener: () => void): () => void {
  window.addEventListener(CHANGE, listener);
  return () => window.removeEventListener(CHANGE, listener);
}
