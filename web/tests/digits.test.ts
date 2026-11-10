// E8: the Arabic-Indic digits switch, and N3 (hashes, commands and IDs in code stay Latin). DECISIONS 51.
import { afterEach, describe, expect, it } from "vitest";
import { applyDigits, toArabDigits, toLatnDigits } from "@/lib/digits";
import { formatDate, formatInt, formatRaw, formatSar } from "@/lib/format";

const VALUES = [0, 7, 6.5, 0.052612, 47583.74, -23054.75, 1234567, 638310.41, -0.5];
const DATES = ["2026-07-30", "2025-08-01", "2026-01-09"];

afterEach(() => {
  document.documentElement.lang = "en";
  document.body.innerHTML = "";
});

describe("digits formatting", () => {
  it("the page rewrite gives exactly what Intl gives with the arab numbering system", () => {
    for (const v of VALUES) {
      expect(toArabDigits(formatSar(v, "ar"))).toBe(formatSar(v, "ar", "arab"));
      expect(toArabDigits(formatInt(v, "ar"))).toBe(formatInt(v, "ar", "arab"));
      expect(toArabDigits(formatRaw(v, "ar"))).toBe(formatRaw(v, "ar", "arab"));
    }
    for (const d of DATES) expect(toArabDigits(formatDate(d, "ar"))).toBe(formatDate(d, "ar", "arab"));
    expect(toArabDigits(`${formatRaw(6.5, "ar")}%`)).toBe("٦٫٥٪");
  });

  it("switching back restores the Western form exactly", () => {
    for (const v of VALUES) expect(toLatnDigits(formatSar(v, "ar", "arab"))).toBe(formatSar(v, "ar"));
    for (const d of DATES) expect(toLatnDigits(formatDate(d, "ar", "arab"))).toBe(formatDate(d, "ar"));
  });

  it("English always formats Western digits", () => {
    expect(formatSar(47583.74, "en", "arab")).toBe(formatSar(47583.74, "en"));
    // RS (DECISIONS 57): the riyal sign and a no-break space replace "SAR"; the number is unchanged (U3).
    expect(formatSar(47583.74, "en")).toBe("\u20C1\u00A047,583.74");
    expect(formatSar(47583.74, "ar")).toBe("\u20C1\u00A047,583.74");
    expect(formatSar(47583.74, "ar", "arab")).toBe("\u20C1\u00A0٤٧٬٥٨٣٫٧٤");
    expect(formatSar(-23054.75, "ar")).toBe("-\u20C1\u00A023,054.75");
  });

  it("the digit rewrite leaves the riyal sign alone", () => {
    expect(toArabDigits("\u20C1\u00A012.50")).toBe("\u20C1\u00A0١٢٫٥٠");
    expect(toLatnDigits("\u20C1\u00A0١٢٫٥٠")).toBe("\u20C1\u00A012.50");
  });

  it("separators and periods away from digits are left alone", () => {
    expect(toArabDigits("ر.س. 12.5, and 3")).toBe("ر.س. ١٢٫٥, and ٣");
  });
});

describe("arabic digits never touch hashes or commands", () => {
  const PAGE = `
    <main>
      <h1 id="heading">Business 10001</h1>
      <p id="amount"><bdi dir="ltr">SAR 47,583.74</bdi></p>
      <svg><text id="axis">Day 30</text></svg>
      <code lang="en" id="hash">554734fed068d4db5bbaa8c1e8e8511e6ed6a372ee721b938490be96e00b8eb0</code>
      <pre lang="en" id="command"><code>python -m pipeline.verify &lt;file&gt;</code></pre>
      <dl data-latin id="short"><dd>v1 7ed936b6ee7e</dd></dl>
      <a href="/ar/business/10004" data-latin id="link">Open 10004</a>
      <p lang="en" id="backend">Inflows down 15% from week 18</p>
      <input id="field" value="10001" />
    </main>`;

  it("converts amounts, plain-text IDs and chart labels, and leaves every N3 element Latin", () => {
    document.documentElement.lang = "ar";
    document.body.innerHTML = PAGE;
    applyDigits(document.body, "arab");
    const text = (id: string) => document.getElementById(id)!.textContent;
    expect(text("heading")).toBe("Business ١٠٠٠١");
    expect(text("amount")).toBe("SAR ٤٧٬٥٨٣٫٧٤");
    expect(text("axis")).toBe("Day ٣٠");
    expect(text("hash")).toBe("554734fed068d4db5bbaa8c1e8e8511e6ed6a372ee721b938490be96e00b8eb0");
    expect(text("command")).toBe("python -m pipeline.verify <file>");
    expect(text("short")).toBe("v1 7ed936b6ee7e");
    expect(text("link")).toBe("Open 10004");
    expect(text("backend")).toBe("Inflows down 15% from week 18");
    expect((document.getElementById("field") as HTMLInputElement).value).toBe("10001");
    applyDigits(document.body, "latn");
    expect(text("amount")).toBe("SAR 47,583.74");
    expect(text("heading")).toBe("Business 10001");
  });

  it("does nothing on an English page", () => {
    document.documentElement.lang = "en";
    document.body.innerHTML = PAGE;
    applyDigits(document.body, "arab");
    expect(document.getElementById("amount")!.textContent).toBe("SAR 47,583.74");
  });
});
