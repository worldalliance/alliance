import {
  KoraBatchEventKind,
  KoraProjectStatus,
  KoraReviewPhase,
} from "@alliance/common/kora";
import { NodeEnv } from "@alliance/common/node-env";
import { setEnv } from "@alliance/common/set-env";
import { KoraAssignment } from "src/kora/entities/kora-assignment.entity";
import { KoraBatchEvent } from "src/kora/entities/kora-batch-event.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import request from "supertest";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora batch retire, reactivate and delete (e2e)", () => {
  let h: KoraHarness;
  const { state, more, save, ids, exportOf, finish, participant, upload } =
    koraReviewClient(() => h);

  const admin = (method: "get" | "post" | "delete", path: string) =>
    request(h.ctx.app.getHttpServer())
      [method](`/kora/admin${path}`)
      .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`);
  const batchesOf = (assigned: string[]) =>
    new Set(assigned.map((id) => id.replace(/\d+$/, "")));
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
    await h.ctx.app.close();
  });

  it("retires a batch: unrated pairs leave, new assignments skip it, and reactivating brings it back", async () => {
    const older = await upload(4, { prefix: "A", perAssignment: 2 });
    const newer = await upload(4, { prefix: "B", perAssignment: 4 });
    const reviewer = await participant();
    const first = await state(reviewer);
    const [rated] = ids(first.assignment);
    await save(
      reviewer,
      first.assignment?.id ?? "",
      exportOf(first, { done: [rated] }),
    ).expect(200);

    const retired = await admin("post", `/batches/${newer}/retire`).expect(200);
    expect(retired.body.retiredAt).not.toBeNull();

    const after = await state(reviewer);
    const kept = ids(after.assignment);
    expect(kept.filter((id) => id.startsWith("B"))).toEqual(
      rated.startsWith("B") ? [rated] : [],
    );
    expect(kept).toContain(rated);

    const fresh = await state(await participant());
    expect(batchesOf(ids(fresh.assignment))).toEqual(new Set(["A"]));
    expect(fresh.assignment?.transcripts).toHaveLength(2);

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

  it("completes an assignment left with nothing to rate, and says none are left once every batch is retired", async () => {
    const only = await upload(3);
    const reviewer = await participant();
    const s = await state(reviewer);

    await admin("post", `/batches/${only}/retire`).expect(200);

    expect((await state(reviewer)).phase).toBe(KoraReviewPhase.Finished);
    expect((await more(reviewer)).phase).toBe(KoraReviewPhase.NoneLeft);
    const stored = await h.ctx.dataSource
      .getRepository(KoraAssignment)
      .findOneByOrFail({ id: s.assignment?.id });
    expect(stored.completedAt).not.toBeNull();
  });

  it("accepts a save from a tool loaded before the retire, dropping the removed pairs", async () => {
    await upload(2, { prefix: "A", perAssignment: 2 });
    const newer = await upload(2, { prefix: "B", perAssignment: 4 });
    const reviewer = await participant();
    const loaded = await state(reviewer);
    expect(loaded.assignment?.transcripts).toHaveLength(4);

    await admin("post", `/batches/${newer}/retire`).expect(200);
    const kept = ids(loaded.assignment).filter((id) => id.startsWith("A"));

    expect(
      (
        await save(
          reviewer,
          loaded.assignment?.id ?? "",
          exportOf(loaded, { done: ids(loaded.assignment) }),
        ).expect(200)
      ).body,
    ).toEqual({ completed: true });
    const stored = await h.ctx.dataSource
      .getRepository(KoraAssignment)
      .findOneByOrFail({ id: loaded.assignment?.id });
    const results = JSON.stringify(stored.export);
    for (const id of kept) expect(results).toContain(`"${id}"`);
    expect(results).not.toContain('"B1"');
  });

  it("marks each exported line with its batches and whether they're retired", async () => {
    const older = await upload(2, { prefix: "A", perAssignment: 2 });
    const reviewer = await participant();
    await finish(reviewer, await state(reviewer));
    await admin("post", `/batches/${older}/retire`).expect(200);

    const exported = await admin("get", "/results/exports").expect(200);
    expect(exported.body.exports[0].koraBatches).toEqual([
      { id: older, retired: true },
    ]);
  });

  it("logs a completed assignment, and shows its export", async () => {
    await upload(2, { perAssignment: 2 });
    const reviewer = await participant();
    const s = await state(reviewer);
    await finish(reviewer, s);

    const [completed] = await events();
    expect(completed).toMatchObject({
      kind: KoraBatchEventKind.AssignmentCompleted,
      assignmentId: s.assignment?.id,
      reviewerId: s.reviewerId,
      ratingCount: 2,
      adminName: null,
    });
    const shown = await admin(
      "get",
      `/results/assignments/${s.assignment?.id}`,
    ).expect(200);
    expect(shown.body).toMatchObject({
      id: s.assignment?.id,
      reviewerId: s.reviewerId,
      export: { batchId: s.assignment?.id },
    });
    await admin("get", `/results/assignments/${crypto.randomUUID()}`).expect(
      404,
    );
  });

  it("deletes a batch with what hangs off it, after saying how much that is", async () => {
    const older = await upload(2, { prefix: "A", perAssignment: 2 });
    const reviewer = await participant();
    const first = await state(reviewer);
    await finish(reviewer, first);
    const newer = await upload(2, { prefix: "B", perAssignment: 2 });
    const other = await participant();
    const s = await state(other);
    await finish(other, s);

    const impact = await admin(
      "get",
      `/batches/${newer}/deletion-impact`,
    ).expect(200);
    expect(impact.body).toEqual({
      transcriptCount: 2,
      ratingCount: 2,
      assignmentCount: 1,
    });

    await admin("delete", `/batches/${newer}`).expect(204);

    const listed = await admin("get", "/batches").expect(200);
    expect(listed.body.map((b: { id: string }) => b.id)).toEqual([older]);
    expect(
      await h.ctx.dataSource
        .getRepository(KoraAssignment)
        .existsBy({ id: s.assignment?.id }),
    ).toBe(false);
    const logged = await events();
    expect(logged[0]).toMatchObject({
      kind: KoraBatchEventKind.Delete,
      batchId: newer,
      transcriptCount: 2,
      ratingCount: 2,
      assignmentCount: 1,
      adminName: "Test Admin",
    });
    const completedOf = (assignmentId: string | undefined) =>
      logged.find(
        (e: { assignmentId: string | null }) => e.assignmentId === assignmentId,
      );
    expect(completedOf(s.assignment?.id).assignmentDeleted).toBe(true);
    expect(completedOf(first.assignment?.id).assignmentDeleted).toBe(false);
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
