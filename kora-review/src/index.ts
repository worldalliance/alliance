// Public API of korabench-review: mount KORA's transcript review tool into a host page.
// The host owns identity, storage and networking. The tool reads only what it is given and writes only through save().
import { createEngine } from "./engine.js";
import { createSaver } from "./saver.js";
import { CATEGORY_IDS, SCHEMA_VERSION } from "./schemas.js";
import type { KoraExport, KoraTranscript } from "./types.gen.js";

export { exportSchema, SCHEMA_VERSION, transcriptSchema } from "./schemas.js";
export { KoraCategory } from "./types.gen.js";
export type {
  KoraAnnotation,
  KoraConversation,
  KoraExitSurvey,
  KoraExport,
  KoraProfile,
  KoraResult,
  KoraReviewer,
  KoraTranscript,
  KoraTurn,
} from "./types.gen.js";

export interface KoraReviewOptions {
  /** Opaque id the host generates. Never a name, email or phone number. */
  reviewerId: string;
  assignment: KoraAssignment;
  /** The last export the host stored for this assignment, or null on first open. */
  savedExport: KoraExport | null;
  /** Ask the profile questions. False once this reviewer has answered them. */
  collectProfile: boolean;
  /** Ask the exit survey when the assignment is complete. */
  collectExitSurvey: boolean;
  /** Persist the whole export. Rejects when the host refuses the save. */
  save: (exported: KoraExport) => Promise<void>;
  /** Called once, when every transcript is done or opted out and any exit survey is answered. */
  onComplete: () => void;
  /** Called when a save rejects and when a later save succeeds, so the host can show and clear its error. */
  onSaveStateChange: (state: KoraSaveState) => void;
}

export interface KoraAssignment {
  /** Identifies this assignment. The host generates it; it is echoed as the export's batchId. */
  batchId: string;
  transcripts: KoraAssignedTranscript[];
}

export interface KoraAssignedTranscript {
  transcript: KoraTranscript;
  /** sha256 of the transcript as the host stored it, formatted "sha256:<hex>". Echoed unchanged. */
  contentHash: string;
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
  for (const [i, m] of turns.entries()) {
    if (!m || typeof m !== "object") fail(`${where}[${i}] is not a turn.`);
    const { role, text } = m as { role?: unknown; text?: unknown };
    if (role !== "child" && role !== "ai")
      fail(`${where}[${i}].role must be "child" or "ai".`);
    if (typeof text !== "string") fail(`${where}[${i}].text must be a string.`);
    if (role === "ai") ai = true;
  }
  if (!ai) fail(`${where} has no ai turn to review.`);
}

// A light structural check so a mistake fails loudly at mount rather than mid-review.
// The host's server-side validation against transcriptSchema and exportSchema is the real contract check.
function validate(element: unknown, o: KoraReviewOptions): void {
  if (!element || (element as Node).nodeType !== 1)
    fail("element must be an HTMLElement.");
  if (!o || typeof o !== "object") fail("options are required.");
  if (typeof o.reviewerId !== "string" || !o.reviewerId.trim())
    fail("reviewerId must be a non-empty string.");
  for (const k of ["save", "onComplete", "onSaveStateChange"] as const) {
    if (typeof o[k] !== "function") fail(`${k} must be a function.`);
  }
  const a = o.assignment;
  if (!a || typeof a.batchId !== "string" || !a.batchId)
    fail("assignment.batchId must be a non-empty string.");
  if (!Array.isArray(a.transcripts) || a.transcripts.length === 0)
    fail("assignment.transcripts must be a non-empty array.");
  const seen = new Set<string>();
  for (const [i, item] of a.transcripts.entries()) {
    const where = `assignment.transcripts[${i}]`;
    if (!item || !item.transcript) fail(`${where}.transcript is missing.`);
    const t = item.transcript;
    if (typeof t.transcriptId !== "string" || !t.transcriptId)
      fail(`${where}.transcript.transcriptId must be a non-empty string.`);
    if (seen.has(t.transcriptId))
      fail(`transcriptId "${t.transcriptId}" appears twice in the assignment.`);
    seen.add(t.transcriptId);
    if (!CATEGORY_SET.has(t.category))
      fail(
        `${where}.transcript.category "${String(t.category)}" is not a known category.`,
      );
    if (typeof item.contentHash !== "string" || !HASH.test(item.contentHash))
      fail(`${where}.contentHash must look like "sha256:<64 hex digits>".`);
    checkTurns(t.conversationA, `${where}.transcript.conversationA`);
    checkTurns(t.conversationB, `${where}.transcript.conversationB`);
  }
  const s = o.savedExport;
  if (s != null) {
    if (s.schemaVersion !== SCHEMA_VERSION)
      fail(
        `savedExport.schemaVersion is ${String(s.schemaVersion)}, but this version of the tool reads ${SCHEMA_VERSION}.`,
      );
    if (s.batchId !== a.batchId)
      fail(
        `savedExport.batchId "${s.batchId}" does not match assignment.batchId "${a.batchId}".`,
      );
    if (!s.reviewer || s.reviewer.id !== o.reviewerId)
      fail("savedExport belongs to a different reviewerId.");
    if (!Array.isArray(s.results))
      fail("savedExport.results must be an array.");
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
  let engine: { buildExport: () => KoraExport; destroy: () => void } | null =
    null;

  const saver = createSaver<KoraExport>({
    build: () => {
      if (!engine) throw new Error("Not mounted.");
      return engine.buildExport();
    },
    save: (exported) => options.save(exported),
    onFailed: () => {
      if (!unmounted) options.onSaveStateChange(KoraSaveState.Failed);
    },
    onRecovered: () => {
      if (!unmounted) options.onSaveStateChange(KoraSaveState.Saved);
    },
  });

  // Completion saves first, then tells the host, once per mount, whether or not that save succeeded.
  // (A failed save is reported through onSaveStateChange and retried on the next change or flush().)
  const onComplete = () => {
    if (completed) return;
    completed = true;
    void Promise.resolve()
      .then(() => saver.flush())
      .catch(() => undefined)
      .then(() => {
        if (!unmounted) options.onComplete();
      });
  };

  engine = createEngine(element, {
    reviewerId: options.reviewerId,
    assignment: options.assignment,
    savedExport: options.savedExport,
    collectProfile: !!options.collectProfile,
    collectExitSurvey: !!options.collectExitSurvey,
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
