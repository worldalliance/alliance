import type { KoraAssignedTranscript, KoraAssignment } from "../index.js";
import type { KoraCategory, KoraExport } from "../types.gen.js";
import type { createFlow } from "./flow.js";
import type { createMarkdownParser } from "./markdown-parser.js";
import type { createMarkdownRenderer } from "./markdown-renderer.js";
import type { createMath } from "./math.js";
import type { createModel } from "./model.js";
import type { createPresentation } from "./presentation.js";
import type { createRanking } from "./ranking.js";
import type { createReactionList } from "./reaction-list.js";
import type { createReactions } from "./reactions.js";
import type { createReview } from "./review.js";
import type { createRuntime } from "./runtime.js";
import type { createScreens } from "./screens.js";
import type { createStories } from "./stories.js";
import type { createSurveys } from "./surveys.js";
import type { Transcript } from "./types.js";

export type EngineOptions = {
  reviewerId: string;
  assignment: KoraAssignment;
  savedExport: KoraExport | null;
  collectProfile: boolean;
  collectExitSurvey: boolean;
  optOutCategories: KoraCategory[];
  next: () => Promise<KoraAssignedTranscript | null>;
  onChange: () => void;
  onComplete: () => void;
  onHidden: () => void;
};

/**
 * Functions a module calls in a module created after it, reached through
 * `late()` once the engine is built. The engine checks the finished context
 * against this, so each signature must match its module.
 */
export type Late = {
  closePicker(): void;
  needsWarning(t: Transcript): boolean;
  playOpener(): void;
  renderExit(): void;
  renderFinish(): void;
  renderLoading(state: { failed: boolean }): void;
  renderProfile(): void;
  renderRank(): void;
  renderReactionList(): void;
  renderReactions(): void;
  renderReview(slow?: boolean): void;
  renderWarning(next: { then: string }): void;
};

type Api<F extends (ctx: never) => unknown> = ReturnType<F>;

export type RuntimeCtx = {
  host: HTMLElement;
  o: EngineOptions;
  late: () => Late;
};
export type ModelCtx = RuntimeCtx & Api<typeof createRuntime>;
export type MathCtx = ModelCtx & Api<typeof createModel>;
export type MarkdownParserCtx = MathCtx & Api<typeof createMath>;
export type MarkdownRendererCtx = MarkdownParserCtx &
  Api<typeof createMarkdownParser>;
export type PresentationCtx = MarkdownRendererCtx &
  Api<typeof createMarkdownRenderer>;
export type StoriesCtx = PresentationCtx & Api<typeof createPresentation>;
export type FlowCtx = StoriesCtx & Api<typeof createStories>;
export type ScreensCtx = FlowCtx & Api<typeof createFlow>;
export type SurveysCtx = ScreensCtx & Api<typeof createScreens>;
export type ReviewCtx = SurveysCtx & Api<typeof createSurveys>;
export type ReactionsCtx = ReviewCtx & Api<typeof createReview>;
export type ReactionListCtx = ReactionsCtx & Api<typeof createReactions>;
export type RankingCtx = ReactionListCtx & Api<typeof createReactionList>;
export type KeyboardCtx = RankingCtx & Api<typeof createRanking>;
