import type { KoraAssignment } from "../index.js";
import type { KoraExport } from "../types.gen.js";
import type { createAnnotations } from "./annotations.js";
import type { createFeedback } from "./feedback.js";
import type { createFlow } from "./flow.js";
import type { createMarkdownParser } from "./markdown-parser.js";
import type { createMarkdownRenderer } from "./markdown-renderer.js";
import type { createMath } from "./math.js";
import type { createModel } from "./model.js";
import type { createPresentation } from "./presentation.js";
import type { createQueue } from "./queue.js";
import type { createRanking } from "./ranking.js";
import type { createReview } from "./review.js";
import type { createRuntime } from "./runtime.js";
import type { createScreens } from "./screens.js";
import type { createSelection } from "./selection.js";
import type { createSheet } from "./sheet.js";
import type { createSurveys } from "./surveys.js";
import type { SheetMode, SheetOpts, Transcript } from "./types.js";

export type EngineOptions = {
  reviewerId: string;
  assignment: KoraAssignment;
  savedExport: KoraExport | null;
  collectProfile: boolean;
  collectExitSurvey: boolean;
  onChange: () => void;
  onComplete: () => void;
  onHidden: () => void;
};

export type Base = { host: HTMLElement; o: EngineOptions };

/**
 * Functions a module calls in a module created after it. The engine checks
 * the finished context against this, so each signature must match its module.
 */
export type Late = {
  closeSheet(): void;
  focusNote(): void;
  needsWarning(t: Transcript): boolean;
  openSheet(mode: SheetMode, opts?: SheetOpts): void;
  promptNote(id: string): void;
  renderAnns(): void;
  renderExit(): void;
  renderFinish(): void;
  renderProfile(): void;
  renderQueue(): void;
  renderReview(): void;
  renderSel(): void;
  renderSheet(): void;
  renderWarning(next: { then: string }): void;
  renderWelcome(): void;
  selRange(): [number, number];
  syncSheetH(): void;
  undo(): void;
};

type Api<F extends (ctx: never) => unknown> = ReturnType<F>;

export type RuntimeCtx = Base & Late;
export type ModelCtx = RuntimeCtx & Api<typeof createRuntime>;
export type MathCtx = ModelCtx & Api<typeof createModel>;
export type MarkdownParserCtx = MathCtx & Api<typeof createMath>;
export type MarkdownRendererCtx = MarkdownParserCtx &
  Api<typeof createMarkdownParser>;
export type PresentationCtx = MarkdownRendererCtx &
  Api<typeof createMarkdownRenderer>;
export type FeedbackCtx = PresentationCtx & Api<typeof createPresentation>;
export type FlowCtx = FeedbackCtx & Api<typeof createFeedback>;
export type ScreensCtx = FlowCtx & Api<typeof createFlow>;
export type SurveysCtx = ScreensCtx & Api<typeof createScreens>;
export type QueueCtx = SurveysCtx & Api<typeof createSurveys>;
export type ReviewCtx = QueueCtx & Api<typeof createQueue>;
export type AnnotationsCtx = ReviewCtx & Api<typeof createReview>;
export type SelectionCtx = AnnotationsCtx & Api<typeof createAnnotations>;
export type RankingCtx = SelectionCtx & Api<typeof createSelection>;
export type SheetCtx = RankingCtx & Api<typeof createRanking>;
export type KeyboardCtx = SheetCtx & Api<typeof createSheet>;
