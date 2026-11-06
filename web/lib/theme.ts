// The theme choice lives in localStorage only, never in a cookie (DECISIONS 42).
export const THEME_KEY = "maal-theme";

/** Runs before first paint, so a dark visitor never sees a light flash. */
export const THEME_BOOT = `(function(){var c=document.documentElement.classList,d=false;try{var t=localStorage.getItem("${THEME_KEY}");d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}c.add(d?"th-dark":"th-light")})()`;

const CHANGE = "maal-theme-change";

export function isDark(): boolean {
  return document.documentElement.classList.contains("th-dark");
}

export function setDark(dark: boolean): void {
  const { classList } = document.documentElement;
  classList.toggle("th-dark", dark);
  classList.toggle("th-light", !dark);
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
