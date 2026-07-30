import { EventLog, EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { MmsOptout } from 'src/mms/mms-optout.entity';
import { MmsModule } from 'src/mms/mms.module';
import { Mms } from 'src/mms/mms.entity';
import { MmsService } from 'src/mms/mms.service';
import { ReferralSource, User } from 'src/user/entities/user.entity';
import supertest from 'supertest';
import type { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';

let ctx: TestContext;
const pendingEventLogs = new Set<ReturnType<EventLogService['sendMessage']>>();

const drainEventLogs = async (): Promise<void> => {
  await Promise.allSettled([...pendingEventLogs]);
};

beforeAll(async () => {
  ctx = await createTestApp([MmsModule]);
  const eventLogService = ctx.app.get(EventLogService);
  const sendMessage = eventLogService.sendMessage.bind(eventLogService);
  jest.spyOn(eventLogService, 'sendMessage').mockImplementation((data) => {
    const pending = sendMessage(data);
    pendingEventLogs.add(pending);
    void pending.then(
      () => pendingEventLogs.delete(pending),
      () => pendingEventLogs.delete(pending),
    );
    return pending;
  });
});

afterEach(async () => {
  await drainEventLogs();
});

afterAll(async () => {
  await drainEventLogs();
  await ctx.app.close();
});

const eventually = async <T>(
  get: () => Promise<T>,
  ready: (value: T) => boolean,
): Promise<T> => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await get();
    if (ready(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timed out waiting for the expected event log row');
};

describe('Mms Twilio address columns (e2e)', () => {
  let mmsRepo: Repository<Mms>;
  let mmsService: MmsService;

  beforeAll(() => {
    mmsRepo = ctx.dataSource.getRepository(Mms);
    mmsService = ctx.app.get(MmsService);
  });

  const save = async (to: string, from: string) => {
    const saved = await mmsRepo.save(
      mmsRepo.create({
        to,
        from,
        body: 'hello',
        status: 'sent',
        twilioSid: 'test-sid',
      }),
    );
    return mmsRepo.findOneByOrFail({ id: saved.id });
  };

  it('preserves Twilio recipient addresses exactly', async () => {
    for (const recipient of [
      '+14155552671',
      '(415) 555-2671',
      '894546',
      'whatsapp:+14155552671',
    ]) {
      const stored = await save(recipient, '+14155552672');

      expect(stored.to).toBe(recipient);
    }
  });

  it('preserves Twilio sender identifiers exactly', async () => {
    for (const sender of ['TLNET', '2650011', '+59039149', '415.555.2672']) {
      const stored = await save('+14155552671', sender);

      expect(stored.from).toBe(sender);
    }
  });

  it('refreshes only fields owned by Twilio', async () => {
    const original = await mmsRepo.save(
      mmsRepo.create({
        to: '+14155552671',
        from: '+15555550100',
        body: 'original body',
        status: 'queued',
        twilioSid: 'refresh-test-sid',
        cid: 'local-correlation-id',
        clickedLink: true,
      }),
    );
    Object.defineProperty(mmsService, 'twilioClient', {
      configurable: true,
      value: {
        messages: {
          get: () => ({
            fetch: async () => ({
              id: original.id + 1,
              to: '+442079460958',
              from: 'TLNET',
              body: 'provider body',
              status: 'delivered',
              errorCode: null,
              errorMessage: null,
              cid: 'provider-correlation-id',
              clickedLink: false,
            }),
          }),
        },
      },
    });

    const refreshed = await mmsService.refreshMmsData(original);

    expect(refreshed).toMatchObject({
      id: original.id,
      to: '+442079460958',
      from: 'TLNET',
      body: 'provider body',
      status: 'delivered',
      errorCode: null,
      errorMessage: null,
      cid: 'local-correlation-id',
      clickedLink: true,
    });
  });

  it('normalizes the opt-out log the same way', async () => {
    const optoutRepo = ctx.dataSource.getRepository(MmsOptout);
    const saved = await optoutRepo.save(
      optoutRepo.create({
        phoneNumber: '(415) 555-2671',
        reason: 'keyword',
        rawBody: 'STOP',
      }),
    );

    const stored = await optoutRepo.findOneByOrFail({ id: saved.id });
    expect(stored.phoneNumber).toBe('+14155552671');
    expect(stored.rawBody).toBe('STOP');
  });
});

describe('Inbound MMS keywords (e2e)', () => {
  let userRepo: Repository<User>;
  let optoutRepo: Repository<MmsOptout>;
  let eventLogRepo: Repository<EventLog>;
  let memberId: number;

  const TWILIO_NUMBER = '+15555550100';

  const inbound = (from: string, body: string, to = TWILIO_NUMBER) =>
    supertest(ctx.app.getHttpServer())
      .post('/mms/inbound')
      .type('form')
      .send({ From: from, To: to, Body: body });

  const unsubscribed = async () =>
    (await userRepo.findOneByOrFail({ id: memberId })).phoneNumberUnsubscribed;

  const resubscribeLog = () =>
    eventLogRepo.find({
      where: { event: EventType.SmsResubscribe },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });

  beforeAll(async () => {
    userRepo = ctx.dataSource.getRepository(User);
    optoutRepo = ctx.dataSource.getRepository(MmsOptout);
    eventLogRepo = ctx.dataSource.getRepository(EventLog);

    const member = await userRepo.save(
      userRepo.create({
        email: 'stopper@example.com',
        password: 'pass',
        name: 'Stopper',
        referralSource: ReferralSource.None,
        phoneNumber: '(415) 555-9001',
      }),
    );
    memberId = member.id;

    expect((await userRepo.findOneByOrFail({ id: memberId })).phoneNumber).toBe(
      '+14155559001',
    );
  });

  beforeEach(async () => {
    await userRepo.update({ id: memberId }, { phoneNumberUnsubscribed: false });
    await eventLogRepo.delete({ event: EventType.SmsResubscribe });
  });

  it('unsubscribes the member who texts STOP', async () => {
    const res = await inbound('+14155559001', 'STOP');

    expect(res.status).toBe(201);
    expect(res.text).toBe('');
    expect(await unsubscribed()).toBe(true);
  });

  it('logs the opt-out with the message verbatim', async () => {
    await inbound('+14155559001', 'stop');

    const logged = await optoutRepo.findOneOrFail({
      where: { phoneNumber: '+14155559001' },
      order: { createdAt: 'DESC' },
      relations: { user: true },
    });
    expect(logged.user.id).toBe(memberId);
    expect(logged.reason).toBe('stop_keyword');
    expect(logged.rawBody).toBe('stop');
  });

  it('rolls back the opt-out audit if unsubscribing the member fails', async () => {
    await ctx.dataSource.query(`
      CREATE FUNCTION fail_test_stop_update() RETURNS trigger AS $$
      BEGIN
        IF NEW."phoneNumber" = '+14155559001'
          AND NEW."phoneNumberUnsubscribed" = true THEN
          RAISE EXCEPTION 'forced STOP update failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await ctx.dataSource.query(`
      CREATE TRIGGER fail_test_stop_update
      BEFORE UPDATE OF "phoneNumberUnsubscribed" ON "user"
      FOR EACH ROW EXECUTE FUNCTION fail_test_stop_update()
    `);

    try {
      const auditCountBefore = await optoutRepo.countBy({
        phoneNumber: '+14155559001',
      });

      const res = await inbound('+14155559001', 'STOP');

      expect(res.status).toBe(500);
      expect(await unsubscribed()).toBe(false);
      expect(await optoutRepo.countBy({ phoneNumber: '+14155559001' })).toBe(
        auditCountBefore,
      );
    } finally {
      await ctx.dataSource.query(
        `DROP TRIGGER IF EXISTS fail_test_stop_update ON "user"`,
      );
      await ctx.dataSource.query(
        `DROP FUNCTION IF EXISTS fail_test_stop_update()`,
      );
    }
  });

  it('resubscribes the member who texts START', async () => {
    await inbound('+14155559001', 'STOP');
    expect(await unsubscribed()).toBe(true);

    await inbound('+14155559001', 'START');

    expect(await unsubscribed()).toBe(false);
  });

  it('logs the resubscribe against the member, with the message verbatim', async () => {
    await inbound('+14155559001', 'STOP');

    await inbound('+14155559001', 'start');

    const [logged] = await eventually(
      resubscribeLog,
      (rows) => rows.length > 0,
    );
    expect(logged!.user?.id).toBe(memberId);
    expect(logged!.message).toContain('Stopper');
    expect(logged!.blob).toMatchObject({
      phoneNumber: '+14155559001',
      rawBody: 'start',
    });
  });

  it('announces no resubscribe if the member cannot be updated', async () => {
    await inbound('+14155559001', 'STOP');
    expect(await unsubscribed()).toBe(true);
    await drainEventLogs();
    await eventLogRepo.delete({ event: EventType.SmsResubscribe });

    await ctx.dataSource.query(`
      CREATE FUNCTION fail_test_start_update() RETURNS trigger AS $$
      BEGIN
        IF NEW."phoneNumber" = '+14155559001'
          AND NEW."phoneNumberUnsubscribed" = false THEN
          RAISE EXCEPTION 'forced START update failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await ctx.dataSource.query(`
      CREATE TRIGGER fail_test_start_update
      BEFORE UPDATE OF "phoneNumberUnsubscribed" ON "user"
      FOR EACH ROW EXECUTE FUNCTION fail_test_start_update()
    `);

    try {
      const res = await inbound('+14155559001', 'START');

      expect(res.status).toBe(500);
      expect(await unsubscribed()).toBe(true);
      await drainEventLogs();
      expect(await resubscribeLog()).toEqual([]);
    } finally {
      await ctx.dataSource.query(
        `DROP TRIGGER IF EXISTS fail_test_start_update ON "user"`,
      );
      await ctx.dataSource.query(
        `DROP FUNCTION IF EXISTS fail_test_start_update()`,
      );
    }
  });

  it('logs a resubscribe from a number nobody has on file', async () => {
    await inbound('+14155559999', 'START');

    const [logged] = await eventually(
      resubscribeLog,
      (rows) => rows.length > 0,
    );
    expect(logged!.user).toBeNull();
    expect(logged!.message).toContain('+14155559999');
  });

  it('matches the member when STOP arrives in another format', async () => {
    const res = await inbound('(415) 555-9001', 'STOP');

    expect(res.status).toBe(201);
    expect(await unsubscribed()).toBe(true);
  });

  it('matches the member when START arrives in another format', async () => {
    await inbound('+14155559001', 'STOP');
    expect(await unsubscribed()).toBe(true);

    await inbound('415.555.9001', 'START');

    expect(await unsubscribed()).toBe(false);
  });

  it('accepts an opt-out from a number nobody has on file', async () => {
    const res = await inbound('+14155559999', 'STOP');

    expect(res.status).toBe(201);
    expect(await optoutRepo.countBy({ phoneNumber: '+14155559999' })).toBe(0);
  });

  it('ignores a message that is not a keyword', async () => {
    const res = await inbound('+14155559001', 'hello there');

    expect(res.status).toBe(201);
    expect(await unsubscribed()).toBe(false);
  });

  it('logs the inbound recipient address exactly as Twilio sent it', async () => {
    const recipient = '+1 415 555 2671';
    const previousCount = await eventLogRepo.countBy({
      event: EventType.SmsInbound,
    });

    const res = await inbound('+14155559001', 'hello there', recipient);

    expect(res.status).toBe(201);
    const logs = await eventually(
      () =>
        eventLogRepo.find({
          where: { event: EventType.SmsInbound },
          order: { createdAt: 'DESC' },
        }),
      (rows) => rows.length > previousCount,
    );
    expect(logs[0]!.blob).toMatchObject({ to: recipient });
  });
});

describe('Inbound MMS keywords for a shared number (e2e)', () => {
  let userRepo: Repository<User>;
  let optoutRepo: Repository<MmsOptout>;
  let eventLogRepo: Repository<EventLog>;
  let memberIds: number[];

  const SHARED = '+14155559002';

  const inbound = (from: string, body: string) =>
    supertest(ctx.app.getHttpServer())
      .post('/mms/inbound')
      .type('form')
      .send({ From: from, To: '+15555550100', Body: body });

  const unsubscribedFlags = async () =>
    Promise.all(
      memberIds.map(
        async (id) =>
          (await userRepo.findOneByOrFail({ id })).phoneNumberUnsubscribed,
      ),
    );

  beforeAll(async () => {
    userRepo = ctx.dataSource.getRepository(User);
    optoutRepo = ctx.dataSource.getRepository(MmsOptout);
    eventLogRepo = ctx.dataSource.getRepository(EventLog);

    const members = await Promise.all(
      [
        ['sharer-a@example.com', 'Sharer A', '(415) 555-9002'],
        ['sharer-b@example.com', 'Sharer B', '415.555.9002'],
      ].map(([email, name, phoneNumber]) =>
        userRepo.save(
          userRepo.create({
            email,
            password: 'pass',
            name,
            referralSource: ReferralSource.None,
            phoneNumber,
          }),
        ),
      ),
    );
    memberIds = members.map((member) => member.id);

    expect(await userRepo.countBy({ phoneNumber: SHARED })).toBe(2);
  });

  beforeEach(async () => {
    await userRepo.update(
      { phoneNumber: SHARED },
      { phoneNumberUnsubscribed: false },
    );
    await optoutRepo.delete({ phoneNumber: SHARED });
    await eventLogRepo.delete({ event: EventType.SmsResubscribe });
  });

  const byId = (a: number, b: number) => a - b;

  it('unsubscribes every member on the number', async () => {
    const res = await inbound(SHARED, 'STOP');

    expect(res.status).toBe(201);
    expect(await unsubscribedFlags()).toEqual([true, true]);
  });

  it('logs the opt-out against each member, not just one', async () => {
    await inbound(SHARED, 'STOP');

    const logged = await optoutRepo.find({
      where: { phoneNumber: SHARED },
      relations: { user: true },
    });
    expect(logged.map((row) => row.user.id).sort(byId)).toEqual(
      [...memberIds].sort(byId),
    );
  });

  it('resubscribes every member on the number', async () => {
    await inbound(SHARED, 'STOP');
    expect(await unsubscribedFlags()).toEqual([true, true]);

    await inbound(SHARED, 'START');

    expect(await unsubscribedFlags()).toEqual([false, false]);
  });

  it('logs the resubscribe against each member, not just one', async () => {
    await inbound(SHARED, 'START');

    const logged = await eventually(
      () =>
        eventLogRepo.find({
          where: { event: EventType.SmsResubscribe },
          relations: { user: true },
        }),
      (rows) => rows.length >= memberIds.length,
    );
    const attributed = logged
      .map((row) => row.user?.id)
      .filter((id): id is number => id !== undefined)
      .sort(byId);
    expect(attributed).toEqual([...memberIds].sort(byId));
  });
});
