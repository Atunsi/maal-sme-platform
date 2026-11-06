# Ma'al web UI: design direction ("Sealed Ledger"), v5

**Written:** 2026-11-06, after the v2 first-pass run (`faris/web-ui` at `47d4741`), and revised the same day through five rounds of Faris's feedback.
**Status:** proposal for Faris. Nothing here is built. Mockups: `mockups/` in this bundle (12 artboards).
**Constraint:** every idea must still pass rules U1 to U15 of `SOP_web_ui_first_pass.md`, except the two conflicts in section 6 that Faris asked for.

---

## 1. What read as generic in the first pass

From the six screenshots in `web/docs/screenshots/`: cream page with white rounded cards and one green accent; every card the same weight; everything on one long page; the metadata line repeated on every card; pill chips with symbol characters; identical two-column grids for every lens; default chart colours and no motion; the receipt hidden at the bottom of each card; no brand on the first screen.

## 2. Competitors and what each teaches

| Group | Products | What they do well | What Ma'al takes |
|---|---|---|---|
| Saudi SME lenders | Lendo, Raqamyah, Forus | Speed and trust messaging (SAMA licence, Sharia badges) | They never show why; Ma'al does |
| Saudi accounting | Qoyod, Wafeq | Arabic-first, ZATCA-aware KPI tiles | Avoid the KPI-tile look |
| Underwriting tools | Codat, Ocrolus, nCino, Zest AI | Evidence shown visually; Zest AI's page order: promise, product card, flow graphic, proof figures, use cases, FAQ, sign-up | The landing follows Zest AI's order, with honest counts instead of performance claims |
| Forecasting | Float | One chart, cash threshold line | Runway chart with a cash floor |
| Sharia screening | Musaffa, Zoya | Clear verdicts and breakdowns | Show "pending Sharia-advisor confirmation" instead of a settled verdict |
| Brand-led fintech | Gusto, Affirm, Tamara | One motif repeated and animated everywhere; original Arabic letterforms | Faris's Arabic logo, its English companion, and one entrance motion on every page |

## 3. Brand

**Logo: Faris's Arabic wordmark مآل is the master.** Indigo `#2E3192` only. Supplied as a PNG and traced to SVG (`logo/maal-ar.svg`), split into the letter body and the madda so they can animate separately.

**English wordmark "ma'al"** (`logo/maal-en.svg`), drawn from the Arabic's parts:
1. heavy, even strokes in both scripts;
2. tall strokes cut on a slant that rises to the right, like the alef and lam;
3. the meem's solid block with a round counter becomes both "a" letters;
4. the madda becomes the apostrophe;
5. the l ends in the lam's hooked, pointed tail, turned to the right.

**Use:** Arabic and English side by side in every header (Arabic 46 px tall, English 20 px). Arabic alone for the app icon, favicon and Arabic pages, and at sizes below 28 px. White on indigo, `#A3A6FF` on dark.

**Signature motion:** on every page load the letters rise into place and the madda lands last, Arabic first, then English.

**Repeated motif:** a band of small Arabic logos drifts under every header and between landing sections; a small logo sits beside every section label; a faint oversized logo sits behind the landing hero and the sign-in panel.

**No fingerprints:** hash-derived patterns are not used anywhere. Receipts are plain text (output hash, model, commit) with "You can re-run this decision".

## 4. Pages

| Page | Content |
|---|---|
| Landing | Hero promise and an illustrative 10001 card (labelled synthetic); "built for" strip; animated flow (transactions, profile, four lenses, verdict and receipt); lens cards; counts (4 lenses, 8 scenarios, 1 receipt per decision, 2 languages); Why Ma'al; FAQ; sign-in band |
| Sign in | Brand panel with the large logo and the meaning of مآل; form with two roles: Business owner (commercial registration number) or Admin (work email) |
| Admin | All businesses, one row per API state (10001, 10004, 10037, 10040, 10003; quick data, N = 300) |
| Overview | Welcome line, verdict sheet, receipt panel, five readout cards |
| Credit | Public / Compliance toggle, factor bars from a centre axis, offer terms |
| Sharia screen | Pending-advisor frame, "what was checked" rows, owner question |
| Zakat | Waterfall from assets to base with the nisab marker; the amount; hawl timeline |
| Forecast | Key figures, runway chart with the cash floor, projection table |
| Review queue | 10 of 10 slots, 180-day scan timeline, linked transaction table |
| Scenarios | Menu, diff sheet ("Changed" and "Same" plates), findings panel with N = 1 caveat |
| Arabic | Overview in RTL (draft for review) |
| Logo | The Arabic master, the English wordmark, the five shared traits, lockups on three grounds, sizes |

## 5. System

- **Status without symbol characters:** no check marks, crosses, exclamation marks, arrows, delta signs, middle dots, ellipses or em dashes. Status is a word on a plate: solid teal (Approved, Compliant, Computed), solid vermilion (Declined, Crunch), outlined ochre (Watch, placeholders), solid ink (neutral counts).
- **Themes:** light and dark on every page via CSS variables (`th-light`, `th-dark`). The mockup keeps theme per page; the build would keep one choice per visit.
- **Motion:** CSS only, off under `prefers-reduced-motion`. It shows order and cause and never changes a value.
- **Type:** IBM Plex Sans Arabic and IBM Plex Sans for body; IBM Plex Sans Condensed for headings; IBM Plex Mono for numbers and hashes. The logo is artwork, not a font.
- **Tokens:** light ground `#F3F4F1`, surface `#FFFFFF`, ink `#101418`, accent `#2E3192`; dark ground `#0B0E13`, surface `#141922`, ink `#E8EAED`, accent `#A3A6FF`; gold `#C9A227` for rules and hover only, never in the logo.

## 6. Rule check and conflicts

| Rule | Status |
|---|---|
| U1, U2 | Markup fixed and charity-directed penalty stated; no inputs that change terms |
| U4 | Magnitude words only; the build renders the API's `text` verbatim (mockup labels are shortened) |
| U6, U7, U8, U9 | Kept, and the U6 and U7 labels are more prominent |
| U12, U13 | AUC and ceiling from the receipt; scope verbatim |
| U14 | Worded plates, chart tables, reduced motion, 44 px targets, 4.5:1 text contrast in both themes; logos carry `role="img"` and labels where they are the only brand text |
| **U11 (conflict)** | The synthetic-data banner sentence is removed as Faris asked. "Synthetic data" remains on landing, sign-in, admin and the overview footer. Edit the SOP or restore a short header line. |
| **U15 (conflict)** | Sign-in is a mockup. Building it needs an SOP change and, with real data, PDPL handling. |

## 7. Suggested build order (if approved)

1. Tokens for both themes, fonts, `Plate`, the two logos as SVG components with the entrance animation, band assets.
2. Shared layout (logos, nav, theme toggle); split routes per lens and move existing cards and tests.
3. Overview, then lens visuals one page at a time, keeping tests green; add a test that rendered text contains none of the banned symbol characters.
4. Scenario diff sheet; landing page.
5. Sign-in and admin, only after the SOP allows them.
6. Arabic review, RTL animation checks, screenshots in both themes.

## 8. Questions for Faris

1. Is the English wordmark close enough to the Arabic, or should any letter change?
2. U11: restore a short synthetic-data line in the header, or change the rule?
3. U15: build sign-in for the demo, or keep it as a mockup?
4. Keep the looping motion (logo band drift, Sharia frame, forecast pulse, flow dots), or play once only?
