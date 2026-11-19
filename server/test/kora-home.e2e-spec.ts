import {
  KoraProjectStatus,
  KoraReviewPhase,
  KoraUserBatchStatus,
} from "@alliance/common/kora";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KoraSession } from "src/kora/entities/kora-session.entity";
import { KoraBatchService } from "src/kora/kora-batch.service";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

type UserBatch = {
  id: string | null;
  status: KoraUserBatchStatus;
  releasedAt: string;
  closesAt: string | null;
  progress: number;
  total: number;
};
type Home = { totalRanked: number; userBatches: UserBatch[] };

const past = () => new Date(Date.now() - 60_000);

describe("Kora home base (e2e)", () => {
  let h: KoraHarness;

  const {
    exportOf,
    finish,
    ids,
    more,
    next,
    participant,
    save,
    state,
    upload,
  } = koraReviewClient(() => h);
  const home = async (browser: TestAgent): Promise<Home> =>
    (await browser.get("/kora/review/home").expect(200)).body;
  const sessions = () => h.ctx.dataSource.getRepository(KoraSession);
  const closeSession = (id: string | undefined) =>
    sessions().update({ id }, { closesAt: past() });

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
    await request(h.ctx.app.getHttpServer())
      .get("/kora/review/home")
      .expect(401);
  });

  it("offers a session without reserving anything, then tracks it once started", async () => {
    const closesAt = new Date(Date.now() + 10 * 86_400_000);
    await upload(5, { closesAt });
    const browser = await participant();

    expect(await home(browser)).toEqual({
      totalRanked: 0,
      userBatches: [
        expect.objectContaining({
          id: null,
          status: KoraUserBatchStatus.Ready,
          closesAt: closesAt.toISOString(),
        }),
      ],
    });
    expect(await sessions().count()).toBe(0);

    const started = await more(browser);
    expect(started.session?.number).toBe(1);
    const id = started.session?.id ?? "";
    const [first] = ids(started.session);
    await save(browser, id, exportOf(started, { done: [first] })).expect(200);
    await next(browser, id);

    const tracked = await state(browser);
    await save(
      browser,
      id,
      exportOf(tracked, { done: ids(tracked.session) }),
    ).expect(200);
    expect(await home(browser)).toEqual({
      totalRanked: 2,
      userBatches: [
        expect.objectContaining({
          id,
          status: KoraUserBatchStatus.Open,
          closesAt: closesAt.toISOString(),
          progress: 2,
          total: 2,
        }),
      ],
    });
  });

  it("offers another session once one is done, newest first", async () => {
    await upload(12, { reviews: 3 });
    const browser = await participant();
    await finish(browser, await state(browser));

    const after = await home(browser);
    expect(after.totalRanked).toBe(5);
    expect(after.userBatches.map((b) => b.status)).toEqual([
      KoraUserBatchStatus.Ready,
      KoraUserBatchStatus.Done,
    ]);
    expect((await more(browser)).session?.number).toBe(2);
  });

  it("closes a session at its closing date, and what it held goes back to the queue", async () => {
    await upload(2, { reviews: 1 });
    const one = await participant();
    const held = await state(one);
    await save(
      one,
      held.session?.id ?? "",
      exportOf(held, { done: ids(held.session) }),
    ).expect(200);
    const pending = (await next(one, held.session?.id ?? "")).item;
    expect(pending).toBeTruthy();

    await closeSession(held.session?.id);
    expect((await home(one)).userBatches).toEqual([
      expect.objectContaining({ status: KoraUserBatchStatus.Closed }),
    ]);

    // The closed session reserves nothing, so the conversation it never judged is served again.
    const two = await participant();
    const fresh = await state(two);
    expect(fresh.phase).toBe(KoraReviewPhase.Reviewing);
    expect(ids(fresh.session)).toContain(pending?.conversationId);
  });

  it("starts a new session for someone whose only one closed unfinished", async () => {
    await upload(6);
    const browser = await participant();
    const first = await state(browser);
    await closeSession(first.session?.id);

    const after = await state(browser);
    expect(after.phase).toBe(KoraReviewPhase.Reviewing);
    expect(after.session?.id).not.toBe(first.session?.id);
    expect(after.session?.number).toBe(2);
  });

  it("offers nothing from a batch past its closing date", async () => {
    const batchId = await upload(4);
    await h.ctx.dataSource
      .getRepository(KoraBatch)
      .update({ id: batchId }, { closesAt: past() });
    const browser = await participant();
    expect((await home(browser)).userBatches).toEqual([]);
    expect((await state(browser)).phase).toBe(KoraReviewPhase.NoneLeft);
  });

  it("moves an open session's closing date with its batch's", async () => {
    const batchId = await upload(4);
    const browser = await participant();
    const s = await state(browser);
    const later = new Date(Date.now() + 60 * 86_400_000);
    await h.ctx.app
      .get(KoraBatchService)
      .setClosesAt({ batchId, closesAt: later });
    expect(
      (await sessions().findOneByOrFail({ id: s.session?.id })).closesAt,
    ).toEqual(later);
  });

  it("offers nothing while the project isn't active", async () => {
    await upload(4);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    expect((await home(await participant())).userBatches).toEqual([]);
  });
});
