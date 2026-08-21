# Open Graph / social-preview images

`generate.py` renders the brand social-preview cards used in link previews
(Slack, iMessage, Facebook, Twitter/X, etc.).

It produces, into `apps/frontend/public/`:

| Output          | Used by                                     | Route     |
| --------------- | ------------------------------------------- | --------- |
| `og-home.png`   | `src/pages/static/PrelaunchLandingPage.tsx` | `/`       |
| `og-signup.png` | `src/pages/app/SignupPage.tsx`              | `/signup` |

Each page wires its image in via its `meta()` export, which calls the shared
helper `src/lib/socialPreviewMeta.ts`.

## How it works

The script builds a self-contained HTML card (brand fonts and the
`planet-earth` globe are inlined as base64 data URIs) and screenshots it with
headless Google Chrome at 1200×630 (the Open Graph standard size). Using
Chrome — rather than a pure image library —
lets the cards use the real brand fonts (Berlingske wordmark, Literata serif)
and CSS gradients.

## Run

```sh
python3 scripts/og/generate.py
```

Requires Google Chrome. If it's not at the default macOS path, point to it:

```sh
CHROME="/path/to/chrome" python3 scripts/og/generate.py
```

## Editing the design

Tweak the `BASE_CSS`, `HOME`, and `SIGNUP` blocks in `generate.py`, re-run, and
commit the regenerated PNGs. Brand colors and fonts mirror `src/index.css`
(`--color-green-bg` family, `Berlingske` / `Literata` / `Source Sans 3`).
