import { Temporal } from "@js-temporal/polyfill";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "src/user/entities/user-away-range.entity";
import { DEFAULT_TIME_ZONE, User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";

/** `YYYY-MM-DD`, `offsetDays` from today. Creation rejects past start dates. */
function day(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe("Away ranges (e2e)", () => {
  let ctx: TestContext;
  let awayRangeRepo: Repository<UserAwayRange>;

  const create = (body: Record<string, unknown>) =>
    request(ctx.app.getHttpServer())
      .post("/user/awayranges")
      .send({ startDay: day(7), endDay: day(14), ...body })
      .set("Authorization", `Bearer ${ctx.accessToken}`);

  const update = (id: number, body: Record<string, unknown>) =>
    request(ctx.app.getHttpServer())
      .patch(`/user/awayranges/${id}`)
      .send(body)
      .set("Authorization", `Bearer ${ctx.accessToken}`);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    awayRangeRepo = ctx.dataSource.getRepository(UserAwayRange);
  });

  afterEach(async () => {
    await awayRangeRepo.delete({ userId: ctx.testUserId });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("note normalization", () => {
    it("stores an explicit null note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: null,
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeNull();
      expect(await awayRangeRepo.findOneByOrFail({ id: res.body.id })).toEqual(
        expect.objectContaining({ note: null }),
      );
    });

    it("trims surrounding whitespace from a note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: "  packing  ",
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe("packing");
    });

    it("collapses a blank note to null rather than an empty string", async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: "   ",
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeNull();
    });

    it("rejects a non-string note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: 123,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('note required for the "other" reason', () => {
    it("rejects a null note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: null,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("note");
    });

    it("rejects a whitespace-only note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: "   ",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("note");
    });

    it("accepts a real note", async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: "jury duty",
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe("jury duty");
    });
  });

  describe("updating a note", () => {
    let rangeId: number;

    beforeEach(async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: "original",
      });
      expect(res.status).toBe(201);
      rangeId = res.body.id;
    });

    it("leaves the note alone when the field is omitted", async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBe("original");
    });

    it("clears the note when sent explicitly as null", async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
        note: null,
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBeNull();
    });

    it("clears the note when sent as whitespace", async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
        note: "  ",
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBeNull();
    });

    it('rejects clearing the note while the reason is "other"', async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.OTHER,
        note: null,
      });

      expect(res.status).toBe(400);
      expect(await awayRangeRepo.findOneByOrFail({ id: rangeId })).toEqual(
        expect.objectContaining({ note: "original" }),
      );
    });
  });

  describe("a member's changes leave the elapsed part of a range alone", () => {
    const hoursFromNow = (hours: number) =>
      new Date(Date.now() + hours * 60 * 60 * 1000);
    const seed = (
      startDate: Date,
      endDate: Date,
      createdAt = hoursFromNow(-200),
    ) =>
      awayRangeRepo.save({
        userId: ctx.testUserId,
        startDate,
        endDate,
        createdAt,
        reason: UserAwayRangeReason.VACATION,
      });
    const accountZone = async () =>
      (
        await ctx.dataSource
          .getRepository(User)
          .findOneByOrFail({ id: ctx.testUserId })
      ).timeZone ?? DEFAULT_TIME_ZONE;
    const accountToday = async () =>
      Temporal.Now.plainDateISO(await accountZone()).toString();

    const remove = (path: string, token: string) =>
      request(ctx.app.getHttpServer())
        .delete(path)
        .set("Authorization", `Bearer ${token}`);

    it("deletes a range that has not started", async () => {
      const range = await seed(hoursFromNow(48), hoursFromNow(96));

      const res = await remove(`/user/awayranges/${range.id}`, ctx.accessToken);

      expect(res.status).toBe(200);
      expect(await awayRangeRepo.findOneBy({ id: range.id })).toBeNull();
    });

    it("ends a range that has begun now instead of deleting it", async () => {
      const startDate = hoursFromNow(-48);
      const range = await seed(startDate, hoursFromNow(48));

      const res = await remove(`/user/awayranges/${range.id}`, ctx.accessToken);

      expect(res.status).toBe(200);
      const saved = await awayRangeRepo.findOneByOrFail({ id: range.id });
      expect(saved.startDate).toEqual(startDate);
      expect(saved.endDate.getTime()).toBeLessThanOrEqual(Date.now());
      expect(saved.endDate.getTime()).toBeGreaterThan(Date.now() - 60_000);
    });

    it("deletes a range that began within an hour of its creation", async () => {
      const createdAt = new Date();
      const range = await seed(createdAt, hoursFromNow(48), createdAt);

      const res = await remove(`/user/awayranges/${range.id}`, ctx.accessToken);

      expect(res.status).toBe(200);
      expect(await awayRangeRepo.findOneBy({ id: range.id })).toBeNull();
    });

    it("gives a range backdated before its creation no undo hour", async () => {
      const range = await seed(hoursFromNow(-72), hoursFromNow(48), new Date());

      const shorten = await update(range.id, {
        reason: UserAwayRangeReason.VACATION,
        startDay: day(1),
      });
      expect(shorten.status).toBe(400);

      const res = await remove(`/user/awayranges/${range.id}`, ctx.accessToken);
      expect(res.status).toBe(200);
      const saved = await awayRangeRepo.findOneByOrFail({ id: range.id });
      expect(saved.endDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("rejects deleting a range that has ended, which an admin still can", async () => {
      const range = await seed(hoursFromNow(-96), hoursFromNow(-48));

      const memberRes = await remove(
        `/user/awayranges/${range.id}`,
        ctx.accessToken,
      );
      expect(memberRes.status).toBe(400);
      expect(await awayRangeRepo.findOneBy({ id: range.id })).not.toBeNull();

      const adminRes = await remove(
        `/user/admin/${ctx.testUserId}/awayranges/${range.id}`,
        ctx.adminAccessToken,
      );
      expect(adminRes.status).toBe(200);
      expect(await awayRangeRepo.findOneBy({ id: range.id })).toBeNull();
    });

    it("lets an admin change the dates of a range that has ended", async () => {
      const range = await seed(hoursFromNow(-96), hoursFromNow(-48));

      const res = await request(ctx.app.getHttpServer())
        .patch(`/user/admin/${ctx.testUserId}/awayranges/${range.id}`)
        .send({
          reason: UserAwayRangeReason.VACATION,
          startDay: day(-10),
          endDay: day(-8),
        })
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      const saved = await awayRangeRepo.findOneByOrFail({ id: range.id });
      expect(saved.startDate.getTime()).toBeLessThan(range.startDate.getTime());
      expect(saved.endDate.getTime()).toBeLessThan(range.endDate.getTime());
    });

    it("widens a mid-day start to its whole day when an admin submits that day", async () => {
      const range = await seed(hoursFromNow(-2), hoursFromNow(48));
      const startDay = Temporal.Instant.from(range.startDate.toISOString())
        .toZonedDateTimeISO(await accountZone())
        .toPlainDate()
        .toString();

      const res = await request(ctx.app.getHttpServer())
        .patch(`/user/admin/${ctx.testUserId}/awayranges/${range.id}`)
        .send({ reason: UserAwayRangeReason.VACATION, startDay })
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      const saved = await awayRangeRepo.findOneByOrFail({ id: range.id });
      expect(saved.startDate.getTime()).toBeLessThan(range.startDate.getTime());
    });

    it("rejects moving the start of a range that has begun", async () => {
      const startDate = hoursFromNow(-96);
      const range = await seed(startDate, hoursFromNow(96));

      const res = await update(range.id, {
        reason: UserAwayRangeReason.VACATION,
        startDay: day(1),
      });

      expect(res.status).toBe(400);
      expect(
        (await awayRangeRepo.findOneByOrFail({ id: range.id })).startDate,
      ).toEqual(startDate);
    });

    it("rejects changing a range that has ended", async () => {
      const endDate = hoursFromNow(-48);
      const range = await seed(hoursFromNow(-96), endDate);

      const res = await update(range.id, {
        reason: UserAwayRangeReason.VACATION,
        endDay: day(3),
      });

      expect(res.status).toBe(400);
      expect(
        (await awayRangeRepo.findOneByOrFail({ id: range.id })).endDate,
      ).toEqual(endDate);
    });

    it("still edits the note of a range that has ended", async () => {
      const range = await seed(hoursFromNow(-96), hoursFromNow(-48));

      const res = await update(range.id, {
        reason: UserAwayRangeReason.VACATION,
        note: "back home",
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBe("back home");
    });

    it("starts a range created for today no earlier than now", async () => {
      const before = Date.now();

      const res = await create({
        startDay: await accountToday(),
        reason: UserAwayRangeReason.VACATION,
      });

      expect(res.status).toBe(201);
      expect(new Date(res.body.startDate).getTime()).toBeGreaterThanOrEqual(
        before,
      );
    });

    it("removes a range created for today when deleted at once", async () => {
      const created = await create({
        startDay: await accountToday(),
        reason: UserAwayRangeReason.VACATION,
      });
      expect(created.status).toBe(201);

      const res = await remove(
        `/user/awayranges/${created.body.id}`,
        ctx.accessToken,
      );

      expect(res.status).toBe(200);
      expect(await awayRangeRepo.findOneBy({ id: created.body.id })).toBeNull();
    });

    it("keeps a mid-day start when an edit resubmits its day", async () => {
      const before = Date.now();
      const created = await create({
        startDay: await accountToday(),
        reason: UserAwayRangeReason.VACATION,
      });
      expect(created.status).toBe(201);
      expect(new Date(created.body.startDate).getTime()).toBeGreaterThanOrEqual(
        before,
      );
      const zone = await accountZone();
      const dayOf = (date: string) =>
        Temporal.Instant.from(date)
          .toZonedDateTimeISO(zone)
          .toPlainDate()
          .toString();

      const res = await update(created.body.id, {
        startDay: dayOf(created.body.startDate),
        endDay: dayOf(created.body.endDate),
        reason: UserAwayRangeReason.VACATION,
        note: "packing",
      });

      expect(res.status).toBe(200);
      expect(res.body.startDate).toBe(created.body.startDate);
      expect(res.body.endDate).toBe(created.body.endDate);
      expect(res.body.note).toBe("packing");
    });
  });

  it("always serializes note, including when it is null", async () => {
    const withNote = await create({
      reason: UserAwayRangeReason.VACATION,
      note: "skiing",
    });
    const withoutNote = await create({
      reason: UserAwayRangeReason.VACATION,
      note: null,
    });
    expect(withNote.status).toBe(201);
    expect(withoutNote.status).toBe(201);

    const res = await request(ctx.app.getHttpServer())
      .get("/user/awayranges")
      .set("Authorization", `Bearer ${ctx.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const range of res.body) {
      expect(range).toHaveProperty("note");
    }
    const notes = res.body.map((range: { note: string | null }) => range.note);
    expect(new Set(notes)).toEqual(new Set([null, "skiing"]));
  });
});
