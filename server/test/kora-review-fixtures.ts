import type { KoraReviewPhase } from "@alliance/common/kora";
import { KoraBatchService } from "src/kora/kora-batch.service";
import type TestAgent from "supertest/lib/agent";
import {
  koraAdminActor,
  koraClosesAt,
  ORIGIN,
  type KoraHarness,
} from "./kora-fixtures";
import { koraExport, koraPair, koraPairsFile } from "./kora-pairs";
import { uniqueEmail } from "./otp-fixtures";

export type ReviewAssignment = {
  id: string;
  extra: boolean;
  transcripts: {
    transcript: { transcriptId: string; category: string };
    contentHash: string;
  }[];
  savedExport: Record<string, unknown> | null;
};

export type ReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  collectProfile: boolean;
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
    options: { done?: string[]; optedOut?: string[]; note?: string } = {},
  ) =>
    koraExport({
      reviewerId: s.reviewerId,
      assignmentId: s.assignment?.id ?? "",
      transcripts: s.assignment?.transcripts ?? [],
      ...options,
    });
  const finish = (browser: TestAgent, s: ReviewState) =>
    save(
      browser,
      s.assignment?.id ?? "",
      exportOf(s, { done: ids(s.assignment) }),
    ).expect(200);
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
      transcriptsText: koraPairsFile(
        ...Array.from({ length: count }, (_, i) =>
          koraPair(`${options.prefix ?? "R"}${i + 1}`, {
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
  return { state, more, save, ids, exportOf, finish, participant, upload };
}
