import {
  KoraBatchEventKind,
  KoraProjectStatus,
  KoraReviewPhase,
} from "@alliance/common/kora";
import { NodeEnv } from "@alliance/common/node-env";
import { setEnv } from "@alliance/common/set-env";
import { KoraBatchEvent } from "src/kora/entities/kora-batch-event.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { KoraSession } from "src/kora/entities/kora-session.entity";
import request from "supertest";
import { closeTestApp } from "./e2e-test-utils";
import { koraSessionExport } from "./kora-conversations";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora batch retire, reactivate and delete (e2e)", () => {
  let h: KoraHarness;
  const { finish, ids, more, next, participant, save, served, state, upload } =
    koraReviewClient(() => h);

  const admin = (method: "get" | "post" | "delete", path: string) =>
    request(h.ctx.app.getHttpServer())
      [method](`/kora/admin${path}`)
      .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`);
  const batchesOf = (conversationIds: string[]) =>
    new Set(conversationIds.map((id) => id.replace(/\d+$/, "")));
  const events = async () =>
    (await admin("get", "/batches/events").expect(200)).body;

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await h.ctx.dataSource.getRepository(KoraReviewer).deleteAll();
    await h.ctx.dataSource.getRepository(KoraBatch).deleteAll();
    await h.ctx.dataSource.getRepository(KoraBatchEvent).deleteAll();
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
  });

  afterAll(async () => {
    await closeTestApp(h.ctx.app);
  });

  it("retires a batch, so new sessions skip it, and reactivating brings it back", async () => {
    const older = await upload(2, { prefix: "A", reviews: 3 });
    const newer = await upload(2, { prefix: "B", reviews: 3 });

    await admin("post", `/batches/${newer}/retire`)
      .expect(200)
      .expect((res) => {
        expect(res.body.retiredAt).not.toBeNull();
      });

    const fresh = await state(await participant());
    expect(batchesOf(ids(fresh.session))).toEqual(new Set(["A"]));

    const reactivated = await admin(
      "post",
      `/batches/${newer}/reactivate`,
    ).expect(200);
    expect(reactivated.body.retiredAt).toBeNull();
    const listed = await admin("get", "/batches").expect(200);
    expect(
      listed.body.map((b: { id: string; retiredAt: string | null }) => [
        b.id,
        b.retiredAt,
      ]),
    ).toEqual([
      [newer, null],
      [older, null],
    ]);

    expect(
      (await events()).map((e: { kind: string; adminName: string }) => [
        e.kind,
        e.adminName,
      ]),
    ).toEqual([
      [KoraBatchEventKind.Reactivate, "Test Admin"],
      [KoraBatchEventKind.Retire, "Test Admin"],
      [KoraBatchEventKind.Upload, "Test Admin"],
      [KoraBatchEventKind.Upload, "Test Admin"],
    ]);
  });

  it("leaves a session a retire emptied with nothing to give, and says none are left", async () => {
    const only = await upload(3);
    const reviewer = await participant();
    const s = await state(reviewer);

    await admin("post", `/batches/${only}/retire`).expect(200);

    expect((await state(reviewer)).phase).toBe(KoraReviewPhase.NoneLeft);
    expect((await more(reviewer)).phase).toBe(KoraReviewPhase.NoneLeft);
    expect(
      await h.ctx.dataSource
        .getRepository(KoraSession)
        .existsBy({ id: s.session?.id }),
    ).toBe(true);
  });

  it("accepts a save from a tool loaded before the retire, dropping the removed conversation", async () => {
    await upload(2, { prefix: "A", reviews: 3 });
    const newer = await upload(2, { prefix: "B", reviews: 3 });
    const reviewer = await participant();
    const loaded = await state(reviewer);
    const id = loaded.session?.id ?? "";
    const given = [...served(loaded.session)];
    const judge = () =>
      save(
        reviewer,
        id,
        koraSessionExport({
          reviewerId: loaded.reviewerId,
          sessionId: id,
          conversations: given,
          done: given.map((c) => c.id),
        }),
      ).expect(200);
    while (!given.at(-1)?.id.startsWith("B")) {
      await judge();
      const more = await next(reviewer, id);
      if (!more.item) throw new Error("ran out before a B conversation");
      given.push({
        id: more.item.conversationId,
        riskId: more.item.riskId,
        contentHash: more.item.contentHash,
      });
    }
    const removed = given.at(-1)?.id ?? "";

    await admin("post", `/batches/${newer}/retire`).expect(200);
    const stale = koraSessionExport({
      reviewerId: loaded.reviewerId,
      sessionId: id,
      conversations: given,
      done: given.slice(0, -1).map((c) => c.id),
    });
    expect((await save(reviewer, id, stale).expect(200)).body).toEqual({
      ended: false,
      removed: [removed],
    });
    const stored = await h.ctx.dataSource
      .getRepository(KoraSession)
      .findOneByOrFail({ id });
    const ratings = JSON.stringify(stored.export);
    for (const kept of given.slice(0, -1)) {
      expect(ratings).toContain(`"${kept.id}"`);
    }
    expect(ratings).not.toContain(`"${removed}"`);
  });

  it("marks each exported line with its batches and whether they're retired", async () => {
    const older = await upload(2, { prefix: "A" });
    const reviewer = await participant();
    await finish(reviewer, await state(reviewer));
    await admin("post", `/batches/${older}/retire`).expect(200);

    const exported = await admin("get", "/results/exports").expect(200);
    expect(exported.body.exports[0].koraBatches).toEqual([
      { id: older, retired: true },
    ]);
  });

  it("logs a finished session, and shows its export", async () => {
    await upload(2);
    const reviewer = await participant();
    const s = await state(reviewer);
    await finish(reviewer, s);

    const [completed] = await events();
    expect(completed).toMatchObject({
      kind: KoraBatchEventKind.AssignmentCompleted,
      assignmentId: s.session?.id,
      reviewerId: s.reviewerId,
      ratingCount: 2,
      adminName: null,
    });
    const shown = await admin(
      "get",
      `/results/sessions/${s.session?.id}`,
    ).expect(200);
    expect(shown.body).toMatchObject({
      id: s.session?.id,
      reviewerId: s.reviewerId,
      export: { sessionId: s.session?.id },
    });
    await admin("get", `/results/sessions/${crypto.randomUUID()}`).expect(404);
  });

  it("deletes a batch with what hangs off it, after saying how much that is", async () => {
    const older = await upload(2, { prefix: "A" });
    const reviewer = await participant();
    const first = await state(reviewer);
    await finish(reviewer, first);
    const newer = await upload(2, { prefix: "B" });
    const other = await participant();
    const s = await state(other);
    await finish(other, s);

    const impact = await admin(
      "get",
      `/batches/${newer}/deletion-impact`,
    ).expect(200);
    expect(impact.body).toEqual({
      transcriptCount: 2,
      // Every rating in the second reviewer's session: it was started against this batch.
      ratingCount: 4,
      assignmentCount: 1,
    });

    await admin("delete", `/batches/${newer}`).expect(204);

    const listed = await admin("get", "/batches").expect(200);
    expect(listed.body.map((b: { id: string }) => b.id)).toEqual([older]);
    expect(
      await h.ctx.dataSource
        .getRepository(KoraSession)
        .existsBy({ id: s.session?.id }),
    ).toBe(false);
    const logged = await events();
    expect(logged[0]).toMatchObject({
      kind: KoraBatchEventKind.Delete,
      batchId: newer,
      transcriptCount: 2,
      ratingCount: 4,
      assignmentCount: 1,
      adminName: "Test Admin",
    });
    const completedOf = (sessionId: string | undefined) =>
      logged.find(
        (e: { assignmentId: string | null }) => e.assignmentId === sessionId,
      );
    expect(completedOf(s.session?.id).assignmentDeleted).toBe(true);
    expect(completedOf(first.session?.id).assignmentDeleted).toBe(false);
    await admin("delete", `/batches/${newer}`).expect(404);
  });

  it("offers no delete in production, and keeps every action from non-admins", async () => {
    const batch = await upload(1);
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = NodeEnv.Production;
    try {
      await admin("get", `/batches/${batch}/deletion-impact`).expect(404);
      await admin("delete", `/batches/${batch}`).expect(404);
    } finally {
      setEnv("NODE_ENV", saved);
    }

    const anon = request(h.ctx.app.getHttpServer());
    await anon.post(`/kora/admin/batches/${batch}/retire`).expect(401);
    await anon.get("/kora/admin/batches/events").expect(401);
    await anon.delete(`/kora/admin/batches/${batch}`).expect(401);
    await admin("post", `/batches/${crypto.randomUUID()}/retire`).expect(404);
  });
});
