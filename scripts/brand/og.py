#!/usr/bin/env python3
"""Generate the Open Graph / social-preview images for the frontend.

Renders 1200x630 (at 2x = 2400x1260) brand cards with headless Chrome so they
use the real brand fonts (Berlingske wordmark, Literata serif), exact brand
colors, and the planet-earth globe. Outputs:

  public/og-home.png    -> meta for "/"        (PrelaunchLandingPage)
  public/og-signup.png  -> meta for "/signup"  (SignupPage)

These are referenced by src/lib/socialPreviewMeta.ts via each route's meta().

Usage:
  python3 scripts/brand/og.py

Requires Google Chrome. Override its path with the CHROME env var if needed:
  CHROME="/path/to/chrome" python3 scripts/brand/og.py
"""

import base64
import os
import pathlib
import subprocess
import sys
import tempfile

# scripts/brand/og.py -> repo root
ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "apps/frontend/public"

CHROME = os.environ.get(
    "CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

# Logical card size (Open Graph standard).
WIDTH, HEIGHT, SCALE = 1200, 630, 1


def b64(path: pathlib.Path, mime: str) -> str:
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{data}"


# Inline the assets as data URIs so the HTML is self-contained for Chrome.
berlingske = b64(PUB / "assets/fonts/BerlingskeSerif-Blk.woff2", "font/woff2")
literata = b64(PUB / "assets/fonts/Literata-VariableFont_opsz,wght.ttf", "font/ttf")
sans_reg = b64(PUB / "assets/fonts/source-sans-3-v19-latin-regular.woff2", "font/woff2")
sans_600 = b64(PUB / "assets/fonts/source-sans-3-v19-latin-600.woff2", "font/woff2")
globe = b64(PUB / "planet-earth.png", "image/png")

FONTS = f"""
@font-face {{ font-family:'Berlingske'; src:url('{berlingske}') format('woff2'); font-weight:900; }}
@font-face {{ font-family:'Literata'; src:url('{literata}') format('truetype'); font-weight:400 700; }}
@font-face {{ font-family:'SourceSans'; src:url('{sans_reg}') format('woff2'); font-weight:400; }}
@font-face {{ font-family:'SourceSans'; src:url('{sans_600}') format('woff2'); font-weight:600; }}
"""

BASE_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
{FONTS}
html,body {{ width:{WIDTH}px; height:{HEIGHT}px; overflow:hidden; }}
body {{
  position:relative;
  font-family:'SourceSans',sans-serif;
  color:#fff;
  /* Brand greens: --color-green-bg / --color-green-bg-card / --color-green */
  background:
    radial-gradient(1100px 700px at 78% -10%, rgba(98,161,36,0.30), rgba(98,161,36,0) 60%),
    radial-gradient(900px 600px at 12% 115%, rgba(48,96,40,0.55), rgba(48,96,40,0) 60%),
    linear-gradient(150deg, #2a5a20 0%, #234a1b 45%, #18380f 100%);
}}
.frame {{ position:absolute; inset:0; padding:76px 84px; display:flex; flex-direction:column; }}
.accent {{ position:absolute; top:0; left:0; right:0; height:8px;
  background:linear-gradient(90deg,#62a124,#8fc24a 55%,#62a124); }}
.bgglobe {{ position:absolute; right:-220px; top:-180px; width:760px; height:760px;
  opacity:0.10; filter:grayscale(0.2); }}
.bgglow {{ position:absolute; right:-120px; bottom:-260px; width:560px; height:560px;
  border-radius:50%; background:radial-gradient(circle,rgba(143,194,74,0.18),rgba(143,194,74,0) 70%); }}
.brand {{ display:flex; align-items:center; gap:20px; }}
.brand img {{ width:62px; height:62px; border-radius:50%;
  box-shadow:0 6px 24px rgba(0,0,0,0.30); }}
.wordmark {{ font-family:'Berlingske',serif; font-weight:900; font-size:33px;
  letter-spacing:0.16em; color:#fff; }}
.spacer {{ flex:1; }}
.headline {{ font-family:'Literata',serif; font-weight:600; color:#fff;
  letter-spacing:-0.01em; }}
.sub {{ font-family:'SourceSans',sans-serif; color:rgba(255,255,255,0.80);
  line-height:1.4; }}
.footer {{ display:flex; align-items:center; justify-content:space-between; }}
.pill {{ display:inline-flex; align-items:center; gap:12px; align-self:flex-start;
  background:#62a124; color:#fff; font-family:'SourceSans'; font-weight:600;
  font-size:25px; padding:15px 30px; border-radius:12px;
  box-shadow:0 8px 30px rgba(98,161,36,0.35); }}
.url {{ font-family:'SourceSans'; font-weight:600; font-size:24px;
  color:rgba(255,255,255,0.70); letter-spacing:0.02em; }}
"""


def page(body: str) -> str:
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{BASE_CSS}</style></head><body>{body}</body></html>"
    )


HOME = f"""
<div class="accent"></div>
<img class="bgglobe" src="{globe}">
<div class="bgglow"></div>
<div class="frame">
  <div class="brand">
    <img src="{globe}">
    <div class="wordmark">THE ALLIANCE</div>
  </div>
  <div class="spacer"></div>
  <div class="headline" style="font-size:67px; line-height:1.13; max-width:840px;">
    A global group of people cooperating to improve the world
  </div>
  <div class="spacer"></div>
  <div class="footer" style="justify-content:flex-end;">
    <div class="url">worldalliance.org</div>
  </div>
</div>
"""

SIGNUP = f"""
<div class="accent"></div>
<img class="bgglobe" src="{globe}">
<div class="bgglow"></div>
<div class="frame">
  <div class="brand">
    <img src="{globe}">
    <div class="wordmark">THE ALLIANCE</div>
  </div>
  <div class="spacer"></div>
  <div class="headline" style="font-size:82px; line-height:1.08;">
    Create an account
  </div>
  <div class="sub" style="font-size:30px; max-width:760px; margin-top:24px;">
    Join a global community cooperating to improve the world.<br>
    15 minutes a week toward measurable impact.
  </div>
  <div class="spacer"></div>
  <div class="footer">
    <div class="pill">Join the Alliance</div>
    <div class="url">worldalliance.org/signup</div>
  </div>
</div>
"""

CARDS = {"og-home": HOME, "og-signup": SIGNUP}


def main() -> int:
    if not pathlib.Path(CHROME).exists():
        print(
            f"Chrome not found at {CHROME!r}. Set the CHROME env var to its path.",
            file=sys.stderr,
        )
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = pathlib.Path(tmp)
        for name, body in CARDS.items():
            html = tmpdir / f"{name}.html"
            html.write_text(page(body))
            out = PUB / f"{name}.png"
            subprocess.run(
                [
                    CHROME,
                    "--headless",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    f"--force-device-scale-factor={SCALE}",
                    f"--window-size={WIDTH},{HEIGHT}",
                    "--default-background-color=00000000",
                    f"--screenshot={out}",
                    str(html),
                ],
                check=True,
                stderr=subprocess.DEVNULL,
            )
            print(f"wrote {out.relative_to(ROOT)} ({WIDTH * SCALE}x{HEIGHT * SCALE})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
