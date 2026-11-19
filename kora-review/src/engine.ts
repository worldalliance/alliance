// The review UI, split by area into ./engine/*. Each area is a factory over the
// context the areas before it built; calls into later areas go through `late()`.
import type { EngineOptions, Late } from "./engine/context.js";
import { createFeedbackForm } from "./engine/feedback-form.js";
import { createFeedback } from "./engine/feedback.js";
import { createFlow } from "./engine/flow.js";
import { createGuide } from "./engine/guide.js";
import { createHighlights } from "./engine/highlights.js";
import { createJudge } from "./engine/judge.js";
import { createKeyboard } from "./engine/keyboard.js";
import { createMarkdownParser } from "./engine/markdown-parser.js";
import { createMarkdownRenderer } from "./engine/markdown-renderer.js";
import { createMath } from "./engine/math.js";
import { createModel } from "./engine/model.js";
import { createPractice } from "./engine/practice.js";
import { createPresentation } from "./engine/presentation.js";
import { createRead } from "./engine/read.js";
import { createRuntime } from "./engine/runtime.js";
import { createScreens } from "./engine/screens.js";
import { createSelection } from "./engine/selection.js";
import { createSheet } from "./engine/sheet.js";
import type { KoraExport } from "./types.gen.js";

export type Engine = {
  buildExport: () => KoraExport;
  remove: (ids: string[]) => void;
  destroy: () => void;
};

export function createEngine(host: HTMLElement, o: EngineOptions): Engine {
  let built: Late | null = null;
  const late = () => {
    if (!built) throw new Error("The review engine is still being built.");
    return built;
  };
  const c0 = { host, o, late };
  const c1 = { ...c0, ...createRuntime(c0) };
  const c2 = { ...c1, ...createModel(c1) };
  const cMath = { ...c2, ...createMath(c2) };
  const c3 = { ...cMath, ...createMarkdownParser(cMath) };
  const c4 = { ...c3, ...createMarkdownRenderer(c3) };
  const c5 = { ...c4, ...createPresentation(c4) };
  const c6 = { ...c5, ...createFeedback(c5) };
  const c7 = { ...c6, ...createGuide(c6) };
  const c8 = { ...c7, ...createFlow(c7) };
  const c9 = { ...c8, ...createScreens(c8) };
  const c10 = { ...c9, ...createFeedbackForm(c9) };
  const c11 = { ...c10, ...createRead(c10) };
  const c12 = { ...c11, ...createHighlights(c11) };
  const c13 = { ...c12, ...createSelection(c12) };
  const c14 = { ...c13, ...createJudge(c13) };
  const c15 = { ...c14, ...createSheet(c14) };
  const c16 = { ...c15, ...createPractice(c15) };
  const ctx = { ...c16, ...createKeyboard(c16) };
  built = ctx;
  ctx.start();
  return {
    buildExport: () => {
      ctx.flushTime();
      return ctx.buildExport();
    },
    remove: ctx.remove,
    destroy() {
      ctx.disconnectResize();
      ctx.teardown();
    },
  };
}
