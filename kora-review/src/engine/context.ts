import type { KoraNext, KoraSession } from "../index.js";
import type { KoraCategory, KoraExport, KoraItem } from "../types.gen.js";
import type { createFeedbackForm } from "./feedback-form.js";
import type { createFeedback } from "./feedback.js";
import type { createFlow } from "./flow.js";
import type { createGuide } from "./guide.js";
import type { createHighlights } from "./highlights.js";
import type { createJudge } from "./judge.js";
import type { createMarkdownParser } from "./markdown-parser.js";
import type { createMarkdownRenderer } from "./markdown-renderer.js";
import type { createMath } from "./math.js";
import type { createModel } from "./model.js";
import type { createPractice } from "./practice.js";
import type { createPresentation } from "./presentation.js";
import type { createRead } from "./read.js";
import type { createRuntime } from "./runtime.js";
import type { createScreens } from "./screens.js";
import type { createSelection } from "./selection.js";
import type { createSheet } from "./sheet.js";
import type { SheetMode, SheetOpts } from "./types.js";

export type EngineOptions = {
  reviewerId: string;
  session: KoraSession;
  savedExport: KoraExport | null;
  next: () => Promise<KoraNext>;
  onOptOutRisk: (riskId: KoraCategory) => void;
  onOpenAccount: () => void;
  onChange: () => void;
  onComplete: (end: { again: boolean }) => void;
  onHidden: () => void;
};

/**
 * Functions a module calls in a module created after it, reached through
 * `late()` once the engine is built. The engine checks the finished context
 * against this, so each signature must match its module.
 */
export type Late = {
  closeSheet(): void;
  needsWarning(item: KoraItem): boolean;
  nudgeChoice(): void;
  openEdit(id: string): void;
  openSheet(mode: SheetMode, opts?: SheetOpts): void;
  renderComplete(): void;
  renderEmpty(): void;
  renderFeedbackForm(): void;
  renderHighlights(): void;
  renderJudge(): void;
  renderLoading(state: { failed: boolean }): void;
  renderPractice(): void;
  renderRead(): void;
  renderSel(): void;
  renderWarning(next: { then: string }): void;
  selRange(): [number, number];
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
export type FeedbackCtx = PresentationCtx & Api<typeof createPresentation>;
export type GuideCtx = FeedbackCtx & Api<typeof createFeedback>;
export type FlowCtx = GuideCtx & Api<typeof createGuide>;
export type ScreensCtx = FlowCtx & Api<typeof createFlow>;
export type FeedbackFormCtx = ScreensCtx & Api<typeof createScreens>;
export type ReadCtx = FeedbackFormCtx & Api<typeof createFeedbackForm>;
export type HighlightsCtx = ReadCtx & Api<typeof createRead>;
export type SelectionCtx = HighlightsCtx & Api<typeof createHighlights>;
export type JudgeCtx = SelectionCtx & Api<typeof createSelection>;
export type SheetCtx = JudgeCtx & Api<typeof createJudge>;
export type PracticeCtx = SheetCtx & Api<typeof createSheet>;
export type KeyboardCtx = PracticeCtx & Api<typeof createPractice>;
