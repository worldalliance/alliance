import { CATEGORIES } from "../categories.js";
import type { KoraAssignedTranscript, KoraTurn } from "../index.js";
import { SCHEMA_VERSION } from "../schemas.js";
import type { KoraExport, KoraReaction, KoraResult } from "../types.gen.js";
import type { ModelCtx } from "./context.js";
import {
  ReactionKind,
  type AnswerKey,
  type Message,
  type Result,
  type Safety,
  type State,
  type Transcript,
} from "./types.js";

const Q0_LABEL: Record<Safety, string> = {
  ok: "Safe",
  not_ok: "Unsafe",
};
const STAMP_CLS: Record<Safety, string> = {
  ok: "v-pos",
  not_ok: "v-neg",
};

// Saved offsets count Unicode code points over the turn's text, as KORA reads it; the tool works in UTF-16.
const codePoints = (s: string, utf16: number) => [...s.slice(0, utf16)].length;
const utf16At = (s: string, points: number) =>
  [...s].slice(0, points).join("").length;
const KIND: Record<KoraReaction["kind"], ReactionKind> = {
  up: ReactionKind.Up,
  down: ReactionKind.Down,
  notable: ReactionKind.Notable,
};

export function createModel(ctx: ModelCtx) {
  const { o } = ctx;

  const iso = () => new Date().toISOString();
  const clamp = (x: number, a: number, b: number) =>
    Math.max(a, Math.min(b, x));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const CAT = new Map<string, (typeof CATEGORIES)[number]>(
    CATEGORIES.map((c) => [c.id, c]),
  );
  const CAT_ORDER: string[] = CATEGORIES.map((c) => c.id);
  const hueOf = (s: string) => {
    const i = CAT_ORDER.indexOf(s);
    if (i >= 0) return Math.round((i * 360) / CAT_ORDER.length);
    let x = 0;
    for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return x % 360;
  };
  const catLabel = (id: string) => CAT.get(id)?.label || id;
  /* ---------- Transcripts from the assignment ---------- */
  const toMsgs = (turns: KoraTurn[]): Message[] =>
    turns.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }));
  const toTranscript = ({
    transcript: x,
    contentHash,
  }: KoraAssignedTranscript): Transcript => ({
    id: x.transcriptId,
    category: x.category,
    hash: contentHash,
    itemType: x.itemType,
    context: {
      title: x.scenarioTitle || "",
      childAge: x.childAge ?? null,
      childGender: x.childGender?.trim() || null,
      background: x.childBackground?.trim() || null,
      scenario: x.scenario?.trim() || null,
    },
    messages: toMsgs(x.conversation),
  });
  const ALL = o.assignment.transcripts.map(toTranscript);

  /* ---------- State ---------- */
  const S: State = {
    all: ALL,
    list: [...ALL],
    size: o.assignment.size,
    exhausted: false,
    results: {},
    reactions: {},
    screen: "boot",
    idx: 0,
    views: {},
    kbLine: null,
    lastCategory: null,
    optOutCats: [...o.optOutCategories],
    profile: null,
    exitSurvey: null,
    isDone: false,
    coachDone: false,
    mounted: false,
  };
  const cur = () => S.list[S.idx];
  function transcript(id: string): Transcript {
    const t = S.all.find((x) => x.id === id);
    if (!t) throw new Error(`No transcript ${id} in this assignment.`);
    return t;
  }
  function category(id: string) {
    const c = CAT.get(id);
    if (!c) throw new Error(`Unknown category ${id}.`);
    return c;
  }
  function blankResult(t: Transcript): Result {
    return {
      transcriptId: t.id,
      category: t.category,
      contentHash: t.hash,
      status: "pending",
      optedOut: false,
      startedAt: null,
      completedAt: null,
      timeMs: 0,
      answers: {},
    };
  }
  const res = (t: Transcript) => S.results[t.id] || blankResult(t);
  const ensure = (t: Transcript) => (S.results[t.id] ||= blankResult(t));
  // The AI turn (1-based) that message mi is.
  const aiTurn = (t: Transcript, mi: number) =>
    t.messages.slice(0, mi + 1).filter((m) => m.role === "assistant").length;
  const aiTurns = (t: Transcript) =>
    t.messages.filter((m) => m.role === "assistant").length;
  // How a saved conversation reads on the finish screen: the reviewer's safety answer.
  function callOf(r: Result): { text: string; cls: string } {
    if (r.optedOut && r.status !== "done")
      return { text: "Skipped", cls: "dim" };
    const q1 = r.answers.q1;
    if (!q1) return { text: "Done", cls: "dim" };
    return { text: Q0_LABEL[q1], cls: STAMP_CLS[q1] };
  }
  /** Copies one answer when it holds a value; generic, so each key keeps its own type. */
  function copyAnswer<K extends AnswerKey>(
    to: Partial<Pick<KoraResult, AnswerKey>>,
    from: Partial<Pick<KoraResult, AnswerKey>>,
    k: K,
  ) {
    const v = from[k];
    if (v != null && v !== "") to[k] = v;
  }
  /** Restoring keeps an empty answer, which exporting leaves out. */
  function restoreAnswer<K extends AnswerKey>(
    to: Partial<Pick<KoraResult, AnswerKey>>,
    from: Partial<Pick<KoraResult, AnswerKey>>,
    k: K,
  ) {
    const v = from[k];
    if (v != null) to[k] = v;
  }
  const reviewed = (r: Result) => r.status === "done" || r.optedOut;
  const reviewedCount = () => S.all.filter((t) => reviewed(res(t))).length;
  const needsMore = () => !S.exhausted && S.all.length < S.size;
  const allReviewed = () =>
    !needsMore() && S.all.every((t) => reviewed(res(t)));
  // Only unreviewed pairs open, so the current pair is always reviewed + 1.
  const progressText = () =>
    allReviewed()
      ? `${S.all.length} of ${S.all.length} reviewed`
      : `${reviewedCount() + 1} of ${S.size}`;

  /* ---------- Restore from the host's saved export ---------- */
  const ANSWER_KEYS = [
    "q1",
    "q2_confidence",
    "q3_severity",
    "q4_text",
  ] as const satisfies readonly AnswerKey[];
  function restore(saved: KoraExport | null) {
    if (!saved) return;
    const byId = new Map((saved.results || []).map((r) => [r.transcriptId, r]));
    for (const t of S.all) {
      const e = byId.get(t.id);
      if (!e) continue;
      const r = blankResult(t);
      r.contentHash = e.contentHash || t.hash;
      r.status = e.status === "done" ? "done" : "pending";
      r.optedOut = !!e.optedOut;
      if (e.optedOutAt) r.optedOutAt = e.optedOutAt;
      r.startedAt = e.startedAt || null;
      r.completedAt = e.completedAt || null;
      r.timeMs = e.timeMs || 0;
      for (const k of ANSWER_KEYS) restoreAnswer(r.answers, e, k);
      if (e.pairPosition != null) r.pairPosition = e.pairPosition;
      S.results[t.id] = r;
      S.reactions[t.id] = (e.reactions ?? []).flatMap((x) => {
        const m = t.messages[x.turnIndex];
        if (!m) return [];
        const start = utf16At(m.content, x.charStart),
          end = utf16At(m.content, x.charEnd);
        return [{ mi: x.turnIndex, start, end, kind: KIND[x.kind] }];
      });
    }
    S.optOutCats = [
      ...new Set([...o.optOutCategories, ...saved.optOutCategories]),
    ];
    S.profile = saved.profile ? clone(saved.profile) : null;
    S.exitSurvey = saved.exitSurvey ? clone(saved.exitSurvey) : null;
    S.isDone = !!saved.isDone;
    S.coachDone = S.all.some(
      (t) => Object.keys(res(t).answers).length || S.reactions[t.id]?.length,
    );
  }
  const refreshList = () => {
    S.list = S.all.filter((t) => !res(t).optedOut || res(t).status === "done");
  };
  function addTranscript(item: KoraAssignedTranscript): Transcript {
    const t = toTranscript(item);
    S.all.push(t);
    refreshList();
    return t;
  }
  function removeTranscripts(ids: string[]) {
    const gone = new Set(ids);
    S.all = S.all.filter((t) => !gone.has(t.id));
    for (const id of gone) {
      delete S.results[id];
      delete S.reactions[id];
    }
    refreshList();
  }

  function reactionsOf(t: Transcript): KoraReaction[] {
    return [...(S.reactions[t.id] ?? [])]
      .sort((a, b) => a.mi - b.mi || a.start - b.start)
      .map((x) => {
        const text = t.messages[x.mi]?.content ?? "";
        return {
          turnIndex: x.mi,
          charStart: codePoints(text, x.start),
          charEnd: codePoints(text, x.end),
          text: text.slice(x.start, x.end),
          kind: x.kind,
        };
      });
  }
  /* ---------- Export: everything, in the shape exportSchema describes ---------- */
  function buildExport(): KoraExport {
    return {
      schemaVersion: SCHEMA_VERSION,
      batchId: o.assignment.batchId,
      reviewer: { id: o.reviewerId },
      exportedAt: iso(),
      currentTranscriptId: S.screen === "review" && cur() ? cur().id : null,
      results: S.all.map((t) => {
        const r = res(t);
        const out: KoraResult = {
          transcriptId: t.id,
          category: t.category,
          contentHash: t.hash,
          status: r.status,
          optedOut: !!r.optedOut,
          ...(r.optedOutAt ? { optedOutAt: r.optedOutAt } : {}),
          score: null,
          startedAt: r.startedAt || null,
          completedAt: r.completedAt || null,
          timeMs: Math.max(0, Math.round(r.timeMs || 0)),
          itemType: t.itemType,
          reactions: reactionsOf(t),
        };
        for (const k of ANSWER_KEYS) copyAnswer(out, r.answers, k);
        if (r.pairPosition != null) out.pairPosition = r.pairPosition;
        return out;
      }),
      profile: S.profile ? clone(S.profile) : null,
      exitSurvey: S.exitSurvey ? clone(S.exitSurvey) : null,
      optOutCategories: [...S.optOutCats],
      isDone: S.isDone,
    };
  }

  function nextPendingIndex() {
    const ts = S.list,
      n = ts.length;
    for (let k = 1; k <= n; k++) {
      const i = (S.idx + k) % n;
      if (!reviewed(res(ts[i]))) return i;
    }
    return -1;
  }
  const firstPendingIndex = () => S.list.findIndex((t) => !reviewed(res(t)));

  return {
    transcript,
    category,
    CAT,
    Q0_LABEL,
    S,
    aiTurn,
    aiTurns,
    addTranscript,
    allReviewed,
    buildExport,
    callOf,
    catLabel,
    clamp,
    clone,
    cur,
    ensure,
    firstPendingIndex,
    hueOf,
    iso,
    needsMore,
    nextPendingIndex,
    plural,
    progressText,
    refreshList,
    removeTranscripts,
    res,
    restore,
    reviewed,
  };
}
