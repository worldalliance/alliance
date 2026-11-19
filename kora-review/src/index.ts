// Public API of the KORA review tool: mount one review session into a host page.
// The host owns identity, storage and networking. The tool reads only what it is given and writes only through save().
import { createEngine, type Engine } from "./engine.js";
import { createSaver } from "./saver.js";
import { CATEGORY_IDS, SCHEMA_VERSION } from "./schemas.js";
import type { KoraCategory, KoraExport, KoraItem } from "./types.gen.js";

export { exportSchema, itemSchema, SCHEMA_VERSION } from "./schemas.js";
export { KoraCategory } from "./types.gen.js";
export type {
  KoraComprehension,
  KoraConversation,
  KoraExport,
  KoraFeedback,
  KoraHighlight,
  KoraItem,
  KoraRating,
  KoraReference,
  KoraReviewer,
  KoraSkip,
  KoraTurn,
} from "./types.gen.js";

export interface KoraSession {
  /** Identifies this session. The host generates it; it is echoed as the export's sessionId. */
  id: string;
  /** 1-based for this reviewer. The first session carries the practice conversations. */
  number: number;
  /** What the session may spend: 5.0 in the review, against each item's weightUnits. */
  budgetUnits: number;
  /** The conversations given so far, in the order to show them; the rest come from `next`. */
  items: KoraItem[];
}

/** The next conversation, or why there isn't one. */
export type KoraNext =
  | { item: KoraItem }
  | { done: "budget_spent" | "queue_empty" };

export interface KoraReviewOptions {
  /** Opaque id the host generates. Never a name, email or phone number. */
  reviewerId: string;
  session: KoraSession;
  /** The last export the host stored for this session, or null on first open. */
  savedExport: KoraExport | null;
  /**
   * Persist the whole export. Rejects when the host refuses the save. May
   * resolve with conversations the host took out of the session, which the
   * tool drops without a word.
   */
  save: (exported: KoraExport) => Promise<KoraSaveResult | void>;
  /** Give the reviewer their next conversation. Called after the current ones are saved. */
  next: () => Promise<KoraNext>;
  /** The reviewer asked not to be shown this risk again, from a content warning. */
  onOptOutRisk: (riskId: KoraCategory) => void;
  /** The reviewer asked for their account page; the tool never navigates. */
  onOpenAccount: () => void;
  /** Called once, when the session is over. `again` is the reviewer asking for another one. */
  onComplete: (end: { again: boolean }) => void;
  /** Called when a save rejects and when a later save succeeds, so the host can show and clear its error. */
  onSaveStateChange: (state: KoraSaveState) => void;
}

export interface KoraSaveResult {
  /** Conversation ids no longer in the session. */
  removed: string[];
}

export enum KoraSaveState {
  Saved = "saved",
  Failed = "failed",
}

export interface KoraReviewHandle {
  /** Flush any pending save immediately, for example before the host navigates away. Rejects if that save fails. */
  flush: () => Promise<void>;
  /** Remove the tool and its listeners. Changes not yet saved are dropped, so call flush() first. */
  unmount: () => void;
}

const HASH = /^sha256:[0-9a-f]{64}$/;
const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_IDS);

function fail(msg: string): never {
  throw new TypeError(`mountKoraReview: ${msg}`);
}

function checkTurns(turns: unknown, where: string): void {
  if (!Array.isArray(turns) || turns.length === 0)
    fail(`${where} must be a non-empty array of turns.`);
  let ai = false;
  for (const [i, turn] of turns.entries()) {
    if (!turn || typeof turn !== "object")
      fail(`${where}[${i}] is not a turn.`);
    const { role, text } = turn as { role?: unknown; text?: unknown };
    if (role !== "child" && role !== "ai")
      fail(`${where}[${i}].role must be "child" or "ai".`);
    if (typeof text !== "string") fail(`${where}[${i}].text must be a string.`);
    if (role === "ai") ai = true;
  }
  if (!ai) fail(`${where} has no ai turn to judge.`);
}

function checkItem(item: KoraItem, where: string): void {
  if (!item || typeof item !== "object") fail(`${where} is missing.`);
  if (typeof item.conversationId !== "string" || !item.conversationId)
    fail(`${where}.conversationId must be a non-empty string.`);
  if (!CATEGORY_SET.has(item.riskId))
    fail(`${where}.riskId "${String(item.riskId)}" is not a known risk.`);
  if (typeof item.contentHash !== "string" || !HASH.test(item.contentHash))
    fail(`${where}.contentHash must look like "sha256:<64 hex digits>".`);
  if (item.kind !== "practice" && item.kind !== "rated")
    fail(`${where}.kind must be "practice" or "rated".`);
  if (typeof item.weightUnits !== "number" || !(item.weightUnits >= 0))
    fail(`${where}.weightUnits must be a number of load units.`);
  if (item.comprehension && item.comprehension.options.length !== 4)
    fail(`${where}.comprehension must offer exactly four options.`);
  if (item.kind === "practice" && !item.reference)
    fail(`${where} is a practice conversation with no reference answer.`);
  checkTurns(item.conversation, `${where}.conversation`);
}

// A light structural check so a mistake fails loudly at mount rather than mid-review.
// The host's server-side validation against itemSchema and exportSchema is the real contract check.
function validate(element: unknown, o: KoraReviewOptions): void {
  if (!element || (element as Node).nodeType !== 1)
    fail("element must be an HTMLElement.");
  if (!o || typeof o !== "object") fail("options are required.");
  if (typeof o.reviewerId !== "string" || !o.reviewerId.trim())
    fail("reviewerId must be a non-empty string.");
  for (const k of [
    "save",
    "next",
    "onOptOutRisk",
    "onOpenAccount",
    "onComplete",
    "onSaveStateChange",
  ] as const) {
    if (typeof o[k] !== "function") fail(`${k} must be a function.`);
  }
  const session = o.session;
  if (!session || typeof session.id !== "string" || !session.id)
    fail("session.id must be a non-empty string.");
  if (!Number.isInteger(session.number) || session.number < 1)
    fail("session.number must be a positive integer.");
  if (typeof session.budgetUnits !== "number" || session.budgetUnits <= 0)
    fail("session.budgetUnits must be a positive number of load units.");
  if (!Array.isArray(session.items)) fail("session.items must be an array.");
  const seen = new Set<string>();
  for (const [i, item] of session.items.entries()) {
    checkItem(item, `session.items[${i}]`);
    if (seen.has(item.conversationId))
      fail(
        `conversationId "${item.conversationId}" appears twice in the session.`,
      );
    seen.add(item.conversationId);
  }
  const saved = o.savedExport;
  if (saved != null) {
    if (saved.schemaVersion !== SCHEMA_VERSION)
      fail(
        `savedExport.schemaVersion is ${String(saved.schemaVersion)}, but this version of the tool reads ${SCHEMA_VERSION}.`,
      );
    if (saved.sessionId !== session.id)
      fail(
        `savedExport.sessionId "${saved.sessionId}" does not match session.id "${session.id}".`,
      );
    if (!saved.reviewer || saved.reviewer.id !== o.reviewerId)
      fail("savedExport belongs to a different reviewerId.");
    if (!Array.isArray(saved.ratings))
      fail("savedExport.ratings must be an array.");
  }
}

/**
 * Mount the review tool inside `element`. The tool adds one child element and removes it on unmount; it never
 * touches the rest of the page, never navigates, and stores nothing in the browser.
 */
export function mountKoraReview(
  element: HTMLElement,
  options: KoraReviewOptions,
): KoraReviewHandle {
  validate(element, options);
  let unmounted = false;
  let completed = false;
  let engine: Engine | null = null;

  const saver = createSaver<KoraExport>({
    build: () => {
      if (!engine) throw new Error("Not mounted.");
      return engine.buildExport();
    },
    save: async (exported) => {
      const saved = await options.save(exported);
      if (saved && saved.removed.length > 0 && !unmounted) {
        engine?.remove(saved.removed);
      }
    },
    onFailed: () => {
      if (!unmounted) options.onSaveStateChange(KoraSaveState.Failed);
    },
    onRecovered: () => {
      if (!unmounted) options.onSaveStateChange(KoraSaveState.Saved);
    },
  });

  // Completion saves first, then tells the host, once per mount, whether or not that save succeeded.
  // (A failed save is reported through onSaveStateChange and retried on the next change or flush().)
  const onComplete = (end: { again: boolean }) => {
    if (completed) return;
    completed = true;
    void Promise.resolve()
      .then(() => saver.flush())
      .catch(() => undefined)
      .then(() => {
        if (!unmounted) options.onComplete(end);
      });
  };

  engine = createEngine(element, {
    reviewerId: options.reviewerId,
    session: options.session,
    savedExport: options.savedExport,
    next: async () => {
      await saver.flush();
      const next = await options.next();
      if ("item" in next) checkItem(next.item, "next().item");
      return next;
    },
    onOptOutRisk: options.onOptOutRisk,
    onOpenAccount: options.onOpenAccount,
    onChange: () => saver.changed(),
    onComplete,
    // The page is being hidden (tab switch, app backgrounded, webview closing): save now rather than in 2 s.
    onHidden: () => {
      if (saver.dirty) saver.flush().catch(() => undefined);
    },
  });

  return {
    flush: () => (unmounted ? Promise.resolve() : saver.flush()),
    unmount() {
      if (unmounted) return;
      unmounted = true;
      saver.dispose();
      engine?.destroy();
      engine = null;
    },
  };
}
