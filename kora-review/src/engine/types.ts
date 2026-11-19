import type {
  KoraCategory,
  KoraFeedback,
  KoraHighlight,
  KoraItem,
  KoraRating,
  KoraSkip,
} from "../types.gen.js";

export type Valence = NonNullable<KoraHighlight["valence"]>;
export type Reason = NonNullable<KoraHighlight["reason"]>;
export type Verdict = NonNullable<KoraRating["q1"]>;
export type Scale = 1 | 2 | 3 | 4;

/**
 * A highlight as the tool holds it: UTF-16 offsets into the turn's text, which is what the DOM gives.
 * The export converts them to the code-point offsets Annex D asks for; `text` is the same slice either way.
 */
export type Highlight = {
  id: string;
  turnIndex: number;
  start: number;
  end: number;
  text: string;
  valence: Valence;
  reason: Reason | null;
  createdAt: string;
  orphaned?: boolean;
};

export type Rating = {
  conversationId: string;
  riskId: KoraCategory;
  contentHash: string;
  kind: KoraItem["kind"];
  status: "reading" | "judging" | "done";
  position: number | null;
  firstTimeOnRisk: boolean;
  comprehensionAnswer: number | null;
  q1: Verdict | null;
  q2Confidence: Scale | null;
  q3Severity: Scale | null;
  q4Text: string | null;
  highlights: Highlight[];
  startedAt: string;
  readSubmittedAt: string | null;
  completedAt: string | null;
  timeMsRead: number;
  timeMsJudge: number;
  stale?: { moved: number; lost: number };
};

export type Screen =
  | "boot"
  | "loading"
  | "warning"
  | "read"
  | "judge"
  | "practice"
  | "feedback"
  | "complete"
  | "empty";

/** Why the host stopped giving conversations, once it has. */
export type Ended = "budget_spent" | "queue_empty";

export type Token = {
  start: number;
  end: number;
  text: string;
  el: HTMLElement;
  blk: number;
  hl?: Highlight | null;
};

/** One rendered AI turn's words, for selecting and marking them. */
export type Words = {
  mi: number;
  tokens: Token[];
  gaps: Record<number, HTMLElement[]>;
  content: string;
};

export type View = Words & { bubble: HTMLElement };

/** Token indexes within one turn. */
export type Selection = { mi: number; anchor: number; focus: number };

export type SheetMode = "new" | "edit";
export type SheetOpts = { kb?: boolean };
export type SheetState = { mode: SheetMode } & SheetOpts;

export type State = {
  items: KoraItem[];
  ratings: Record<string, Rating>;
  history: Record<string, Highlight[][]>;
  skips: KoraSkip[];
  feedback: KoraFeedback | null;
  screen: Screen;
  idx: number;
  views: Record<number, View>;
  sel: Selection | null;
  editing: string | null;
  sheet: SheetState | null;
  guideOpen: boolean;
  ended: Ended | null;
  isDone: boolean;
  /** The conversation whose content warning the reviewer has already answered. */
  warned: string | null;
  mounted: boolean;
};
