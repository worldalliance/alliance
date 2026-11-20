import type { KoraReviewPhase } from "@alliance/common/kora";
import { KoraBatchService } from "src/kora/kora-batch.service";
import type TestAgent from "supertest/lib/agent";
import {
  koraAdminActor,
  koraClosesAt,
  ORIGIN,
  type KoraHarness,
} from "./kora-fixtures";
import { koraExport, koraConversation, koraConversationsFile } from "./kora-conversations";
import { uniqueEmail } from "./otp-fixtures";

export type ReviewTranscript = {
  transcript: { transcriptId: string; category: string };
  contentHash: string;
};

export type ReviewAssignment = {
  id: string;
  extra: boolean;
  size: number;
  transcripts: ReviewTranscript[];
  savedExport: Record<string, unknown> | null;
};

export type ReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  collectProfile: boolean;
  optOutCategories: string[];
  extraReviews: number;
  assignment?: ReviewAssignment;
};

/** A reviewer's requests, and admin uploads that skip the HTTP upload. Takes a getter so it can be built before `beforeAll` sets the harness. */
export function koraReviewClient(harness: () => KoraHarness) {
  const state = async (browser: TestAgent): Promise<ReviewState> =>
    (await browser.get("/kora/review").expect(200)).body;
  const more = async (browser: TestAgent): Promise<ReviewState> =>
    (await browser.post("/kora/review/more").set("Origin", ORIGIN).expect(200))
      .body;
  const save = (browser: TestAgent, assignmentId: string, exported: object) =>
    browser
      .put(`/kora/review/assignments/${assignmentId}/export`)
      .set("Origin", ORIGIN)
      .send({ export: exported });
  const ids = (a: ReviewAssignment | undefined) =>
    (a?.transcripts ?? []).map((t) => t.transcript.transcriptId);
  const exportOf = (
    s: ReviewState,
    options: { done?: string[]; optedOut?: string[]; worry?: string } = {},
  ) =>
    koraExport({
      reviewerId: s.reviewerId,
      assignmentId: s.assignment?.id ?? "",
      transcripts: s.assignment?.transcripts ?? [],
      ...options,
    });
  const next = async (
    browser: TestAgent,
    assignmentId: string,
  ): Promise<ReviewTranscript | null> =>
    (
      await browser
        .post(`/kora/review/assignments/${assignmentId}/next`)
        .set("Origin", ORIGIN)
        .expect(200)
    ).body.next;
  /** Ranks each transcript the assignment gives, as the tool does, until it gives no more. */
  const finish = async (browser: TestAgent, s: ReviewState) => {
    const id = s.assignment?.id ?? "";
    const given = [...(s.assignment?.transcripts ?? [])];
    const rankAll = () => {
      const all = {
        ...s,
        assignment: s.assignment && { ...s.assignment, transcripts: given },
      };
      return save(
        browser,
        id,
        exportOf(all, { done: ids(all.assignment) }),
      ).expect(200);
    };
    for (;;) {
      await rankAll();
      const more = await next(browser, id);
      if (!more) {
        const { body } = await rankAll();
        return { body, given: given.map((t) => t.transcript.transcriptId) };
      }
      given.push(more);
    }
  };
  const participant = async () => {
    const h = harness();
    const browser = h.browser();
    await h.signedUp(browser, { email: uniqueEmail() });
    return browser;
  };
  const upload = async (
    count: number,
    options: {
      perAssignment?: number;
      reviews?: number;
      prefix?: string;
      closesAt?: Date;
    } = {},
  ): Promise<string> => {
    const { ctx } = harness();
    const uploaded = await ctx.app.get(KoraBatchService).upload({
      transcriptsText: koraConversationsFile(
        ...Array.from({ length: count }, (_, i) =>
          koraConversation(`${options.prefix ?? "R"}${i + 1}`, {
            risk_id:
              i % 2
                ? "fear_trauma_and_distress"
                : "privacy_and_personal_data_protection",
          }),
        ),
      ),
      transcriptsPerAssignment: options.perAssignment ?? 3,
      reviewsPerTranscript: options.reviews ?? 2,
      closesAt: options.closesAt ?? koraClosesAt(),
      actor: koraAdminActor(ctx),
    });
    if (!uploaded.ok) throw new Error(JSON.stringify(uploaded.error));
    return uploaded.value.batch.id;
  };
  return {
    state,
    more,
    save,
    next,
    ids,
    exportOf,
    finish,
    participant,
    upload,
  };
}
