import { toKoraHighlights } from "@alliance/kora-review/highlights";
import type { KoraExport, KoraResult } from "@alliance/kora-review/types";

/** The KORA_SPEC.md version KORA's export schema (docs/kora/kora_export.schema.yaml) was written for. */
export const KORA_SPEC_VERSION = "6.1";

export type KoraSpecInput = {
  generatedAt: Date;
  kind: "rolling" | "final";
  reviewers: { id: string; createdAt: Date }[];
  /** Oldest first, so each reviewer's sessions number in the order they started. */
  assignments: {
    id: string;
    reviewerId: string;
    createdAt: Date;
    completedAt: Date | null;
    exported: KoraExport;
  }[];
  conversations: Map<
    string,
    { itemType: string; conversation: { text: string }[] }
  >;
};

const iso = (d: Date) => d.toISOString();

const NO_DEMOGRAPHICS = {
  consent_at: null,
  age_band: null,
  gender: null,
  country: null,
  us_region: null,
  is_parent: null,
  children_age_bands: [],
  child_ai_use: null,
  works_with_children_or_health: null,
  education: null,
  household_income: null,
  english: null,
};

const NO_FEEDBACK = {
  feedback_at: null,
  f1: null,
  f2: null,
  f3: null,
  f3_text: null,
  f4: null,
  f5: null,
  f5_text: null,
  f6: null,
  f7: null,
};

/**
 * KORA's five-table export from every stored review. Each assignment is a session. Reviewers' demographics, consent
 * and the end-of-session feedback aren't collected in KORA's shape yet, so they are null.
 */
export function buildKoraSpecExport(input: KoraSpecInput) {
  type Row = Record<string, unknown>;
  const ratings: Row[] = [];
  const highlights: Row[] = [];
  const sessions: Row[] = [];
  const skips: Row[] = [];
  const sessionCount = new Map<string, number>();
  const perReviewer = new Map<
    string,
    {
      started: number;
      completed: number;
      ratings: number;
      timeMs: number;
      optOut: Set<string>;
    }
  >();
  const stats = (id: string) => {
    let s = perReviewer.get(id);
    if (!s) {
      s = {
        started: 0,
        completed: 0,
        ratings: 0,
        timeMs: 0,
        optOut: new Set(),
      };
      perReviewer.set(id, s);
    }
    return s;
  };

  for (const a of input.assignments) {
    const rs = stats(a.reviewerId);
    rs.started++;
    if (a.completedAt) rs.completed++;
    for (const c of a.exported.optOutCategories) rs.optOut.add(c);
    const sessionNumber = (sessionCount.get(a.reviewerId) ?? 0) + 1;
    sessionCount.set(a.reviewerId, sessionNumber);
    let rated = 0;
    for (const r of a.exported.results) {
      const conversation = input.conversations.get(r.transcriptId);
      if (!conversation || conversation.itemType === "test") continue;
      if (r.optedOut && r.optedOutAt)
        skips.push({
          conversation_id: r.transcriptId,
          risk_id: r.category,
          reviewer_id: a.reviewerId,
          scope: "risk",
          timestamp: r.optedOutAt,
        });
      if (!isRated(r)) continue;
      rated++;
      const ratingId = `${a.id}.${r.transcriptId}`;
      const spans = toKoraHighlights(
        r.reactions,
        (i) => conversation.conversation[i]?.text ?? "",
      ).filter((h) => h.text && h.charEnd > h.charStart);
      spans.forEach((h, n) =>
        highlights.push({
          highlight_id: `${ratingId}.${n + 1}`,
          rating_id: ratingId,
          conversation_id: r.transcriptId,
          reviewer_id: a.reviewerId,
          turn_index: h.turnIndex,
          char_start: h.charStart,
          char_end: h.charEnd,
          text: h.text,
          valence: h.valence,
          reason: null,
        }),
      );
      const ok = r.q1 === "ok";
      ratings.push({
        rating_id: ratingId,
        conversation_id: r.transcriptId,
        risk_id: r.category,
        item_type: conversation.itemType,
        reviewer_id: a.reviewerId,
        session_id: a.id,
        position_in_session: r.pairPosition,
        q1: r.q1,
        q2_confidence: r.q2_confidence,
        q3_severity: ok ? null : r.q3_severity,
        q4_text: ok ? null : (r.q4_text ?? null),
        n_highlights: spans.length,
        time_ms_total: r.timeMs,
        started_at: r.startedAt ?? r.completedAt,
        completed_at: r.completedAt,
      });
      rs.ratings++;
      rs.timeMs += r.timeMs;
    }
    sessions.push({
      session_id: a.id,
      reviewer_id: a.reviewerId,
      session_number: sessionNumber,
      started_at: iso(a.createdAt),
      ended_at: a.completedAt ? iso(a.completedAt) : null,
      ratings_completed: rated,
      ...NO_FEEDBACK,
    });
  }

  const reviewers = input.reviewers.map((rv) => {
    const s = stats(rv.id);
    return {
      reviewer_id: rv.id,
      created_at: iso(rv.createdAt),
      ...NO_DEMOGRAPHICS,
      opt_out_risks: [...s.optOut],
      extended_opt_out: 0,
      sessions_started: s.started,
      sessions_completed: s.completed,
      ratings_completed: s.ratings,
      total_time_ms: s.timeMs,
    };
  });

  return {
    export: {
      export_id: `alliance-${input.kind}-${iso(input.generatedAt).replace(/[:.]/g, "-")}`,
      kind: input.kind,
      generated_at: iso(input.generatedAt),
      spec_version: KORA_SPEC_VERSION,
      counts: {
        ratings: ratings.length,
        highlights: highlights.length,
        sessions: sessions.length,
        skips: skips.length,
        reviewers: reviewers.length,
      },
    },
    ratings,
    highlights,
    sessions,
    skips,
    reviewers,
  };
}

/** A finished rating, with everything KORA's ratings table requires. */
function isRated(r: KoraResult): r is KoraResult & {
  q1: "ok" | "not_ok";
  q2_confidence: number;
  pairPosition: number;
  completedAt: string;
} {
  return (
    r.status === "done" &&
    r.q1 != null &&
    r.q2_confidence != null &&
    r.pairPosition != null &&
    r.completedAt != null
  );
}
