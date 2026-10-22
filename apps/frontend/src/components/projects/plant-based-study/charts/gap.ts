import type { ChartContext } from "./context";
import { D } from "./data";
import { E, T, mkSvg } from "./svg";

export function drawGap({
  signal,
  $,
  showTip,
  hideTip,
  vbPoint,
}: ChartContext): void {
  const W = 920;
  const BW = 120;
  const GAP = 26;
  const Y0 = 292;
  const svg = mkSvg($("chart-gap"), W, 375);
  const n = D.difficultyGap.n;
  const meta = [
    { name: "much easier", sub: "score −2 or less", col: "var(--dv-e2)" },
    { name: "a little easier", sub: "score −1", col: "var(--dv-e1)" },
    { name: "as expected", sub: "score 0", col: "var(--dv-0)" },
    { name: "a little harder", sub: "score +1", col: "var(--dv-h1)" },
    { name: "much harder", sub: "score +2 or more", col: "var(--dv-h2)" },
  ];
  const x0 = (W - (5 * BW + 4 * GAP)) / 2;
  const hpp = 4.55;
  E(
    "line",
    {
      x1: x0 - 12,
      y1: Y0,
      x2: W - x0 + 12,
      y2: Y0,
      stroke: "var(--axis)",
      "stroke-width": 1,
    },
    svg,
  );
  const bars: {
    bx: number;
    bw: number;
    c: number;
    p: number;
    m: (typeof meta)[number];
  }[] = [];
  D.difficultyGap.counts.forEach((c, i) => {
    const p = (c / n) * 100;
    const bx = x0 + i * (BW + GAP);
    const bh = p * hpp;
    E(
      "rect",
      { x: bx, y: Y0 - bh, width: BW, height: bh, rx: 4, fill: meta[i].col },
      svg,
    );
    T(svg, bx + BW / 2, Y0 - bh - 9, `${Math.round(p)}%`, {
      "text-anchor": "middle",
      "font-size": 15,
      "font-weight": 700,
      fill: "var(--ink)",
    });
    T(svg, bx + BW / 2, Y0 + 22, meta[i].name, {
      "text-anchor": "middle",
      "font-size": 13,
      fill: "var(--sub)",
    });
    T(svg, bx + BW / 2, Y0 + 40, meta[i].sub, {
      "text-anchor": "middle",
      "font-size": 11,
      fill: "var(--mut)",
      class: "t-mono",
    });
    bars.push({ bx, bw: BW, c, p, m: meta[i] });
  });
  const b1 = x0 + (BW + GAP);
  const b3 = x0 + 3 * (BW + GAP) + BW;
  const topY = Y0 - 46 * hpp - 34;
  E(
    "path",
    {
      d: `M${b1} ${topY + 8} V${topY} H${b3} V${topY + 8}`,
      fill: "none",
      stroke: "var(--mut)",
      "stroke-width": 1.4,
    },
    svg,
  );
  T(
    svg,
    (b1 + b3) / 2,
    topY - 10,
    "9 in 10 were within one point of their guess",
    {
      "text-anchor": "middle",
      "font-size": 13.5,
      "font-weight": 650,
      fill: "var(--ink)",
    },
  );
  svg.addEventListener(
    "pointermove",
    (ev) => {
      const p = vbPoint(svg, ev, W);
      const b = bars.find((q) => p.x >= q.bx && p.x <= q.bx + q.bw);
      if (!b) {
        hideTip();
        return;
      }
      showTip(
        `<div class="tt-h">${b.m.name}</div>${b.c} people · ${Math.round(b.p)}% of the group`,
        ev.clientX,
        ev.clientY,
      );
    },
    { signal },
  );
  svg.addEventListener("pointerleave", hideTip, { signal });
}
