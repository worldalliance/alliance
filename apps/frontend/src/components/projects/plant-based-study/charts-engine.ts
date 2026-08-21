// Chart engine for /interactive-results — ported from the standalone vis
// (interactive-vis/variations/v14-synthesis in the analysis repo). Framework-
// free DOM/SVG code; React mounts it once via useEffect. All listeners attach
// with an AbortSignal so effect cleanup (and StrictMode double-invoke) is safe;
// every chart clears its container before drawing.
import DATA from "./data.json";

type Attrs = Record<string, string | number>;
type CI = { m: number; lo: number; hi: number; n: number };
type Person = {
  c: number;
  g: string | null;
  a: string | null;
  pre: string | null;
  post: string | null;
};

const D = DATA as unknown as {
  movementBandsMean: Record<
    "reduction" | "comparison",
    { days: CI[]; base: CI; avg: CI }
  >;
  difficultyGap: { labels: string[]; counts: number[]; n: number };
  difficulties: { rows: { label: string; before: number; after: number }[] };
  predictorPeople: Person[];
  plan: { n: number; segments: { label: string; count: number }[] };
};

const NS = "http://www.w3.org/2000/svg";

function E<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}
function T(
  parent: Element,
  x: number,
  y: number,
  str: string,
  attrs?: Attrs,
): SVGTextElement {
  const t = E("text", { x, y, ...(attrs ?? {}) }, parent);
  t.textContent = str;
  return t;
}
function mkSvg(container: HTMLElement, w: number, h: number): SVGSVGElement {
  const s = E("svg", {
    viewBox: `0 0 ${w} ${h}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  container.appendChild(s);
  return s;
}
const fmt = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
};
const median = (a: number[]): number => {
  const s = a.slice().sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const dotHTML = (c: string) => `<span style="color:${c}">&#9679;</span> `;
const REDT = "#3ECF9F";
const COMPT = "#9FB0C1"; // tooltip-legible tints of the two arms

export function initCharts(signal: AbortSignal): void {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const tip = $("ir-tip");
  const live = $("ir-live");
  [
    "chart-hero",
    "chart-gap",
    "chart-who",
    "chart-dumbbell",
    "chart-plan",
  ].forEach((id) => $(id).replaceChildren());

  function showTip(html: string, cx: number, cy: number) {
    tip.innerHTML = html;
    tip.style.display = "block";
    const r = tip.getBoundingClientRect();
    let x = cx + 14;
    let y = cy + 16;
    if (x + r.width > innerWidth - 8) x = cx - r.width - 12;
    if (y + r.height > innerHeight - 8) y = cy - r.height - 14;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  function hideTip() {
    tip.style.display = "none";
  }
  function vbPoint(svg: SVGSVGElement, ev: PointerEvent, w: number) {
    const r = svg.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) * w) / r.width,
      y: ((ev.clientY - r.top) * w) / r.width,
    };
  }
  function wireRadios(
    containerId: string,
    onPick: (b: HTMLButtonElement) => void,
  ) {
    const btns = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        `#${containerId} button.chip`,
      ),
    );
    btns.forEach((b) =>
      b.addEventListener(
        "click",
        () => {
          btns.forEach((o) => {
            const on = String(o === b);
            o.setAttribute("aria-pressed", on);
            o.setAttribute("aria-checked", on);
          });
          onPick(b);
        },
        { signal },
      ),
    );
  }

  /* ================= 1 · HERO: means, day by day ================= */
  (function hero() {
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
  })();

  /* ================= 2 · surprise score ================= */
  (function gapChart() {
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
  })();

  /* ================= 3 · every split cut roughly half ================= */
  (function who() {
    const W = 920;
    const plotTop = 44;
    const plotBot = 428;
    const x = (v: number) => 120 + (v / 150) * 750;
    const PEOPLE = D.predictorPeople;
    const svg = mkSvg($("chart-who"), W, 490);

    /* fixed furniture */
    E(
      "rect",
      {
        x: x(0),
        y: plotTop,
        width: x(50) - x(0),
        height: plotBot - plotTop,
        fill: "var(--grid)",
        opacity: 0.45,
      },
      svg,
    );
    T(svg, x(25), plotTop - 8, "ate half or less", {
      "text-anchor": "middle",
      "font-size": 12,
      fill: "var(--sub)",
    });
    E(
      "line",
      {
        x1: x(81.6),
        y1: plotTop,
        x2: x(81.6),
        y2: plotBot,
        stroke: "var(--comparison)",
        "stroke-width": 1.4,
        "stroke-dasharray": "5 5",
      },
      svg,
    );
    T(svg, x(81.6), plotTop - 8, "comparison group's typical · 82%", {
      "text-anchor": "middle",
      "font-size": 12,
      fill: "var(--comparison)",
      "font-weight": 600,
    });
    E(
      "line",
      {
        x1: 120,
        y1: plotBot,
        x2: 870,
        y2: plotBot,
        stroke: "var(--axis)",
        "stroke-width": 1,
      },
      svg,
    );
    for (let t = 0; t <= 150; t += 25) {
      T(svg, x(t), plotBot + 20, `${t}%`, {
        "text-anchor": "middle",
        "font-size": 12,
        fill: "var(--mut)",
        class: "t-mono",
      });
    }
    T(svg, x(75), plotBot + 42, "share of their normal amount →", {
      "text-anchor": "middle",
      "font-size": 12.5,
      fill: "var(--mut)",
    });

    const rowFurniture = E("g", {}, svg); // rebuilt per mode
    const dotLayer = E("g", {}, svg); // persistent dots, moved per mode

    const MODES: Record<
      string,
      { groups: string[]; key: (p: Person) => string | null }
    > = {
      g: { groups: ["Women", "Men"], key: (p) => p.g },
      a: { groups: ["18–35", "36–55", "56+"], key: (p) => p.a },
      pre: {
        groups: ["Easy (1–2)", "Moderate (3)", "Hard (4–5)"],
        key: (p) => p.pre,
      },
      post: {
        groups: ["Easy (1–2)", "Moderate (3)", "Hard (4–5)"],
        key: (p) => p.post,
      },
    };
    const dots = PEOPLE.filter((p) => p.c <= 150).map((p) => {
      const el = E(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 4.2,
          fill: "var(--reduction)",
          "fill-opacity": 0.65,
          stroke: "var(--surface)",
          "stroke-width": 0.9,
          class: "person",
        },
        dotLayer,
      );
      return { p, el, tx: 0, ty: 0, groupName: "" };
    });

    function swarmInto(
      members: typeof dots,
      cy: number,
      r: number,
      maxOff: number,
    ) {
      const placed: { x: number; y: number }[] = [];
      members
        .slice()
        .sort((a, b) => a.p.c - b.p.c)
        .forEach((d) => {
          const px = x(d.p.c);
          let off: number | null = null;
          for (let k = 0; k < 44; k++) {
            const o = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (r * 2 + 1.2);
            if (Math.abs(o) > maxOff) break;
            const py2 = cy + o;
            if (
              !placed.some(
                (q) => (q.x - px) ** 2 + (q.y - py2) ** 2 < (r * 2 + 1) ** 2,
              )
            ) {
              off = o;
              break;
            }
          }
          const ty =
            off === null
              ? cy + ((Math.abs(px * 7) % (maxOff * 2)) - maxOff)
              : cy + off;
          placed.push({ x: px, y: ty });
          d.tx = px;
          d.ty = ty;
        });
    }

    function layout(modeId: string) {
      const mode = MODES[modeId];
      rowFurniture.textContent = "";
      const k = mode.groups.length;
      const bandH = (plotBot - plotTop) / k;
      const maxOff = k === 1 ? 66 : k === 2 ? 50 : 34;
      mode.groups.forEach((gname, gi) => {
        const cy = plotTop + bandH * (gi + 0.5);
        E(
          "line",
          {
            x1: 120,
            y1: cy,
            x2: 870,
            y2: cy,
            stroke: "var(--grid)",
            "stroke-width": 1,
          },
          rowFurniture,
        );
        const members = dots.filter((d) => mode.key(d.p) === gname);
        members.forEach((d) => {
          d.groupName = gname;
        });
        swarmInto(members, cy, 4.2, maxOff);
        const vals = PEOPLE.filter((p) => mode.key(p) === gname).map(
          (p) => p.c,
        );
        const m = median(vals);
        T(rowFurniture, 4, cy - 4, gname, {
          "font-size": 13.5,
          "font-weight": 650,
          fill: "var(--ink)",
        });
        T(rowFurniture, 4, cy + 13, `${vals.length} people`, {
          "font-size": 11,
          fill: "var(--mut)",
          class: "t-mono",
        });
        E(
          "line",
          {
            x1: x(m),
            y1: cy - maxOff - 8,
            x2: x(m),
            y2: cy + maxOff + 8,
            stroke: "var(--ink)",
            "stroke-width": 2.4,
          },
          rowFurniture,
        );
        T(rowFurniture, x(m), cy + maxOff + 24, `typical: ${Math.round(m)}%`, {
          "text-anchor": "middle",
          "font-size": 12.5,
          "font-weight": 650,
          fill: "var(--ink)",
        });
      });
      dots.forEach((d) => {
        const g = mode.key(d.p);
        const shown = g !== null && mode.groups.includes(g);
        d.el.style.opacity = shown ? "1" : "0";
        d.el.style.pointerEvents = shown ? "auto" : "none";
        if (shown) d.el.style.transform = `translate(${d.tx}px,${d.ty}px)`;
      });
      const NAMES: Record<string, string> = {
        g: "gender",
        a: "age",
        pre: "expected difficulty",
        post: "experienced difficulty",
      };
      live.textContent =
        `Now showing ${NAMES[modeId]}. ` +
        mode.groups
          .map((gname) => {
            const vals = PEOPLE.filter((p) => mode.key(p) === gname).map(
              (p) => p.c,
            );
            return `${gname}: typical ${Math.round(median(vals))} percent of normal`;
          })
          .join(". ") +
        ".";
    }
    layout("pre");
    wireRadios("who-controls", (b) => layout(b.dataset.mode as string));

    svg.addEventListener(
      "pointermove",
      (ev) => {
        const pt = vbPoint(svg, ev, W);
        let best: (typeof dots)[number] | null = null;
        let bd = 20 * 20;
        dots.forEach((d) => {
          if (d.el.style.opacity === "0") return;
          const dist = (d.tx - pt.x) ** 2 + (d.ty - pt.y) ** 2;
          if (dist < bd) {
            bd = dist;
            best = d;
          }
        });
        if (!best) {
          hideTip();
          return;
        }
        const hit = best as (typeof dots)[number];
        showTip(
          `<div class="tt-h">One person · ${hit.groupName}</div>ate <b>${Math.round(hit.p.c)}%</b> of their normal amount`,
          ev.clientX,
          ev.clientY,
        );
      },
      { signal },
    );
    svg.addEventListener("pointerleave", hideTip, { signal });
  })();

  /* ================= 4 · cravings dumbbell ================= */
  (function dumbbell() {
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
  })();

  /* ================= 5 · long-term intent ================= */
  (function plan() {
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
            p.x >= q.x &&
            p.x <= q.x + q.w &&
            p.y > BY - 10 &&
            p.y < BY + BH + 10,
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
  })();
}
