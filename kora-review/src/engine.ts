/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck
// The review UI, split by area into ./engine/*. Every area is a factory over
// one shared context: modules created earlier are read directly, and calls into
// later ones go through forwarding functions, so the order below matters only
// for the plain values one module reads from another.
import { createAnnotations } from "./engine/annotations.js";
import { createFeedback } from "./engine/feedback.js";
import { createFlow } from "./engine/flow.js";
import { createKeyboard } from "./engine/keyboard.js";
import { createMarkdownParser } from "./engine/markdown-parser.js";
import { createMarkdownRenderer } from "./engine/markdown-renderer.js";
import { createMath } from "./engine/math.js";
import { createModel } from "./engine/model.js";
import { createPresentation } from "./engine/presentation.js";
import { createQueue } from "./engine/queue.js";
import { createRanking } from "./engine/ranking.js";
import { createReview } from "./engine/review.js";
import { createRuntime } from "./engine/runtime.js";
import { createScreens } from "./engine/screens.js";
import { createSelection } from "./engine/selection.js";
import { createSheet } from "./engine/sheet.js";
import { createSurveys } from "./engine/surveys.js";
import type { KoraExport } from "./types.gen.js";

const AREAS = [
  createRuntime,
  createModel,
  createMath,
  createMarkdownParser,
  createMarkdownRenderer,
  createPresentation,
  createFeedback,
  createFlow,
  createScreens,
  createSurveys,
  createQueue,
  createReview,
  createAnnotations,
  createSelection,
  createRanking,
  createSheet,
  createKeyboard,
];

export function createEngine(
  host: HTMLElement,
  o: unknown,
): { buildExport: () => KoraExport; destroy: () => void } {
  const ctx = { host, o };
  for (const create of AREAS) Object.assign(ctx, create(ctx));
  ctx.start();
  return {
    buildExport: ctx.buildExport,
    destroy() {
      ctx.disconnectResize();
      ctx.teardown();
    },
  };
}
