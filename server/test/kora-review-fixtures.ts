import type { KoraReviewPhase, KoraSessionEnd } from "@alliance/common/kora";
import { KoraBatchService } from "src/kora/kora-batch.service";
import type TestAgent from "supertest/lib/agent";
import {
  koraConversation,
  koraJsonlFile,
  koraSessionExport,
} from "./kora-conversations";
import {
  koraAdminActor,
  koraClosesAt,
  ORIGIN,
  type KoraHarness,
} from "./kora-fixtures";
import { uniqueEmail } from "./otp-fixtures";

/** One conversation as the review tool receives it; the item's shape is the tool's itemSchema. */
export type ReviewItem = {
  item: {
    conversationId: string;
    riskId: string;
    contentHash: string;
    kind: string;
    weightUnits: number;
    position: number | null;
    firstTimeOnRisk: boolean;
    [key: string]: unknown;
  };
};

export type ReviewSession = {
  id: string;
  number: number;
  budgetUnits: number;
  items: ReviewItem[];
  savedExport: Record<string, unknown> | null;
};

export type ReviewState = {
  phase: KoraReviewPhase;
  reviewerId: string;
  optOutRisks: string[];
  extendedOptIn: boolean;
  reviewed: boolean;
  sessionsCompleted: number;
  ratingsCompleted: number;
  onboarding: {
    demographics: Record<string, unknown> | null;
    consentAt: string | null;
    onboardedAt: string | null;
  };
  session?: ReviewSession;
};

export type ReviewNext = { item?: ReviewItem["item"]; done?: KoraSessionEnd };

/**
 * A reviewer's requests, and admin uploads that skip the HTTP upload. Takes a getter so it can be
 * built before `beforeAll` sets the harness.
 */
export function koraReviewClient(harness: () => KoraHarness) {
  const state = async (browser: TestAgent): Promise<ReviewState> =>
    (await browser.get("/kora/review").expect(200)).body;
  const more = async (browser: TestAgent): Promise<ReviewState> =>
    (await browser.post("/kora/review/more").set("Origin", ORIGIN).expect(200))
      .body;
  const save = (browser: TestAgent, sessionId: string, exported: object) =>
    browser
      .put(`/kora/review/sessions/${sessionId}/export`)
      .set("Origin", ORIGIN)
      .send({ export: exported });
  const next = async (
    browser: TestAgent,
    sessionId: string,
  ): Promise<ReviewNext> =>
    (
      await browser
        .post(`/kora/review/sessions/${sessionId}/next`)
        .set("Origin", ORIGIN)
        .expect(200)
    ).body;
  const onboarding = async (
    browser: TestAgent,
    body: {
      demographics?: Record<string, unknown>;
      consented?: true;
      onboarded?: true;
    },
  ) =>
    (
      await browser
        .patch("/kora/review/onboarding")
        .set("Origin", ORIGIN)
        .send(body)
        .expect(200)
    ).body;
  /** Passes the sign-up screens, which every reviewer does before a session is served. */
  const onboard = (browser: TestAgent) =>
    onboarding(browser, { consented: true, onboarded: true });

  const preferences = async (
    browser: TestAgent,
    body: { optOutRisks?: string[]; extendedOptIn?: boolean },
  ) =>
    (
      await browser
        .patch("/kora/review/preferences")
        .set("Origin", ORIGIN)
        .send(body)
        .expect(200)
    ).body;

  const ids = (session: ReviewSession | undefined) =>
    (session?.items ?? []).map((i) => i.item.conversationId);
  const served = (session: ReviewSession | undefined) =>
    (session?.items ?? []).map((i) => ({
      id: i.item.conversationId,
      riskId: i.item.riskId,
      contentHash: i.item.contentHash,
    }));
  const exportOf = (
    s: ReviewState,
    options: {
      done?: string[];
      skipped?: string[];
      worry?: string;
      isDone?: boolean;
      feedback?: boolean;
    } = {},
  ) =>
    koraSessionExport({
      reviewerId: s.reviewerId,
      sessionId: s.session?.id ?? "",
      conversations: served(s.session),
      ...options,
    });

  /**
   * Judges every conversation the session gives, as the tool does, until the host stops giving them,
   * then answers the feedback so the session ends.
   */
  const finish = async (browser: TestAgent, s: ReviewState) => {
    const id = s.session?.id ?? "";
    const given = [...served(s.session)];
    const judgeAll = (options: { isDone?: boolean; feedback?: boolean } = {}) =>
      save(
        browser,
        id,
        koraSessionExport({
          reviewerId: s.reviewerId,
          sessionId: id,
          conversations: given,
          done: given.map((c) => c.id),
          ...options,
        }),
      ).expect(200);
    for (;;) {
      await judgeAll();
      const more = await next(browser, id);
      if (!more.item) {
        const { body } = await judgeAll({ isDone: true, feedback: true });
        return { body, given: given.map((c) => c.id), done: more.done };
      }
      given.push({
        id: more.item.conversationId,
        riskId: more.item.riskId,
        contentHash: more.item.contentHash,
      });
    }
  };

  /** Signed up and past the sign-up screens; `signedUpOnly` leaves those for the test. */
  const participant = async (options: { signedUpOnly?: boolean } = {}) => {
    const h = harness();
    const browser = h.browser();
    await h.signedUp(browser, { email: uniqueEmail() });
    if (!options.signedUpOnly) await onboard(browser);
    return browser;
  };

  const upload = async (
    count: number,
    options: {
      reviews?: number;
      prefix?: string;
      closesAt?: Date;
      nTurns?: number;
      extra?: object[];
    } = {},
  ): Promise<string> => {
    const { ctx } = harness();
    const turns = options.nTurns ?? 1;
    const uploaded = await ctx.app.get(KoraBatchService).upload({
      conversationsText: koraJsonlFile(
        ...Array.from({ length: count }, (_, i) =>
          koraConversation(`${options.prefix ?? "R"}${i + 1}`, {
            risk_id: i % 2 ? "fear_trauma_and_distress" : "cybersecurity",
            risk_category_id:
              i % 2 ? "psychological_and_emotional_safety" : "online_safety",
            n_turns: turns,
            conversation: [
              { role: "child", text: "Can you write my essay?" },
              ...Array.from({ length: turns }, () => [
                { role: "ai", text: "I can help you plan it instead." },
                { role: "child", text: "ok" },
              ]).flat(),
            ].slice(0, turns * 2 + 1),
          }),
        ),
        ...(options.extra ?? []),
      ),
      reviewsPerConversation: options.reviews ?? 2,
      closesAt: options.closesAt ?? koraClosesAt(),
      actor: koraAdminActor(ctx),
    });
    if (!uploaded.ok) throw new Error(JSON.stringify(uploaded.error));
    return uploaded.value.batch.id;
  };

  return {
    onboard,
    onboarding,
    exportOf,
    finish,
    ids,
    more,
    next,
    participant,
    preferences,
    save,
    served,
    state,
    upload,
  };
}
