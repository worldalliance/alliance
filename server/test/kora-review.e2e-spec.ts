import { KoraProjectStatus, KoraReviewPhase } from "@alliance/common/kora";
import { milliseconds } from "date-fns";
import { KoraAssignmentTranscript } from "src/kora/entities/kora-assignment-transcript.entity";
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
import { koraExport } from "./kora-conversations";
import {
  koraReviewClient,
  type ReviewTranscript,
} from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora reviews (e2e)", () => {
  let h: KoraHarness;

  const {
    state,
    more,
    save,
    next,
    ids,
    exportOf,
    finish,
    participant,
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

  it("gives a first visit one pair, the next when asked, and the same ones on return", async () => {
    await upload(5);
    const browser = await participant();

    const first = await state(browser);
    expect(first).toMatchObject({
      phase: KoraReviewPhase.Reviewing,
      collectProfile: true,
      assignment: { extra: false, size: 3, savedExport: null },
    });
    expect(first.assignment?.transcripts).toHaveLength(1);
    expect(first.assignment?.transcripts[0].contentHash).toMatch(/^sha256:/);
    const id = first.assignment?.id ?? "";

    expect(await next(browser, id)).toEqual(first.assignment?.transcripts[0]);
    const partial = exportOf(first, { done: ids(first.assignment) });
    expect((await save(browser, id, partial).expect(200)).body).toEqual({
      completed: false,
      removed: [],
    });
    const second = await next(browser, id);
    expect(second?.transcript.transcriptId).not.toBe(ids(first.assignment)[0]);

    const again = await state(browser);
    expect(again.assignment?.id).toBe(id);
    expect(ids(again.assignment)).toEqual([
      ...ids(first.assignment),
      second?.transcript.transcriptId,
    ]);
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
    const first = await finish(browser, await state(browser));
    expect(first.body).toEqual({ completed: true, removed: [] });
    expect(first.given).toHaveLength(3);
    expect((await state(browser)).phase).toBe(KoraReviewPhase.Finished);

    const extra = await more(browser);
    expect(extra.assignment?.extra).toBe(true);
    const second = await finish(browser, extra);
    expect(second.given.some((id) => first.given.includes(id))).toBe(false);
    expect(await state(browser)).toMatchObject({
      phase: KoraReviewPhase.Finished,
      extraReviews: 3,
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

  it("releases a pair left unchanged for a day, swapping it on the reviewer's return", async () => {
    await upload(2, { reviews: 1, perAssignment: 1 });
    const one = await participant();
    const held = await state(one);
    const heldId = ids(held.assignment)[0];
    await save(one, held.assignment?.id ?? "", exportOf(held)).expect(200);
    const two = await participant();
    const other = await state(two);
    expect(ids(other.assignment)).not.toContain(heldId);
    await finish(two, other);
    const three = await participant();
    expect((await state(three)).phase).toBe(KoraReviewPhase.NoneLeft);

    await h.ctx.dataSource
      .getRepository(KoraAssignmentTranscript)
      .update(
        { assignmentId: held.assignment?.id },
        { lastActivityAt: new Date(Date.now() - milliseconds({ hours: 25 })) },
      );
    expect(ids((await state(three)).assignment)).toEqual([heldId]);

    const stale = await save(
      one,
      held.assignment?.id ?? "",
      exportOf(held, { done: [heldId] }),
    ).expect(200);
    expect(stale.body).toEqual({ completed: false, removed: [heldId] });
    const back = await state(one);
    expect(back.phase).toBe(KoraReviewPhase.NoneLeft);
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

  it("never gives a reviewer pairs from a category they opted out of again", async () => {
    await upload(8, { reviews: 1 });
    const browser = await participant();
    const first = await state(browser);
    const fear = "fear_trauma_and_distress";
    const id = first.assignment?.id ?? "";
    await save(browser, id, {
      ...exportOf(first, { done: ids(first.assignment) }),
      optOutCategories: [fear],
    }).expect(200);

    const given: ReviewTranscript[] = [];
    for (let t = await next(browser, id); t; t = await next(browser, id)) {
      given.push(t);
      await save(browser, id, {
        ...exportOf(
          {
            ...first,
            assignment: first.assignment && {
              ...first.assignment,
              transcripts: [...(first.assignment?.transcripts ?? []), ...given],
            },
          },
          {
            done: [
              ...ids(first.assignment),
              ...given.map((g) => g.transcript.transcriptId),
            ],
          },
        ),
        optOutCategories: [fear],
      }).expect(200);
    }
    expect(given.length).toBeGreaterThan(0);
    expect(given.filter((t) => t.transcript.category === fear)).toEqual([]);
    expect((await state(browser)).optOutCategories).toEqual([fear]);

    const categories = (
      await request(h.ctx.app.getHttpServer())
        .get("/kora/admin/categories")
        .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`)
        .expect(200)
    ).body.categories;
    expect(categories).toContainEqual({
      category: fear,
      pairs: 4,
      reviewsNeeded:
        first.assignment?.transcripts[0].transcript.category === fear ? 3 : 4,
      optedOut: 1,
    });
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
        worry: "mail me at someone@example.org",
      }),
    ).expect(200);
    const stored = await h.ctx.dataSource
      .getRepository(KoraAssignment)
      .findOneByOrFail({ id: s.assignment?.id });
    expect(JSON.stringify(stored.export)).toContain(`mail me at ${REDACTED}`);
    expect(JSON.stringify(stored.export)).not.toContain("someone@example.org");
  });
});
