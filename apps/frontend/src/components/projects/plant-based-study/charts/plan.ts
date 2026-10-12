import type { ChartContext } from "./context";
import { D } from "./data";
import { E, T, mkSvg } from "./svg";

export function drawPlan({
  signal,
  $,
  showTip,
  hideTip,
  vbPoint,
}: ChartContext): void {
  const W = 920;
  const X0 = 60;
  const X1 = 880;
  const BY = 108;
  const BH = 46;
  const svg = mkSvg($("chart-plan"), W, 215);
  const segs = D.plan.segments;
  const n = D.plan.n;
  const cols = [
    "var(--dv-e2)",
    "var(--dv-e1)",
    "var(--dv-0)",
    "var(--dv-h1)",
    "var(--dv-h2)",
  ];
  let cx = X0;
  const rects: {
    x: number;
    w: number;
    s: (typeof segs)[number];
    p: string;
  }[] = [];
  segs.forEach((s, i) => {
    const w = (s.count / n) * (X1 - X0) - (i < segs.length - 1 ? 2 : 0);
    E(
      "rect",
      { x: cx, y: BY, width: Math.max(w, 2), height: BH, fill: cols[i] },
      svg,
    );
    const p = String(Math.round((s.count / n) * 100));
    if (w > 70) {
      T(svg, cx + w / 2, BY + BH / 2 + 5, `${p}%`, {
        "text-anchor": "middle",
        "font-size": 15,
        "font-weight": 700,
        fill: i < 2 ? "var(--seg-label-light)" : "var(--ink)",
      });
    }
    rects.push({ x: cx, w, s, p });
    cx += w + 2;
  });
  const yesW = rects[0].w + 2 + rects[1].w;
  E(
    "path",
    {
      d: `M${X0} ${BY - 14} V${BY - 22} H${X0 + yesW} V${BY - 14}`,
      fill: "none",
      stroke: "var(--mut)",
      "stroke-width": 1.4,
    },
    svg,
  );
  T(svg, X0 + yesW / 2, BY - 32, "85% say probably or definitely yes", {
    "text-anchor": "middle",
    "font-size": 14,
    "font-weight": 650,
    fill: "var(--ink)",
  });
  let lx = X0;
  segs.forEach((s, i) => {
    E("circle", { cx: lx + 5, cy: BY + BH + 26, r: 5, fill: cols[i] }, svg);
    const t = T(
      svg,
      lx + 15,
      BY + BH + 31,
      `${s.label} ${Math.round((s.count / n) * 100)}%`,
      { "font-size": 12.5, fill: "var(--sub)" },
    );
    lx += 15 + t.getComputedTextLength() + 26;
  });
  svg.addEventListener(
    "pointermove",
    (ev) => {
      const p = vbPoint(svg, ev, W);
      const r = rects.find(
        (q) =>
          p.x >= q.x && p.x <= q.x + q.w && p.y > BY - 10 && p.y < BY + BH + 10,
      );
      if (!r) {
        hideTip();
        return;
      }
      showTip(
        `<div class="tt-h">${r.s.label}</div>${r.s.count} of ${n} · ${r.p}%`,
        ev.clientX,
        ev.clientY,
      );
    },
    { signal },
  );
  svg.addEventListener("pointerleave", hideTip, { signal });
}
