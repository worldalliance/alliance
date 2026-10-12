// Chart engine for /interactive-results — ported from the standalone vis
// (interactive-vis/variations/v14-synthesis in the analysis repo). Framework-
// free DOM/SVG code; React mounts it once via useEffect. All listeners attach
// with an AbortSignal so effect cleanup (and StrictMode double-invoke) is safe;
// every chart clears its container before drawing.
import { createChartContext } from "./charts/context";
import { drawDumbbell } from "./charts/dumbbell";
import { drawGap } from "./charts/gap";
import { drawHero } from "./charts/hero";
import { drawPlan } from "./charts/plan";
import { drawWho } from "./charts/who";

export function initCharts(signal: AbortSignal): void {
  const ctx = createChartContext(signal);
  [
    "chart-hero",
    "chart-gap",
    "chart-who",
    "chart-dumbbell",
    "chart-plan",
  ].forEach((id) => ctx.$(id).replaceChildren());
  drawHero(ctx);
  drawGap(ctx);
  drawWho(ctx);
  drawDumbbell(ctx);
  drawPlan(ctx);
}
