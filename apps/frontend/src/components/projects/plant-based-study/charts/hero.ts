import type { ChartContext } from "./context";
import { D } from "./data";
import { E, T, mkSvg } from "./svg";

const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
};
const dotHTML = (c: string) => `<span style="color:${c}">&#9679;</span> `;
const REDT = "#3ECF9F";
const COMPT = "#9FB0C1"; // tooltip-legible tints of the two arms

export function drawHero({
  signal,
  $,
  live,
  showTip,
  hideTip,
  vbPoint,
}: ChartContext): void {
  const W = 920;
  const Y0 = 392;
  const TOP = 28;
  const GMAX = 55;
  const py = (g: number) => Y0 - (g * (Y0 - TOP)) / GMAX;
  const xd = (i: number) => 90 + i * (790 / 13);
  const R = D.movementBandsMean.reduction;
  const C = D.movementBandsMean.comparison;
  const BASE = 46.5; // both group baseline means are ~46.3–46.6
  const FINAL = R.avg.m;
  const holder = $("chart-hero");
  const svg = mkSvg(holder, W, 445);

  for (let g = 0; g <= 50; g += 10) {
    E(
      "line",
      {
        x1: 56,
        y1: py(g),
        x2: 880,
        y2: py(g),
        stroke: "var(--grid)",
        "stroke-width": 1,
      },
      svg,
    );
    T(svg, 50, py(g) + 4, g ? `${g} g` : "0", {
      "text-anchor": "end",
      "font-size": 12,
      fill: "var(--mut)",
      class: "t-mono",
    });
  }
  for (let i = 0; i < 14; i++) {
    T(svg, xd(i), Y0 + 22, String(i + 1), {
      "text-anchor": "middle",
      "font-size": 12,
      fill: "var(--mut)",
      class: "t-mono",
    });
  }
  T(svg, xd(6.5), Y0 + 42, "day of the study →", {
    "text-anchor": "middle",
    "font-size": 12.5,
    fill: "var(--mut)",
  });

  /* reference lines: baseline + reduction final average */
  E(
    "line",
    {
      x1: 56,
      y1: py(BASE),
      x2: 880,
      y2: py(BASE),
      stroke: "var(--sub)",
      "stroke-width": 1.6,
      "stroke-dasharray": "6 5",
    },
    svg,
  );
  T(
    svg,
    60,
    py(BASE) - 9,
    "what both groups said they usually ate · about 46 g a day",
    { "font-size": 13, fill: "var(--sub)" },
  );
  T(svg, 884, py(BASE) + 4, "46 g", {
    "font-size": 11.5,
    fill: "var(--sub)",
    "font-weight": 650,
    class: "t-mono",
  });
  E(
    "line",
    {
      x1: 56,
      y1: py(FINAL),
      x2: 880,
      y2: py(FINAL),
      stroke: "var(--reduction)",
      "stroke-width": 1.4,
      "stroke-dasharray": "6 5",
      opacity: 0.9,
    },
    svg,
  );
  T(svg, 884, py(FINAL) + 4, "23 g", {
    "font-size": 11.5,
    fill: "var(--reduction)",
    "font-weight": 650,
    class: "t-mono",
  });
  T(
    svg,
    60,
    py(FINAL) + 52,
    "reduction group’s two-week average · 23 g (dashed)",
    { "font-size": 12.5, fill: "var(--reduction)" },
  );

  /* bands + lines */
  (
    [
      [R, "var(--reduction-soft)"],
      [C, "var(--comparison-soft)"],
    ] as const
  ).forEach(([G, col]) => {
    let d = `M${xd(0)} ${py(G.days[0].hi)}`;
    G.days.forEach((p, i) => {
      d += ` L${xd(i)} ${py(p.hi)}`;
    });
    for (let i = 13; i >= 0; i--) d += ` L${xd(i)} ${py(G.days[i].lo)}`;
    E("path", { d: `${d} Z`, fill: col }, svg);
  });
  (
    [
      [C, "var(--comparison)"],
      [R, "var(--reduction)"],
    ] as const
  ).forEach(([G, col]) => {
    let d = "";
    G.days.forEach((p, i) => {
      d += `${i ? " L" : "M"}${xd(i)} ${py(p.m)}`;
    });
    E(
      "path",
      {
        d,
        fill: "none",
        stroke: col,
        "stroke-width": 3,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      },
      svg,
    );
  });
  T(svg, 94, py(C.days[0].m) - 36, "comparison group", {
    "font-size": 12.5,
    "font-weight": 650,
    fill: "var(--comparison)",
  });
  T(svg, 94, py(R.days[0].m) + 34, "reduction group", {
    "font-size": 12.5,
    "font-weight": 650,
    fill: "var(--reduction)",
  });

  /* hover / keyboard */
  const cur = E("g", { opacity: 0 }, svg);
  const curLine = E(
    "line",
    { y1: TOP, y2: Y0, stroke: "var(--axis)", "stroke-width": 1.2 },
    cur,
  );
  const curR = E(
    "circle",
    {
      r: 4.5,
      fill: "var(--reduction)",
      stroke: "var(--surface)",
      "stroke-width": 1.5,
    },
    cur,
  );
  const curC = E(
    "circle",
    {
      r: 4.5,
      fill: "var(--comparison)",
      stroke: "var(--surface)",
      "stroke-width": 1.5,
    },
    cur,
  );
  let idx = -1;
  function setSlot(i: number, cx: number, cy: number) {
    idx = i;
    const r = R.days[i];
    const c = C.days[i];
    const x = xd(i);
    cur.setAttribute("opacity", "1");
    curLine.setAttribute("x1", String(x));
    curLine.setAttribute("x2", String(x));
    curR.setAttribute("cx", String(x));
    curR.setAttribute("cy", String(py(r.m)));
    curC.setAttribute("cx", String(x));
    curC.setAttribute("cy", String(py(c.m)));
    showTip(
      `<div class="tt-h">Day ${i + 1} · average logged day</div>` +
        `${dotHTML(REDT)}reduction: <b>${fmt(r.m)} g</b> (${fmt(r.lo)}–${fmt(r.hi)}) · ${r.n} logs<br>` +
        `${dotHTML(COMPT)}comparison: <b>${fmt(c.m)} g</b> (${fmt(c.lo)}–${fmt(c.hi)}) · ${c.n} logs`,
      cx,
      cy,
    );
    live.textContent =
      `Day ${i + 1}. Reduction average ${fmt(r.m)} grams (${fmt(r.lo)} to ${fmt(r.hi)}), ${r.n} logs. ` +
      `Comparison ${fmt(c.m)} grams (${fmt(c.lo)} to ${fmt(c.hi)}), ${c.n} logs.`;
  }
  function clear() {
    cur.setAttribute("opacity", "0");
    hideTip();
    idx = -1;
  }
  svg.addEventListener(
    "pointermove",
    (ev) => {
      const p = vbPoint(svg, ev, W);
      let best = 0;
      let bd = 1e9;
      for (let i = 0; i < 14; i++) {
        const d = Math.abs(xd(i) - p.x);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      setSlot(best, ev.clientX, ev.clientY);
    },
    { signal },
  );
  svg.addEventListener("pointerleave", clear, { signal });
  holder.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape") {
        clear();
        return;
      }
      let n: number | null = null;
      if (ev.key === "ArrowRight") n = idx < 0 ? 0 : Math.min(13, idx + 1);
      if (ev.key === "ArrowLeft") n = idx < 0 ? 13 : Math.max(0, idx - 1);
      if (ev.key === "Home") n = 0;
      if (ev.key === "End") n = 13;
      if (n === null) return;
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      setSlot(n, r.left + (xd(n) * r.width) / W, r.top + r.height * 0.4);
    },
    { signal },
  );
  holder.addEventListener("blur", clear, { signal });
}
