#!/usr/bin/env python3
"""Generate the YouTube channel art for the Alliance channel.

Renders with headless Chrome so the cards use the real brand fonts (Berlingske
wordmark, Literata serif), exact brand colors, and the planet-earth globe --
the same approach as apps/frontend/scripts/og/generate.py. Outputs into brand/:

  youtube-banner.png  2560x1440 channel banner
  youtube-avatar.png  800x800 channel profile picture

YouTube crops the banner differently per device. Everything that must always be
visible lives inside the centered 1546x423 "safe area"; the rest of the canvas
is background that only shows on TV.

Usage:
  python3 scripts/brand/youtube.py

Requires Google Chrome. Override its path with the CHROME env var if needed:
  CHROME="/path/to/chrome" python3 scripts/brand/youtube.py
"""

import base64
import os
import pathlib
import subprocess
import sys
import tempfile

# scripts/brand/youtube.py -> repo root
ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "apps/frontend/public"
OUT_DIR = ROOT / "brand"

CHROME = os.environ.get(
    "CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)

BANNER_W, BANNER_H = 2560, 1440
# YouTube's "text and logos" safe area: visible on every device, including the
# narrow desktop crop.
SAFE_W, SAFE_H = 1546, 423
AVATAR_SIZE = 800


def b64(path: pathlib.Path, mime: str) -> str:
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{data}"


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

# Brand greens mirror apps/frontend/src/index.css (--color-green-bg family).
BANNER_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
{FONTS}
html,body {{ width:{BANNER_W}px; height:{BANNER_H}px; overflow:hidden; }}
body {{
  position:relative;
  font-family:'SourceSans',sans-serif;
  color:#fff;
  background:
    radial-gradient(1900px 1200px at 72% -8%, rgba(98,161,36,0.32), rgba(98,161,36,0) 60%),
    radial-gradient(1500px 1000px at 14% 112%, rgba(48,96,40,0.55), rgba(48,96,40,0) 60%),
    linear-gradient(150deg, #2a5a20 0%, #234a1b 45%, #18380f 100%);
}}
.bgglobe {{ position:absolute; right:-260px; top:50%; transform:translateY(-50%);
  width:1500px; height:1500px; opacity:0.13; filter:grayscale(0.2); }}
.bgglow {{ position:absolute; left:-360px; bottom:-460px; width:1200px; height:1200px;
  border-radius:50%; background:radial-gradient(circle,rgba(143,194,74,0.16),rgba(143,194,74,0) 70%); }}
.safe {{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:{SAFE_W}px; height:{SAFE_H}px;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  text-align:center; }}
.brand {{ display:flex; align-items:center; gap:34px; }}
.brand img {{ width:118px; height:118px; border-radius:50%;
  box-shadow:0 10px 40px rgba(0,0,0,0.35); }}
.wordmark {{ font-family:'Berlingske',serif; font-weight:900; font-size:96px;
  letter-spacing:0.15em; line-height:1; color:#fff; }}
.tagline {{ font-family:'Literata',serif; font-weight:400; font-size:44px;
  line-height:1.3; margin-top:40px; color:rgba(255,255,255,0.88); max-width:1380px; }}
.url {{ font-family:'SourceSans'; font-weight:600; font-size:30px; margin-top:34px;
  color:rgba(255,255,255,0.62); letter-spacing:0.08em; }}
"""

BANNER = f"""
<img class="bgglobe" src="{globe}">
<div class="bgglow"></div>
<div class="safe">
  <div class="brand">
    <img src="{globe}">
    <div class="wordmark">THE ALLIANCE</div>
  </div>
  <div class="tagline">A global group of people cooperating to improve the world</div>
  <div class="url">worldalliance.org</div>
</div>
"""

AVATAR_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
{FONTS}
html,body {{ width:{AVATAR_SIZE}px; height:{AVATAR_SIZE}px; overflow:hidden; }}
body {{
  position:relative;
  display:flex; align-items:center; justify-content:center;
  background:
    radial-gradient(600px 500px at 70% 0%, rgba(98,161,36,0.35), rgba(98,161,36,0) 62%),
    linear-gradient(150deg, #2a5a20 0%, #234a1b 45%, #18380f 100%);
}}
img {{ width:560px; height:560px; }}
"""

AVATAR = f'<img src="{globe}">'

CARDS = {
    "youtube-banner": (BANNER_CSS, BANNER, BANNER_W, BANNER_H),
    "youtube-avatar": (AVATAR_CSS, AVATAR, AVATAR_SIZE, AVATAR_SIZE),
}


def page(css: str, body: str) -> str:
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<style>{css}</style></head><body>{body}</body></html>"
    )


def main() -> int:
    if not pathlib.Path(CHROME).exists():
        print(
            f"Chrome not found at {CHROME!r}. Set the CHROME env var to its path.",
            file=sys.stderr,
        )
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = pathlib.Path(tmp)
        for name, (css, body, width, height) in CARDS.items():
            html = tmpdir / f"{name}.html"
            html.write_text(page(css, body))
            out = OUT_DIR / f"{name}.png"
            subprocess.run(
                [
                    CHROME,
                    "--headless",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--force-device-scale-factor=1",
                    f"--window-size={width},{height}",
                    "--default-background-color=00000000",
                    f"--screenshot={out}",
                    str(html),
                ],
                check=True,
                stderr=subprocess.DEVNULL,
            )
            print(f"wrote {out.relative_to(ROOT)} ({width}x{height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
