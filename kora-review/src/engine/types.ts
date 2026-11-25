import type {
  KoraCategory,
  KoraExitSurvey,
  KoraProfile,
  KoraResult,
  KoraTranscript as KoraTranscriptSource,
} from "../types.gen.js";

export type Safety = NonNullable<KoraResult["q1"]>;

export type Message = { role: "user" | "assistant"; content: string };

export type Transcript = {
  id: string;
  category: KoraCategory;
  hash: string;
  itemType: KoraTranscriptSource["itemType"];
  context: {
    title: string;
    childAge: number | null;
    childGender: string | null;
    background: string | null;
    scenario: string | null;
  };
  messages: Message[];
};

export type AnswerKey = "q1" | "q2_confidence" | "q3_severity" | "q4_text";

export type Answers = Partial<Pick<KoraResult, AnswerKey>>;

export type Result = Pick<
  KoraResult,
  | "transcriptId"
  | "category"
  | "contentHash"
  | "status"
  | "optedOut"
  | "optedOutAt"
  | "startedAt"
  | "completedAt"
  | "timeMs"
  | "pairPosition"
> & { answers: Answers };

export type Screen =
  | "boot"
  | "loading"
  | "profile"
  | "warning"
  | "review"
  | "exit"
  | "finish";

export type Token = {
  start: number;
  end: number;
  text: string;
  el: HTMLElement;
  blk: number;
};

/** One rendered message's words, grouped into on-screen lines for reactions. */
export type Words = {
  mi: number;
  tokens: Token[];
  gaps: Record<number, HTMLElement[]>;
  content: string;
};

/** A reply on the review screen, with its bubble. */
export type View = Words & { bubble: HTMLElement };

export enum ReactionKind {
  Up = "up",
  Down = "down",
  Notable = "notable",
}

/** A reaction on the on-screen line spanning UTF-16 offsets [start, end) of message `mi`'s text. */
export type Reaction = {
  mi: number;
  start: number;
  end: number;
  kind: ReactionKind;
};

/** One on-screen line of a reply: its first and last token, and where it sits relative to the bubble. */
export type Line = { first: number; last: number; top: number; bottom: number };

/** A run of 👎 lines in one reply, not broken by a 👍 or *; lines between them belong to it. */
export type Passage = {
  mi: number;
  turn: number;
  first: Line;
  last: Line;
  text: string;
};

export type PairDraft = {
  q1: Safety | null;
  confidence: number | null;
  severity: number | null;
  quote: Passage | null;
  /** More than one 👎 passage, so the quote is the first. */
  moreQuotes: boolean;
  reason: string;
};

export type State = {
  all: Transcript[];
  list: Transcript[];
  /** How many pairs the assignment asks for; more are fetched one at a time up to it. */
  size: number;
  /** The host has nothing more to give. */
  exhausted: boolean;
  results: Record<string, Result>;
  /** Reactions per transcript, saved with its result. */
  reactions: Record<string, Reaction[]>;
  screen: Screen;
  idx: number;
  views: Record<number, View>;
  /** The line keyboard focus is on, in a reply. */
  kbLine: { mi: number; line: number } | null;
  lastCategory: string | null;
  optOutCats: KoraCategory[];
  profile: KoraProfile | null;
  exitSurvey: KoraExitSurvey | null;
  isDone: boolean;
  coachDone: boolean;
  mounted: boolean;
  warned?: string;
};
