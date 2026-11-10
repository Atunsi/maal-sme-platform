// The app variant: the same pages, with native phone chrome (a bottom tab bar) when Ma'al runs as an installed
// app. `?app=1` previews it in a browser tab and `?app=0` turns the preview off; the preview is kept for that
// tab only (sessionStorage), never across visits.
export const APP_PREVIEW_KEY = "maal-app-preview";

/** App mode back on <html> after the root layout re-renders it (a language change); see components/HtmlState.tsx. */
export function applyAppMode(): void {
  let on = false;
  try {
    on = window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true || sessionStorage.getItem(APP_PREVIEW_KEY) === "1";
  } catch {
    on = false;
  }
  document.documentElement.classList.toggle("app-mode", on);
}

/** Runs before first paint, like THEME_BOOT, so the tab bar never pops in after the page shows. */
export const APP_BOOT = `(function(){try{var q=new URLSearchParams(location.search).get("app"),s=sessionStorage;if(q==="1")s.setItem("${APP_PREVIEW_KEY}","1");if(q==="0")s.removeItem("${APP_PREVIEW_KEY}");var on=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true||s.getItem("${APP_PREVIEW_KEY}")==="1";if(on)document.documentElement.classList.add("app-mode")}catch(e){}})()`;
