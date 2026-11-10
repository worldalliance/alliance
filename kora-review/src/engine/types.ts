import type {
  KoraAnnotation,
  KoraCategory,
  KoraExitSurvey,
  KoraProfile,
  KoraResult,
} from "../types.gen.js";

export type Side = "a" | "b";
export type Safety = NonNullable<KoraResult["q0_a"]>;
export type Strength = "clearly" | "somewhat";

export type Message = { role: "user" | "assistant"; content: string };

/** A pair as the engine holds it: A's turns then B's in one message list. */
export type Transcript = {
  id: string;
  category: KoraCategory;
  hash: string;
  challenge: string;
  tagline: string | null;
  pairType: string | null;
  context: {
    title: string;
    childAge: number | null;
    background: string;
    scenario: string;
  };
  messages: Message[];
  pair: { na: number };
};

/** An annotation with messageIndex into the combined message list. */
export type Annotation = Pick<
  KoraAnnotation,
  "id" | "start" | "end" | "text" | "value" | "createdAt" | "note" | "orphaned"
> & { messageIndex: number };

export type AnswerKey = "q0_a" | "q0_b" | "q1" | "q2_turn" | "q3_text";

export type Answers = Partial<Pick<KoraResult, AnswerKey>>;

/** "clearly_a" as its strength and side. */
export function q1Parts(q1: NonNullable<KoraResult["q1"]>): {
  strength: Strength;
  side: Side;
} {
  const [strength, side] = q1.split("_");
  return {
    strength: strength === "clearly" ? "clearly" : "somewhat",
    side: side === "a" ? "a" : "b",
  };
}

export type Result = Pick<
  KoraResult,
  | "transcriptId"
  | "category"
  | "contentHash"
  | "status"
  | "optedOut"
  | "netSum"
  | "plusCount"
  | "minusCount"
  | "startedAt"
  | "completedAt"
  | "timeMs"
  | "pairPosition"
  | "stale"
> & { answers: Answers; annotations: Annotation[] };

export type Screen =
  | "boot"
  | "welcome"
  | "profile"
  | "queue"
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
  ann?: Annotation | null;
};

/** One rendered message's words, for selecting and marking them. */
export type View = {
  mi: number;
  tokens: Token[];
  gaps: Record<number, HTMLElement[]>;
  content: string;
  bubble?: HTMLElement;
};

/** Token indexes within one message. */
export type Selection = { mi: number; anchor: number; focus: number };

export type PairDraft = {
  q0: Partial<Record<Side, Safety>>;
  q1: { side: Side; strength: Strength } | null;
  turn: number | "none" | null;
  reason: string;
  reasonEdited: boolean;
};

export type SheetMode = "new" | "edit" | "note" | "noteprompt" | "confirm";

export type SheetOpts = { kb?: boolean; annId?: string; d?: PairDraft };

export type SheetState = { mode: SheetMode } & SheetOpts;

export type State = {
  all: Transcript[];
  list: Transcript[];
  results: Record<string, Result>;
  history: Record<string, Annotation[][]>;
  screen: Screen;
  idx: number;
  filter: {
    status: "all" | "pending" | "done";
    category: KoraCategory | "all";
  };
  views: Record<number, View>;
  sel: Selection | null;
  editing: string | null;
  sheet: SheetState | null;
  noteDraft: string;
  lastChallenge: string | null;
  optOutCats: KoraCategory[];
  profile: KoraProfile | null;
  exitSurvey: KoraExitSurvey | null;
  isDone: boolean;
  coachDone: boolean;
  mounted: boolean;
  warned?: string;
};
