// The review UI, split by area into ./engine/*. Each area is a factory over the
// context the areas before it built; calls into later areas go through `late()`.
import type { EngineOptions, Late } from "./engine/context.js";
import { createFlow } from "./engine/flow.js";
import { createKeyboard } from "./engine/keyboard.js";
import { createMarkdownParser } from "./engine/markdown-parser.js";
import { createMarkdownRenderer } from "./engine/markdown-renderer.js";
import { createMath } from "./engine/math.js";
import { createModel } from "./engine/model.js";
import { createPresentation } from "./engine/presentation.js";
import { createRanking } from "./engine/ranking.js";
import { createReactionList } from "./engine/reaction-list.js";
import { createReactions } from "./engine/reactions.js";
import { createReview } from "./engine/review.js";
import { createRuntime } from "./engine/runtime.js";
import { createScreens } from "./engine/screens.js";
import { createStories } from "./engine/stories.js";
import { createSurveys } from "./engine/surveys.js";
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
  const c3 = { ...c2, ...createMath(c2) };
  const c4 = { ...c3, ...createMarkdownParser(c3) };
  const c5 = { ...c4, ...createMarkdownRenderer(c4) };
  const c6 = { ...c5, ...createPresentation(c5) };
  const c7 = { ...c6, ...createStories(c6) };
  const c8 = { ...c7, ...createFlow(c7) };
  const c9 = { ...c8, ...createScreens(c8) };
  const c10 = { ...c9, ...createSurveys(c9) };
  const c11 = { ...c10, ...createReview(c10) };
  const c12 = { ...c11, ...createReactions(c11) };
  const c13 = { ...c12, ...createReactionList(c12) };
  const c14 = { ...c13, ...createRanking(c13) };
  const ctx = { ...c14, ...createKeyboard(c14) };
  built = ctx;
  ctx.start();
  return {
    buildExport: ctx.buildExport,
    remove: ctx.remove,
    destroy: ctx.teardown,
  };
}
