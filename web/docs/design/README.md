# Ma'al web UI: design direction bundle

Exported 2026-11-06 from the claude.ai canvas "Ma'al web UI: design direction".
This folder is a **design reference**, not code to ship. Read `DESIGN_DIRECTION.md` first.

## What is here

| Path | What it is |
|---|---|
| `DESIGN_DIRECTION.md` | The brief: competitor findings, brand, page map, tokens, motion, rule check, build order |
| `logo/maal-ar.svg` | The Arabic logo (the master), traced from `maal-ar-original.png`. Two paths: letter body, then madda |
| `logo/maal-en.svg` | The English wordmark drawn to match it. Two paths: letters, then the madda apostrophe |
| `logo/maal-ar-original.png` | Faris's original logo file |
| `assets/maal-logo-tile-*.svg` | Small logo tiles for the drifting header band and section markers (light and dark) |
| `mockups/*.dc.html` | One file per page mockup (see the table below) |

## How to read the mockups

Each `.dc.html` file is a canvas artboard, not a plain web page. It will not render on its own: the
`{{...}}` holes, `<sc-for>` and `<sc-if>` tags and the `class Component extends DCLogic` script are the
canvas runtime's template format. Use them as a spec:

- **Markup and inline styles**: layout, spacing, copy, colours (CSS variables in `.th-light` / `.th-dark`).
- **`<helmet><style>`**: tokens, plates, keyframes and the `prefers-reduced-motion` rule.
- **`renderVals()` / `pageVals()`**: the data each page shows. All figures are copied from the 10001
  fixtures and the v2 report. In the real app every figure must come from the API or an exported
  scenario object (SOP section 2: no hard-coded numbers).

| Mockup | Proposed route |
|---|---|
| `Landing.dc.html` | `/[locale]` |
| `Login.dc.html` | `/[locale]/sign-in` (mockup only, see U15 below) |
| `Admin.dc.html` | `/[locale]/admin` |
| `Main.dc.html` | `/[locale]/business/[id]` (overview) |
| `Credit.dc.html`, `Sharia.dc.html`, `Zakat.dc.html`, `Forecast.dc.html`, `Review.dc.html` | `/[locale]/business/[id]/<lens>` |
| `Scenarios.dc.html` | `/[locale]/scenarios` |
| `Arabic.dc.html` | Arabic overview, RTL (draft copy, needs review) |
| `Logo.dc.html` | Brand sheet for the two logos |

## Before building

- Rules U1 to U15 in `SOP_web_ui_first_pass.md` still apply. Two conflict with this design and need
  Faris's decision first: **U11** (the synthetic-data banner was removed at his request) and **U15**
  (no accounts or login screens; the sign-in is a mockup).
- No symbol characters in UI text: no check marks, crosses, exclamation marks, arrows, delta signs,
  middle dots, ellipses or em dashes. Status is a word on a plate.
- The mockup labels for credit factors are shortened. The build must render the API's `text` verbatim (U4).
