import {
  UserAwayRange,
  UserAwayRangeReason,
} from 'src/user/entities/user-away-range.entity';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';

/** `YYYY-MM-DD`, `offsetDays` from today. Creation rejects past start dates. */
function day(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe('Away ranges (e2e)', () => {
  let ctx: TestContext;
  let awayRangeRepo: Repository<UserAwayRange>;

  const create = (body: Record<string, unknown>) =>
    request(ctx.app.getHttpServer())
      .post('/user/awayranges')
      .send({ startDay: day(7), endDay: day(14), ...body })
      .set('Authorization', `Bearer ${ctx.accessToken}`);

  const update = (id: number, body: Record<string, unknown>) =>
    request(ctx.app.getHttpServer())
      .patch(`/user/awayranges/${id}`)
      .send(body)
      .set('Authorization', `Bearer ${ctx.accessToken}`);

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

  describe('note normalization', () => {
    it('stores an explicit null note', async () => {
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

    it('trims surrounding whitespace from a note', async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: '  packing  ',
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe('packing');
    });

    it('collapses a blank note to null rather than an empty string', async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: '   ',
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBeNull();
    });

    it('rejects a non-string note', async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: 123,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('note required for the "other" reason', () => {
    it('rejects a null note', async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: null,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('note');
    });

    it('rejects a whitespace-only note', async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: '   ',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('note');
    });

    it('accepts a real note', async () => {
      const res = await create({
        reason: UserAwayRangeReason.OTHER,
        note: 'jury duty',
      });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe('jury duty');
    });
  });

  describe('updating a note', () => {
    let rangeId: number;

    beforeEach(async () => {
      const res = await create({
        reason: UserAwayRangeReason.VACATION,
        note: 'original',
      });
      expect(res.status).toBe(201);
      rangeId = res.body.id;
    });

    it('leaves the note alone when the field is omitted', async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBe('original');
    });

    it('clears the note when sent explicitly as null', async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
        note: null,
      });

      expect(res.status).toBe(200);
      expect(res.body.note).toBeNull();
    });

    it('clears the note when sent as whitespace', async () => {
      const res = await update(rangeId, {
        reason: UserAwayRangeReason.VACATION,
        note: '  ',
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
        expect.objectContaining({ note: 'original' }),
      );
    });
  });

  it('always serializes note, including when it is null', async () => {
    const withNote = await create({
      reason: UserAwayRangeReason.VACATION,
      note: 'skiing',
    });
    const withoutNote = await create({
      reason: UserAwayRangeReason.VACATION,
      note: null,
    });
    expect(withNote.status).toBe(201);
    expect(withoutNote.status).toBe(201);

    const res = await request(ctx.app.getHttpServer())
      .get('/user/awayranges')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const range of res.body) {
      expect(range).toHaveProperty('note');
    }
    const notes = res.body.map((range: { note: string | null }) => range.note);
    expect(new Set(notes)).toEqual(new Set([null, 'skiing']));
  });
});
