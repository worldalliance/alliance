import type { ChartContext } from "./context";
import { D } from "./data";
import { E, T, mkSvg } from "./svg";

export function drawDumbbell({
  signal,
  $,
  showTip,
  hideTip,
  wireRadios,
}: ChartContext): void {
  const rows = D.difficulties.rows.slice();
  const ROW = 42;
  const TOP = 30;
  const W = 920;
  const H = TOP + rows.length * ROW + 52;
  const x = (v: number) => 260 + (v / 50) * 596;
  const svg = mkSvg($("chart-dumbbell"), W, H);
  T(svg, 884, TOP - 10, "change", {
    "text-anchor": "middle",
    "font-size": 11,
    fill: "var(--mut)",
    class: "t-mono",
  });
  for (let t = 0; t <= 50; t += 10) {
    E(
      "line",
      {
        x1: x(t),
        y1: TOP,
        x2: x(t),
        y2: TOP + rows.length * ROW,
        stroke: "var(--grid)",
        "stroke-width": 1,
      },
      svg,
    );
    T(svg, x(t), TOP + rows.length * ROW + 20, `${t}%`, {
      "text-anchor": "middle",
      "font-size": 12,
      fill: "var(--mut)",
      class: "t-mono",
    });
  }
  T(
    svg,
    x(25),
    TOP + rows.length * ROW + 40,
    "share of the group naming it →",
    { "text-anchor": "middle", "font-size": 12.5, fill: "var(--mut)" },
  );

  const showLabel = (l: string) =>
    l === "Getting enough protein" ? "Protein and nutrition" : l;
  const rowEls = rows.map((r) => {
    const g = E("g", { class: "drow" }, svg);
    const hit = E(
      "rect",
      { x: 0, y: -ROW / 2, width: W, height: ROW, fill: "transparent" },
      g,
    );
    T(g, 246, 4, showLabel(r.label), {
      "text-anchor": "end",
      "font-size": 13.5,
      fill: "var(--ink)",
    });
    E(
      "line",
      {
        x1: x(Math.min(r.before, r.after)),
        y1: 0,
        x2: x(Math.max(r.before, r.after)),
        y2: 0,
        stroke: "var(--axis)",
        "stroke-width": 2.4,
      },
      g,
    );
    E(
      "circle",
      {
        cx: x(r.before),
        cy: 0,
        r: 5,
        fill: "var(--axis)",
        stroke: "var(--surface)",
        "stroke-width": 1.4,
      },
      g,
    );
    E(
      "circle",
      {
        cx: x(r.after),
        cy: 0,
        r: 6,
        fill: "var(--reduction)",
        stroke: "var(--surface)",
        "stroke-width": 1.4,
      },
      g,
    );
    const d = Math.round(r.after - r.before);
    T(g, 884, 4, (d >= 0 ? "+" : "−") + Math.abs(d), {
      "text-anchor": "middle",
      "font-size": 12.5,
      "font-weight": 650,
      fill: d >= 0 ? "var(--ink)" : "var(--mut)",
      class: "t-mono",
    });
    if (r.label === "Cravings & taste") {
      T(g, (x(r.before) + x(r.after)) / 2, 19, "the biggest jump", {
        "text-anchor": "middle",
        "font-size": 12,
        fill: "var(--sub)",
        "font-style": "italic",
      });
    }
    return { g, hit, r };
  });

  function place(order: typeof rowEls) {
    order.forEach((re, i) => {
      re.g.style.transform = `translate(0px,${TOP + i * ROW + ROW / 2}px)`;
    });
  }
  const SORTS: Record<
    string,
    (a: (typeof rowEls)[number], b: (typeof rowEls)[number]) => number
  > = {
    after: (a, b) => b.r.after - a.r.after,
    change: (a, b) => b.r.after - b.r.before - (a.r.after - a.r.before),
    before: (a, b) => b.r.before - a.r.before,
  };
  place(rowEls.slice().sort(SORTS.after));
  wireRadios("dumbbell-controls", (b) =>
    place(rowEls.slice().sort(SORTS[b.dataset.sort as string])),
  );

  let hl: SVGRectElement | null = null;
  rowEls.forEach((re) => {
    re.hit.addEventListener(
      "pointermove",
      (ev) => {
        if (hl) hl.setAttribute("fill", "transparent");
        re.hit.setAttribute("fill", "var(--chip-bg)");
        hl = re.hit;
        showTip(
          `<div class="tt-h">${showLabel(re.r.label)}</div>expected by ${Math.round(re.r.before)}% → experienced by <b>${Math.round(re.r.after)}%</b>`,
          ev.clientX,
          ev.clientY,
        );
      },
      { signal },
    );
  });
  svg.addEventListener(
    "pointerleave",
    () => {
      hideTip();
      if (hl) {
        hl.setAttribute("fill", "transparent");
        hl = null;
      }
    },
    { signal },
  );
}
