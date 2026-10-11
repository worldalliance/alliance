import type { ChartContext } from "./context";
import { D, type Person } from "./data";
import { E, T, mkSvg } from "./svg";

const median = (a: number[]): number => {
  const s = a.slice().sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function drawWho({
  signal,
  $,
  live,
  showTip,
  hideTip,
  vbPoint,
  wireRadios,
}: ChartContext): void {
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
      const vals = PEOPLE.filter((p) => mode.key(p) === gname).map((p) => p.c);
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
}
