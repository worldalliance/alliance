import { KoraProjectStatus, KoraReviewPhase } from "@alliance/common/kora";
import { milliseconds } from "date-fns";
import { KoraAssignment } from "src/kora/entities/kora-assignment.entity";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { REDACTED } from "src/kora/kora-redact";
import request from "supertest";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraHarness,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraExport } from "./kora-pairs";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora reviews (e2e)", () => {
  let h: KoraHarness;

  const { state, more, save, ids, exportOf, finish, participant, upload } =
    koraReviewClient(() => h);

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

  it("gives a first visit an assignment, and the same one on return", async () => {
    await upload(5);
    const browser = await participant();

    const first = await state(browser);
    expect(first).toMatchObject({
      phase: KoraReviewPhase.Reviewing,
      collectProfile: true,
      assignment: { extra: false, savedExport: null },
    });
    expect(first.assignment?.transcripts).toHaveLength(3);
    expect(first.assignment?.transcripts[0].contentHash).toMatch(/^sha256:/);

    const partial = exportOf(first, { done: [ids(first.assignment)[0]] });
    expect(
      (await save(browser, first.assignment?.id ?? "", partial).expect(200))
        .body,
    ).toEqual({ completed: false });
    const again = await state(browser);
    expect(again.assignment?.id).toBe(first.assignment?.id);
    expect(again.assignment?.savedExport).toMatchObject({
      currentTranscriptId: partial.currentTranscriptId,
    });
  });

  it("refuses an export for other content or another reviewer, and another's assignment", async () => {
    await upload(4);
    const browser = await participant();
    const s = await state(browser);
    const id = s.assignment?.id ?? "";

    const tampered = exportOf(s);
    tampered.results[0].contentHash = `sha256:${"0".repeat(64)}`;
    expect(
      (await save(browser, id, tampered).expect(400)).body.message,
    ).toContain("reviewed different content");
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

  it("finishes, then offers extra reviews from transcripts it hasn't seen, and counts them", async () => {
    await upload(6);
    const browser = await participant();
    const first = await state(browser);
    expect((await finish(browser, first)).body).toEqual({ completed: true });
    expect((await state(browser)).phase).toBe(KoraReviewPhase.Finished);

    const extra = await more(browser);
    expect(extra.assignment?.extra).toBe(true);
    expect(
      ids(extra.assignment).some((id) => ids(first.assignment).includes(id)),
    ).toBe(false);
    await save(
      browser,
      extra.assignment?.id ?? "",
      exportOf(extra, {
        done: ids(extra.assignment).slice(0, 2),
        optedOut: ids(extra.assignment).slice(2),
      }),
    ).expect(200);

    const after = await state(browser);
    expect(after).toMatchObject({
      phase: KoraReviewPhase.Finished,
      extraReviews: 2,
    });
  });

  it("stops asking for the profile once an export answers it", async () => {
    await upload(4);
    const browser = await participant();
    const s = await state(browser);
    await save(browser, s.assignment?.id ?? "", {
      ...exportOf(s),
      profile: koraExport({
        reviewerId: "",
        assignmentId: "",
        transcripts: [],
        profile: true,
      }).profile,
    }).expect(200);
    expect((await state(browser)).collectProfile).toBe(false);
  });

  it("says none are left once every transcript has its reviews", async () => {
    await upload(2, { reviews: 1 });
    const one = await participant();
    await finish(one, await state(one));

    const two = await participant();
    expect((await state(two)).phase).toBe(KoraReviewPhase.NoneLeft);
  });

  it("releases an untouched assignment's transcripts after seven days", async () => {
    await upload(2, { reviews: 1 });
    const one = await participant();
    const held = await state(one);
    const two = await participant();
    expect((await state(two)).phase).toBe(KoraReviewPhase.NoneLeft);

    await h.ctx.dataSource
      .getRepository(KoraAssignment)
      .update(
        { id: held.assignment?.id },
        { lastActivityAt: new Date(Date.now() - milliseconds({ days: 8 })) },
      );
    await h.ctx.dataSource.getRepository(KoraAssignment).delete({
      reviewerId: (await state(two)).reviewerId,
    });
    expect((await state(two)).phase).toBe(KoraReviewPhase.Reviewing);
    await finish(one, held);
  });

  it("waits for the project to be active, then lets an unfinished assignment finish after it closes", async () => {
    await upload(4);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
    const browser = await participant();
    expect((await state(browser)).phase).toBe(KoraReviewPhase.NotActive);

    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
    const s = await state(browser);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Closed);
    expect((await state(browser)).assignment?.id).toBe(s.assignment?.id);
    await finish(browser, s);
    expect((await more(browser)).phase).toBe(KoraReviewPhase.NoneLeft);
  });

  it("keeps a member's reviewer apart from any participant's", async () => {
    await upload(6);
    const member = request
      .agent(h.ctx.app.getHttpServer())
      .set("Authorization", `Bearer ${h.ctx.accessToken}`);
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
      s.assignment?.id ?? "",
      exportOf(s, {
        done: [ids(s.assignment)[0]],
        note: "mail me at someone@example.org",
      }),
    ).expect(200);
    const stored = await h.ctx.dataSource
      .getRepository(KoraAssignment)
      .findOneByOrFail({ id: s.assignment?.id });
    expect(JSON.stringify(stored.export)).toContain(`mail me at ${REDACTED}`);
    expect(JSON.stringify(stored.export)).not.toContain("someone@example.org");
  });
});
