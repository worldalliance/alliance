import {
  KoraProjectStatus,
  KoraReviewPhase,
  KoraUserBatchStatus,
} from "@alliance/common/kora";
import { KoraAssignment } from "src/kora/entities/kora-assignment.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
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

  const { state, more, save, ids, exportOf, finish, participant, upload } =
    koraReviewClient(() => h);
  const home = async (browser: TestAgent): Promise<Home> =>
    (await browser.get("/kora/review/home").expect(200)).body;
  const assignments = () => h.ctx.dataSource.getRepository(KoraAssignment);
  const closeAssignment = (id: string | undefined) =>
    assignments().update({ id }, { closesAt: past() });

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

  it("offers a user-batch without reserving it, then tracks it once started", async () => {
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
          total: 3,
        }),
      ],
    });
    expect(await assignments().count()).toBe(0);

    const started = await more(browser);
    expect(started.assignment?.extra).toBe(false);
    const [first, second] = ids(started.assignment);
    await save(
      browser,
      started.assignment?.id ?? "",
      exportOf(started, { done: [first], optedOut: [second] }),
    ).expect(200);
    expect(await home(browser)).toEqual({
      totalRanked: 1,
      userBatches: [
        expect.objectContaining({
          id: started.assignment?.id,
          status: KoraUserBatchStatus.Open,
          closesAt: closesAt.toISOString(),
          progress: 2,
          total: 3,
        }),
      ],
    });
  });

  it("offers another user-batch once one is done, newest first", async () => {
    await upload(6);
    const browser = await participant();
    await finish(browser, await state(browser));

    const after = await home(browser);
    expect(after.totalRanked).toBe(3);
    expect(after.userBatches.map((b) => b.status)).toEqual([
      KoraUserBatchStatus.Ready,
      KoraUserBatchStatus.Done,
    ]);
    expect((await more(browser)).assignment?.extra).toBe(true);
  });

  it("closes a user-batch at its closing date and releases its unranked pairs", async () => {
    await upload(2, { perAssignment: 2, reviews: 1 });
    const one = await participant();
    const held = await state(one);
    const two = await participant();
    expect((await home(two)).userBatches).toEqual([]);

    await closeAssignment(held.assignment?.id);
    expect((await home(one)).userBatches).toEqual([
      expect.objectContaining({ status: KoraUserBatchStatus.Closed }),
    ]);
    expect((await home(two)).userBatches[0].status).toBe(
      KoraUserBatchStatus.Ready,
    );
    expect((await state(two)).phase).toBe(KoraReviewPhase.Reviewing);
  });

  it("starts a new user-batch for someone whose only one closed unfinished", async () => {
    await upload(6);
    const browser = await participant();
    const first = await state(browser);
    await closeAssignment(first.assignment?.id);

    const next = await state(browser);
    expect(next.phase).toBe(KoraReviewPhase.Reviewing);
    expect(next.assignment?.id).not.toBe(first.assignment?.id);
    expect(next.assignment?.extra).toBe(false);
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

  it("moves an unfinished user-batch's closing date with its batch's", async () => {
    const batchId = await upload(4);
    const browser = await participant();
    const s = await state(browser);
    const later = new Date(Date.now() + 60 * 86_400_000);
    await h.ctx.app
      .get(KoraBatchService)
      .setClosesAt({ batchId, closesAt: later });
    expect(
      (await assignments().findOneByOrFail({ id: s.assignment?.id })).closesAt,
    ).toEqual(later);
  });

  it("offers nothing while the project isn't active", async () => {
    await upload(4);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    expect((await home(await participant())).userBatches).toEqual([]);
  });
});
