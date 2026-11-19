import {
  KoraProjectStatus,
  KoraReviewPhase,
  KoraSessionEnd,
} from "@alliance/common/kora";
import { milliseconds } from "date-fns";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KoraSessionConversation } from "src/kora/entities/kora-session-conversation.entity";
import { KoraSession } from "src/kora/entities/kora-session.entity";
import { REDACTED } from "src/kora/kora-redact";
import request from "supertest";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraAttention,
  koraConversation,
  koraPractice,
} from "./kora-conversations";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora reviews (e2e)", () => {
  let h: KoraHarness;

  const {
    exportOf,
    finish,
    ids,
    more,
    next,
    onboard,
    participant,
    preferences,
    save,
    served,
    state,
    upload,
  } = koraReviewClient(() => h);

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await h.ctx.dataSource.getRepository(KoraReviewer).deleteAll();
    await h.ctx.dataSource.getRepository(KoraBatch).deleteAll();
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
  });

  afterAll(async () => {
    await closeTestApp(h.ctx.app);
  });

  it("asks a signed-out visitor to sign in", async () => {
    await request(h.ctx.app.getHttpServer()).get("/kora/review").expect(401);
  });

  it("gives a first visit one conversation, the next when asked, and the same ones on return", async () => {
    await upload(5);
    const browser = await participant();

    const first = await state(browser);
    expect(first).toMatchObject({
      phase: KoraReviewPhase.Reviewing,
      extendedOptIn: false,
      optOutRisks: [],
      session: { number: 1, budgetUnits: 5, savedExport: null },
    });
    expect(first.session?.items).toHaveLength(1);
    const [only] = first.session?.items ?? [];
    expect(only.item.contentHash).toMatch(/^sha256:/);
    expect(only.item).toMatchObject({
      kind: "rated",
      position: 1,
      firstTimeOnRisk: true,
      weightUnits: 1,
    });
    expect(only.item).not.toHaveProperty("comprehensionCorrect");
    expect(only.item).not.toHaveProperty("itemType");
    const id = first.session?.id ?? "";

    expect((await next(browser, id)).item?.conversationId).toBe(
      ids(first.session)[0],
    );
    const partial = exportOf(first, { done: ids(first.session) });
    expect((await save(browser, id, partial).expect(200)).body).toEqual({
      ended: false,
      removed: [],
    });
    const second = await next(browser, id);
    expect(second.item?.conversationId).not.toBe(ids(first.session)[0]);
    expect(second.item?.position).toBe(2);

    const again = await state(browser);
    expect(again.session?.id).toBe(id);
    expect(ids(again.session)).toEqual([
      ...ids(first.session),
      second.item?.conversationId ?? "",
    ]);
    expect(again.session?.savedExport).toMatchObject({
      sessionId: id,
      isDone: false,
    });
  });

  it("refuses an export for other content or another reviewer, and another's session", async () => {
    await upload(4);
    const browser = await participant();
    const s = await state(browser);
    const id = s.session?.id ?? "";

    const tampered = exportOf(s);
    tampered.ratings[0].contentHash = `sha256:${"0".repeat(64)}`;
    expect(
      (await save(browser, id, tampered).expect(400)).body.message,
    ).toContain("rated different content");
    expect(
      (
        await save(browser, id, {
          ...exportOf(s),
          reviewer: { id: "someone-else" },
        }).expect(400)
      ).body.message,
    ).toContain("names a different reviewer");
    await save(await participant(), id, exportOf(s)).expect(404);
  });

  it("stops a session once its load budget is spent, and starts another when asked", async () => {
    await upload(12, { reviews: 3 });
    const browser = await participant();
    const first = await finish(browser, await state(browser));
    expect(first.done).toBe(KoraSessionEnd.BudgetSpent);
    expect(first.given).toHaveLength(5);
    expect(first.body).toEqual({ ended: true, removed: [] });
    expect(await state(browser)).toMatchObject({
      phase: KoraReviewPhase.Finished,
      reviewed: true,
      sessionsCompleted: 1,
      ratingsCompleted: 5,
    });

    const second = await more(browser);
    expect(second.session?.number).toBe(2);
    const after = await finish(browser, second);
    expect(after.given.some((id) => first.given.includes(id))).toBe(false);
    expect(await state(browser)).toMatchObject({
      sessionsCompleted: 2,
      ratingsCompleted: 10,
    });
  });

  it("fills a session with three long conversations rather than cutting it to two", async () => {
    await upload(6, { nTurns: 8, reviews: 3 });
    const browser = await participant();
    await preferences(browser, { extendedOptIn: true });
    const { given, done } = await finish(browser, await more(browser));
    expect(given).toHaveLength(3);
    expect(done).toBe(KoraSessionEnd.BudgetSpent);
  });

  it("keeps longer conversations behind the opt-in", async () => {
    await upload(4, { nTurns: 8, reviews: 3 });
    const browser = await participant();
    expect((await state(browser)).phase).toBe(KoraReviewPhase.NoneLeft);

    expect(await preferences(browser, { extendedOptIn: true })).toEqual({
      optOutRisks: [],
      extendedOptIn: true,
    });
    const opted = await more(browser);
    expect(opted.phase).toBe(KoraReviewPhase.Reviewing);
    expect(opted.session?.items[0].item.weightUnits).toBeCloseTo(1.8);
  });

  it("gives the two practice conversations first, with the answer they are judged against", async () => {
    await upload(4, {
      extra: [koraPractice("P1"), koraPractice("P2")],
    });
    const browser = await participant();
    const first = await state(browser);
    expect(first.session?.items[0].item).toMatchObject({
      conversationId: "P1",
      kind: "practice",
      position: null,
      weightUnits: 0,
      reference: { verdict: "ok" },
      comprehension: null,
    });

    const id = first.session?.id ?? "";
    await save(browser, id, exportOf(first, { done: ["P1"] })).expect(200);
    expect((await next(browser, id)).item).toMatchObject({
      conversationId: "P2",
      kind: "practice",
    });
  });

  it("scores the attention conversation against its reference verdict", async () => {
    await upload(6, { extra: [koraAttention("AT1")] });
    const browser = await participant();
    const { given } = await finish(browser, await state(browser));
    expect(given).toContain("AT1");

    const row = await h.ctx.dataSource
      .getRepository(KoraSessionConversation)
      .findOneByOrFail({ conversationId: "AT1" });
    expect(row.attentionPass).toBe(true);
    expect(row.ratedPosition).toBeLessThanOrEqual(3);
  });

  it("serves a conversation again once it has its ratings, and stops at what a reviewer has seen", async () => {
    await upload(2, { reviews: 1 });
    const one = await participant();
    const { given } = await finish(one, await state(one));
    expect(given).toHaveLength(2);
    expect((await more(one)).phase).toBe(KoraReviewPhase.NoneLeft);

    // A fourth rating is still useful, so someone who hasn't seen them gets them (spec 6.0 7.4).
    const two = await participant();
    expect((await state(two)).phase).toBe(KoraReviewPhase.Reviewing);
  });

  it("releases a conversation left unchanged for a day, giving it to the next reviewer", async () => {
    await upload(2, { reviews: 1 });
    const one = await participant();
    const held = await state(one);
    const heldId = ids(held.session)[0];
    await save(one, held.session?.id ?? "", exportOf(held)).expect(200);

    const two = await participant();
    const other = await state(two);
    expect(ids(other.session)).not.toContain(heldId);
    await finish(two, other);

    // Still held by the first reviewer, so nobody else is given it.
    const three = await participant();
    expect(ids((await state(three)).session)).not.toContain(heldId);

    await h.ctx.dataSource
      .getRepository(KoraSessionConversation)
      .update(
        { sessionId: held.session?.id },
        { lastActivityAt: new Date(Date.now() - milliseconds({ hours: 25 })) },
      );
    const four = await participant();
    expect(ids((await state(four)).session)).toEqual([heldId]);

    const stale = await save(
      one,
      held.session?.id ?? "",
      exportOf(held, { done: [heldId] }),
    ).expect(200);
    expect(stale.body).toEqual({ ended: false, removed: [heldId] });
  });

  it("waits for the project to be active, then lets an open session finish after it closes", async () => {
    await upload(6);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    const browser = await participant();
    expect((await state(browser)).phase).toBe(KoraReviewPhase.NotActive);

    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
    const s = await state(browser);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Closed);
    expect((await state(browser)).session?.id).toBe(s.session?.id);
    await finish(browser, s);
    expect((await more(browser)).phase).toBe(KoraReviewPhase.NoneLeft);
  });

  it("never shows a risk the reviewer opted out of, and counts the opt-out for admins", async () => {
    await upload(8, { reviews: 1 });
    const browser = await participant();
    const fear = "fear_trauma_and_distress";
    expect(await preferences(browser, { optOutRisks: [fear] })).toEqual({
      optOutRisks: [fear],
      extendedOptIn: false,
    });

    const { given } = await finish(browser, await more(browser));
    expect(given.length).toBeGreaterThan(0);
    const servedRisks = served((await state(browser)).session).map(
      (c) => c.riskId,
    );
    expect(servedRisks).not.toContain(fear);
    expect((await state(browser)).optOutRisks).toEqual([fear]);

    const { categories } = (
      await request(h.ctx.app.getHttpServer())
        .get("/kora/admin/categories")
        .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`)
        .expect(200)
    ).body;
    expect(categories).toContainEqual({
      category: fear,
      conversations: 4,
      reviewsNeeded: 4,
      optedOut: 1,
    });
  });

  it("serves KORA's test corpus, which has no comprehension question", async () => {
    const noComprehension = {
      comprehension_options: undefined,
      comprehension_correct: undefined,
    };
    await upload(0, {
      extra: [
        koraConversation("T1", { item_type: "test", ...noComprehension }),
        koraConversation("T2", { item_type: "test", ...noComprehension }),
      ],
    });
    const browser = await participant();

    const s = await state(browser);
    expect(s.phase).toBe(KoraReviewPhase.Reviewing);
    expect(["T1", "T2"]).toContain(ids(s.session)[0]);
    expect(s.session?.items[0].item.comprehension).toBeNull();
    expect(s.session?.items[0].item.kind).toBe("rated");
  });

  it("keeps a member's reviewer apart from any participant's", async () => {
    await upload(6);
    const member = request
      .agent(h.ctx.app.getHttpServer())
      .set("Authorization", `Bearer ${h.ctx.accessToken}`);
    await onboard(member);
    const asMember = await state(member);
    const asParticipant = await state(await participant());
    expect(asMember.phase).toBe(KoraReviewPhase.Reviewing);
    expect(asMember.reviewerId).not.toBe(asParticipant.reviewerId);
  });

  it("stores free text with contact details redacted", async () => {
    await upload(4);
    const browser = await participant();
    const s = await state(browser);
    await save(
      browser,
      s.session?.id ?? "",
      exportOf(s, {
        done: ids(s.session),
        worry: "mail me at someone@example.org",
      }),
    ).expect(200);
    const stored = await h.ctx.dataSource
      .getRepository(KoraSession)
      .findOneByOrFail({ id: s.session?.id });
    expect(JSON.stringify(stored.export)).toContain(`mail me at ${REDACTED}`);
    expect(JSON.stringify(stored.export)).not.toContain("someone@example.org");
  });
});
