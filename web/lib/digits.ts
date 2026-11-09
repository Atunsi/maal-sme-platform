// E8: the Arabic-Indic digits switch. Western digits are the default; the switch exists in the Arabic
// locale only, and the choice lives in localStorage only, never a cookie (DECISIONS 43, like the theme).
//
// The server cannot know a choice kept in localStorage, so it always renders Western digits. After
// hydration, the client rewrites the digits in the page's text (and keeps doing so as the page changes).
// The rewrite gives exactly what Intl produces with the `arab` numbering system (tests/digits.test.ts).
//
// N3: hashes, commands, URLs, receipt fields, business IDs inside links and backend text are never touched.
// They are skipped by NEVER below: code and pre (Code, commands), [lang=en] (BackendText, the scope,
// scenario labels, Code), form fields, and anything marked [data-latin] (shortened hashes, and every link
// whose text shows a business ID). B3 (DECISIONS 45): links are no longer skipped as a whole, so the
// amounts on a readout card and the counts in a link convert like any other number.

export const DIGITS_KEY = "maal-digits";
export type Digits = "latn" | "arab";

const ARAB_ZERO = 0x0660;
const NEVER = "code, pre, kbd, samp, script, style, input, textarea, select, [lang=en], [data-latin]";

/** Western digits, and the separators and percent sign around them, in their Arabic-Indic form. */
export function toArabDigits(text: string): string {
  return text
    .replace(/(?<=\d)\.(?=\d)/g, "٫")
    .replace(/(?<=\d),(?=\d)/g, "٬")
    .replace(/(?<=\d)%/g, "٪")
    .replace(/\d/g, (d) => String.fromCharCode(ARAB_ZERO + Number(d)));
}

/** The reverse, for switching back without a reload. Only characters toArabDigits writes are mapped. */
export function toLatnDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARAB_ZERO))
    .replace(/(?<=\d)٫(?=\d)/g, ".")
    .replace(/(?<=\d)٬(?=\d)/g, ",")
    .replace(/(?<=\d)٪/g, "%");
}

/** Runs before first paint: marks <html> so the page knows the choice. Arabic only. */
export const DIGITS_BOOT = `(function(){try{var h=document.documentElement;if(h.lang==="ar"&&localStorage.getItem("${DIGITS_KEY}")==="arab")h.dataset.digits="arab"}catch(e){}})()`;

export function digitsChosen(): Digits {
  return document.documentElement.dataset.digits === "arab" ? "arab" : "latn";
}

function convertNode(node: Text, digits: Digits) {
  if (digits === "arab" && document.documentElement.lang !== "ar") return; // English always shows Western digits
  const parent = node.parentElement;
  if (!parent || parent.closest(NEVER)) return;
  const before = node.nodeValue ?? "";
  const after = digits === "arab" ? toArabDigits(before) : toLatnDigits(before);
  if (after !== before) node.nodeValue = after; // in place, so React keeps its own reference to the node
}

/** Rewrites every eligible text node under root. */
export function applyDigits(root: Node, digits: Digits) {
  if (root.nodeType === Node.TEXT_NODE) return convertNode(root as Text, digits);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) convertNode(node as Text, digits);
}

const CHANGE = "maal-digits-change";
let observer: MutationObserver | null = null;

/** Keeps converting text React or the router adds later, while Arabic-Indic digits are on. */
export function startDigits() {
  stopDigits();
  if (digitsChosen() !== "arab") return;
  applyDigits(document.body, "arab");
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") applyDigits(record.target, "arab");
      else record.addedNodes.forEach((node) => applyDigits(node, "arab"));
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

export function stopDigits() {
  observer?.disconnect();
  observer = null;
}

export function setDigits(digits: Digits) {
  const html = document.documentElement;
  if (digits === "arab") html.dataset.digits = "arab";
  else delete html.dataset.digits;
  try {
    localStorage.setItem(DIGITS_KEY, digits);
  } catch {
    // Private browsing can refuse storage. The digits still change for this visit.
  }
  if (digits === "arab") startDigits();
  else {
    stopDigits();
    applyDigits(document.body, "latn");
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function onDigitsChange(listener: () => void): () => void {
  window.addEventListener(CHANGE, listener);
  return () => window.removeEventListener(CHANGE, listener);
}
