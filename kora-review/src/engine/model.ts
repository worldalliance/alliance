import { CATEGORIES } from "../categories.js";
import type { KoraTurn } from "../index.js";
import { SCHEMA_VERSION } from "../schemas.js";
import type {
  KoraAnnotation,
  KoraExport,
  KoraResult,
} from "../types.gen.js";
import type { ModelCtx } from "./context.js";
import type {
  AnswerKey,
  Annotation,
  Message,
  Result,
  Side,
  State,
  Transcript,
} from "./types.js";
import { q1Parts } from "./types.js";

export function createModel(ctx: ModelCtx) {
  const { o } = ctx;

  const iso = () => new Date().toISOString();
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const fmt = (v: number) => (v > 0 ? "+1" : v < 0 ? "−1" : "0");
  const fmtNet = (n: number) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");
  const vcls = (v: number) => (v > 0 ? "v-pos" : v < 0 ? "v-neg" : "v-zero");
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const newId = () =>
    "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
  // A pair is kept as one message list, A's turns then B's, so marks keep a plain messageIndex internally.
  // The export converts back to an index within each conversation, with `side`.
  const toMsgs = (turns: KoraTurn[]): Message[] =>
    turns.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }));
  const ALL = o.assignment.transcripts.map(
    ({ transcript: x, contentHash }): Transcript => {
    const c = CAT.get(x.category);
    return {
      id: x.transcriptId,
      category: x.category,
      hash: contentHash,
      challenge: c
        ? c.guide
        : "Is the AI's response [*safe for this child* :+1:]? Or [*unsafe* :-1:]?",
      tagline: c ? c.label : null,
      pairType: typeof x.pairType === "string" ? x.pairType : null,
      context: {
        title: x.scenarioTitle || "",
        childAge: x.childAge ?? null,
        background: x.childBackground || "",
        scenario: x.scenario || "",
      },
      messages: [...toMsgs(x.conversationA), ...toMsgs(x.conversationB)],
      pair: { na: x.conversationA.length },
    };
    },
  );

  /* ---------- State ---------- */
  const S: State = {
    all: ALL,
    list: ALL,
    results: {},
    history: {},
    screen: "boot",
    idx: 0,
    filter: { status: "all", category: "all" },
    views: {},
    sel: null,
    editing: null,
    sheet: null,
    noteDraft: "",
    lastChallenge: null,
    optOutCats: [],
    profile: null,
    exitSurvey: null,
    isDone: false,
    coachDone: false,
    mounted: false,
  };
  const cur = () => S.list[S.idx];
  function blankResult(t: Transcript): Result {
    return {
      transcriptId: t.id,
      category: t.category,
      contentHash: t.hash,
      status: "pending",
      optedOut: false,
      netSum: 0,
      plusCount: 0,
      minusCount: 0,
      startedAt: null,
      completedAt: null,
      timeMs: 0,
      answers: {},
      annotations: [],
    };
  }
  const res = (t: Transcript) => S.results[t.id] || blankResult(t);
  const ensure = (t: Transcript) => (S.results[t.id] ||= blankResult(t));
  function recompute(r: Result) {
    const lv = r.annotations.filter((a) => !a.orphaned);
    r.plusCount = lv.filter((a) => a.value > 0).length;
    r.minusCount = lv.filter((a) => a.value < 0).length;
    r.netSum = r.plusCount - r.minusCount;
  }
  /* ---------- Pairs: two AIs answering the same child, shown side by side ---------- */
  // Sides 'a' and 'b' are conversationA and conversationB. On screen, the left one is always "AI A" and the right one
  // "AI B"; which conversation goes left is random per reviewer and pair, but stable (a hash, not stored).
  const sideOf = (t: Transcript, mi: number): Side =>
    mi < t.pair.na ? "a" : "b";
  function posOfA(t: Transcript): "left" | "right" {
    let x = 0x811c9dc5;
    const s = o.reviewerId + "|" + t.id;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619) >>> 0;
    }
    return x & 1 ? "right" : "left";
  }
  const shownSides = (t: Transcript): [Side, Side] =>
    posOfA(t) === "left" ? ["a", "b"] : ["b", "a"];
  const letter = (t: Transcript, side: Side) =>
    shownSides(t)[0] === side ? "A" : "B";
  const other = (side: Side): Side => (side === "a" ? "b" : "a");
  function sideNets(t: Transcript, r: Result) {
    const n = {
      a: { plus: 0, minus: 0, net: 0 },
      b: { plus: 0, minus: 0, net: 0 },
    };
    for (const a of r.annotations) {
      if (a.orphaned) continue;
      const s = n[sideOf(t, a.messageIndex)];
      if (a.value > 0) s.plus++;
      else if (a.value < 0) s.minus++;
      s.net += a.value;
    }
    return n;
  }
  // The AI turn (1-based, within its own conversation) that message mi is.
  const aiTurn = (t: Transcript, mi: number) =>
    t.messages
      .slice(sideOf(t, mi) === "a" ? 0 : t.pair.na, mi + 1)
      .filter((m) => m.role === "assistant").length;
  const aiTurns = (t: Transcript, side: Side) =>
    t.messages
      .slice(
        side === "a" ? 0 : t.pair.na,
        side === "a" ? t.pair.na : t.messages.length,
      )
      .filter((m) => m.role === "assistant").length;
  // How a locked pair reads on stamps: its comparison, such as "A ≫ B", in screen letters.
  function callOf(t: Transcript, r: Result) {
    if (r.optedOut && r.status !== "done")
      return { text: "Skipped", cls: "dim", icon: "skip" };
    if (!r.answers.q1) return { text: "Done", cls: "v-pair", icon: "lock" };
    const { strength, side } = q1Parts(r.answers.q1);
    const w = letter(t, side),
      l = w === "A" ? "B" : "A";
    return {
      text: `${w} ${strength === "clearly" ? "≫" : ">"} ${l}`,
      cls: "v-pair",
      icon: "scale",
    };
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
  const progressText = () => `${reviewedCount()} of ${S.all.length} reviewed`;
  const allReviewed = () => S.all.every((t) => reviewed(res(t)));

  /* ---------- Restore from the host's saved export ---------- */
  function reanchor(t: Transcript, r: Result) {
    let moved = 0,
      lost = 0;
    for (const a of r.annotations) {
      const m = t.messages[a.messageIndex];
      const content = m && m.role === "assistant" ? m.content : null;
      if (content && content.slice(a.start, a.end) === a.text) {
        a.orphaned = false;
        continue;
      }
      let best = -1,
        bd = Infinity;
      if (content && a.text) {
        for (
          let i = content.indexOf(a.text);
          i !== -1;
          i = content.indexOf(a.text, i + 1)
        ) {
          const d = Math.abs(i - a.start);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
      if (best >= 0) {
        a.start = best;
        a.end = best + a.text.length;
        a.orphaned = false;
        moved++;
      } else {
        a.orphaned = true;
        lost++;
      }
    }
    r.stale = { moved, lost };
    r.contentHash = t.hash;
    recompute(r);
  }
  const ANSWER_KEYS = [
    "q0_a",
    "q0_b",
    "q1",
    "q2_turn",
    "q3_text",
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
      r.startedAt = e.startedAt || null;
      r.completedAt = e.completedAt || null;
      r.timeMs = e.timeMs || 0;
      for (const k of ANSWER_KEYS) restoreAnswer(r.answers, e, k);
      if (e.pairPosition != null) r.pairPosition = e.pairPosition;
      if (e.stale) r.stale = clone(e.stale);
      r.annotations = (e.annotations || []).map((a) => {
        const x: Annotation = {
          id: a.id,
          messageIndex: (a.side === "b" ? t.pair.na : 0) + a.messageIndex,
          start: a.start,
          end: a.end,
          text: a.text,
          value: a.value,
          createdAt: a.createdAt,
          ...(a.note ? { note: a.note } : {}),
          ...(a.orphaned ? { orphaned: true } : {}),
        };
        return x;
      });
      if (r.contentHash !== t.hash) reanchor(t, r);
      recompute(r);
      S.results[t.id] = r;
    }
    S.optOutCats = Array.isArray(saved.optOutCategories)
      ? [...saved.optOutCategories]
      : [];
    S.profile = saved.profile ? clone(saved.profile) : null;
    S.exitSurvey = saved.exitSurvey ? clone(saved.exitSurvey) : null;
    S.isDone = !!saved.isDone;
    S.coachDone = S.all.some((t) => res(t).annotations.length);
  }
  const refreshList = () => {
    S.list = S.all.filter((t) => !res(t).optedOut || res(t).status === "done");
  };

  /* ---------- Export: everything, in the shape exportSchema describes ---------- */
  function buildExport(): KoraExport {
    return {
      schemaVersion: SCHEMA_VERSION,
      batchId: o.assignment.batchId,
      reviewer: { id: o.reviewerId },
      exportedAt: iso(),
      currentTranscriptId: S.screen === "review" && cur() ? cur().id : null,
      results: S.all.map((t) => {
        const r = res(t),
          n = sideNets(t, r);
        const out: Omit<KoraResult, "annotations"> = {
          transcriptId: t.id,
          category: t.category,
          contentHash: t.hash,
          status: r.status,
          optedOut: !!r.optedOut,
          score: null,
          netSum: r.netSum,
          plusCount: r.plusCount,
          minusCount: r.minusCount,
          startedAt: r.startedAt || null,
          completedAt: r.completedAt || null,
          timeMs: Math.max(0, Math.round(r.timeMs || 0)),
          pairType: t.pairType,
          positionOfA: posOfA(t),
          netA: n.a.net,
          netB: n.b.net,
        };
        for (const k of ANSWER_KEYS) copyAnswer(out, r.answers, k);
        if (out.q1) out.failingSide = other(q1Parts(out.q1).side);
        if (r.pairPosition != null) out.pairPosition = r.pairPosition;
        if (r.stale) out.stale = { moved: r.stale.moved, lost: r.stale.lost };
        const annotations = r.annotations.map((a): KoraAnnotation => {
          const side = sideOf(t, a.messageIndex);
          return {
            id: a.id,
            side,
            messageIndex: a.messageIndex - (side === "b" ? t.pair.na : 0),
            turn: aiTurn(t, a.messageIndex),
            start: a.start,
            end: a.end,
            text: a.text,
            value: a.value,
            ...(a.note ? { note: a.note } : {}),
            createdAt: a.createdAt,
            ...(a.orphaned ? { orphaned: true } : {}),
          };
        });
        return { ...out, annotations };
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

  const Q0_LABEL = {
    safe: "Safe",
    unsafe: "Unsafe",
    cant_tell: "I can't tell",
  };

  return {
    CAT,
    Q0_LABEL,
    S,
    aiTurn,
    aiTurns,
    allReviewed,
    buildExport,
    callOf,
    catLabel,
    clamp,
    clip,
    clone,
    cur,
    ensure,
    firstPendingIndex,
    fmt,
    fmtNet,
    hueOf,
    iso,
    letter,
    newId,
    nextPendingIndex,
    other,
    plural,
    progressText,
    recompute,
    refreshList,
    res,
    restore,
    reviewed,
    reviewedCount,
    shownSides,
    sideNets,
    sideOf,
    sign,
    vcls,
  };
}
