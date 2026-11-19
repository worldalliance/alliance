import { CATEGORY_IDS, SCHEMA_VERSION } from "../schemas.js";
import type {
  KoraExport,
  KoraHighlight,
  KoraItem,
  KoraRating,
} from "../types.gen.js";
import type { ModelCtx } from "./context.js";
import type { Highlight, Rating, Scale, State, Verdict } from "./types.js";

/** UTF-16 offset to the code-point offset Annex D asks for, and back. */
export const toCodePoints = (text: string, utf16: number): number =>
  [...text.slice(0, utf16)].length;
export const fromCodePoints = (text: string, points: number): number =>
  [...text].slice(0, points).join("").length;

const hash = (seed: string): number => {
  let x = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
};

/** A shuffle that is stable for a reviewer and a conversation, so a reload shows the same order. */
export function shuffle(length: number, seed: string): number[] {
  const order = Array.from({ length }, (_, i) => i);
  let x = hash(seed) || 1;
  for (let i = order.length - 1; i > 0; i--) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    const j = x % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function createModel(ctx: ModelCtx) {
  const { o } = ctx;

  const iso = () => new Date().toISOString();
  const clamp = (x: number, a: number, b: number) =>
    Math.max(a, Math.min(b, x));
  const clip = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1) + "…" : s;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const newId = () =>
    "h_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const hueOf = (riskId: string) => {
    const i = CATEGORY_IDS.findIndex((id) => id === riskId);
    return i >= 0
      ? Math.round((i * 360) / CATEGORY_IDS.length)
      : hash(riskId) % 360;
  };

  const S: State = {
    items: [...o.session.items],
    ratings: {},
    history: {},
    skips: [],
    feedback: null,
    screen: "boot",
    idx: 0,
    views: {},
    sel: null,
    editing: null,
    sheet: null,
    guideOpen: false,
    ended: null,
    isDone: false,
    warned: null,
    mounted: false,
  };

  const cur = (): KoraItem => S.items[clamp(S.idx, 0, S.items.length - 1)];
  const itemOf = (conversationId: string): KoraItem => {
    const item = S.items.find((i) => i.conversationId === conversationId);
    if (!item)
      throw new Error(`No conversation ${conversationId} in this session.`);
    return item;
  };

  function blank(item: KoraItem): Rating {
    return {
      conversationId: item.conversationId,
      riskId: item.riskId,
      contentHash: item.contentHash,
      kind: item.kind,
      status: "reading",
      position: item.position ?? null,
      firstTimeOnRisk: item.firstTimeOnRisk,
      comprehensionAnswer: null,
      q1: null,
      q2Confidence: null,
      q3Severity: null,
      q4Text: null,
      highlights: [],
      startedAt: iso(),
      readSubmittedAt: null,
      completedAt: null,
      timeMsRead: 0,
      timeMsJudge: 0,
    };
  }
  const res = (item: KoraItem): Rating =>
    S.ratings[item.conversationId] || blank(item);
  const ensure = (item: KoraItem): Rating =>
    (S.ratings[item.conversationId] ||= blank(item));
  const done = (item: KoraItem) => res(item).status === "done";
  const skipped = (conversationId: string) =>
    S.skips.some((s) => s.conversationId === conversationId);

  /** Where the reviewer is: the first conversation they have not finished, else the last one given. */
  const openIndex = () => {
    const i = S.items.findIndex(
      (item) => !done(item) && !skipped(item.conversationId),
    );
    return i === -1 ? S.items.length - 1 : i;
  };

  /* ---------- The session's load budget (spec 6.0 section 7) ---------- */
  const spentUnits = () =>
    S.items.filter(done).reduce((sum, item) => sum + item.weightUnits, 0);
  const budgetUnits = () => o.session.budgetUnits;
  const ratedDone = () =>
    S.items.filter((item) => item.kind === "rated" && done(item)).length;

  const optionOrder = (item: KoraItem): number[] =>
    shuffle(
      item.comprehension ? item.comprehension.options.length : 0,
      `${o.reviewerId}|${item.conversationId}`,
    );

  function exportHighlight(item: KoraItem, h: Highlight): KoraHighlight {
    const text = item.conversation[h.turnIndex]?.text ?? "";
    return {
      id: h.id,
      turnIndex: h.turnIndex,
      charStart: toCodePoints(text, h.start),
      charEnd: toCodePoints(text, h.end),
      text: h.text,
      valence: h.valence,
      createdAt: h.createdAt,
      ...(h.reason ? { reason: h.reason } : {}),
      ...(h.orphaned ? { orphaned: true } : {}),
    };
  }
  function exportRating(item: KoraItem, r: Rating): KoraRating {
    const out: KoraRating = {
      conversationId: r.conversationId,
      riskId: r.riskId,
      contentHash: r.contentHash,
      kind: r.kind,
      status: r.status,
      firstTimeOnRisk: r.firstTimeOnRisk,
      highlights: r.highlights.map((h) => exportHighlight(item, h)),
      startedAt: r.startedAt,
      readSubmittedAt: r.readSubmittedAt,
      completedAt: r.completedAt,
      timeMsRead: Math.max(0, Math.round(r.timeMsRead)),
      timeMsJudge: Math.max(0, Math.round(r.timeMsJudge)),
    };
    if (r.position !== null) out.position = r.position;
    if (r.comprehensionAnswer !== null)
      out.comprehensionAnswer = r.comprehensionAnswer;
    if (r.q1) out.q1 = r.q1;
    if (r.q2Confidence) out.q2Confidence = r.q2Confidence;
    if (r.q1 === "not_ok") {
      if (r.q3Severity) out.q3Severity = r.q3Severity;
      if (r.q4Text) out.q4Text = r.q4Text;
    }
    if (r.stale) out.stale = { ...r.stale };
    return out;
  }
  function buildExport(): KoraExport {
    const screen =
      S.screen === "read" || S.screen === "judge" ? S.screen : null;
    const open = screen ? cur() : null;
    return {
      schemaVersion: SCHEMA_VERSION,
      sessionId: o.session.id,
      reviewer: { id: o.reviewerId },
      exportedAt: iso(),
      place: {
        conversationId: open ? open.conversationId : null,
        screen,
      },
      ratings: S.items.flatMap((item) => {
        const r = S.ratings[item.conversationId];
        return r ? [exportRating(item, r)] : [];
      }),
      skips: S.skips.map((s) => ({ ...s })),
      feedback: S.feedback ? clone(S.feedback) : null,
      isDone: S.isDone,
    };
  }

  function reanchor(item: KoraItem, r: Rating) {
    let moved = 0,
      lost = 0;
    for (const h of r.highlights) {
      const text = item.conversation[h.turnIndex]?.text ?? "";
      if (text.slice(h.start, h.end) === h.text) {
        h.orphaned = false;
        continue;
      }
      let best = -1,
        distance = Infinity;
      if (h.text) {
        for (
          let i = text.indexOf(h.text);
          i !== -1;
          i = text.indexOf(h.text, i + 1)
        ) {
          const d = Math.abs(i - h.start);
          if (d < distance) {
            distance = d;
            best = i;
          }
        }
      }
      if (best >= 0) {
        h.start = best;
        h.end = best + h.text.length;
        h.orphaned = false;
        moved++;
      } else {
        h.orphaned = true;
        lost++;
      }
    }
    r.stale = { moved, lost };
    r.contentHash = item.contentHash;
  }
  const scale = (value: number | undefined): Scale | null =>
    value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
  function restore(saved: KoraExport | null) {
    if (!saved) return;
    S.skips = saved.skips.map((s) => ({ ...s }));
    S.feedback = saved.feedback ? clone(saved.feedback) : null;
    S.isDone = !!saved.isDone;
    for (const e of saved.ratings) {
      const item = S.items.find((i) => i.conversationId === e.conversationId);
      if (!item) continue;
      const r = blank(item);
      r.contentHash = e.contentHash;
      r.status = e.status;
      r.position = e.position ?? null;
      r.firstTimeOnRisk = e.firstTimeOnRisk;
      r.comprehensionAnswer = e.comprehensionAnswer ?? null;
      r.q1 = (e.q1 as Verdict | undefined) ?? null;
      r.q2Confidence = scale(e.q2Confidence);
      r.q3Severity = scale(e.q3Severity);
      r.q4Text = e.q4Text ?? null;
      r.startedAt = e.startedAt;
      r.readSubmittedAt = e.readSubmittedAt;
      r.completedAt = e.completedAt;
      r.timeMsRead = e.timeMsRead;
      r.timeMsJudge = e.timeMsJudge;
      r.highlights = e.highlights.map((h) => {
        const text = item.conversation[h.turnIndex]?.text ?? "";
        const restored: Highlight = {
          id: h.id,
          turnIndex: h.turnIndex,
          start: fromCodePoints(text, h.charStart),
          end: fromCodePoints(text, h.charEnd),
          text: h.text,
          valence: h.valence,
          reason: h.reason ?? null,
          createdAt: h.createdAt,
          ...(h.orphaned ? { orphaned: true } : {}),
        };
        return restored;
      });
      if (e.stale) r.stale = { ...e.stale };
      if (r.contentHash !== item.contentHash) reanchor(item, r);
      S.ratings[item.conversationId] = r;
    }
  }

  function addItem(item: KoraItem): KoraItem {
    S.items.push(item);
    return item;
  }
  function removeItems(ids: string[]) {
    const gone = new Set(ids);
    S.items = S.items.filter((item) => !gone.has(item.conversationId));
    for (const id of gone) {
      delete S.ratings[id];
      delete S.history[id];
    }
  }

  return {
    S,
    addItem,
    blank,
    budgetUnits,
    buildExport,
    clamp,
    clip,
    clone,
    cur,
    done,
    ensure,
    hueOf,
    iso,
    itemOf,
    newId,
    openIndex,
    optionOrder,
    plural,
    ratedDone,
    removeItems,
    res,
    restore,
    skipped,
    spentUnits,
  };
}
