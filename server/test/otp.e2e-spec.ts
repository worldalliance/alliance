import { OtpError } from "@alliance/common/otp";
import { R } from "@alliance/common/result";
import { OtpChallenge } from "src/otp/otp-challenge.entity";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import { OtpRateEvent } from "src/otp/otp-rate-event.entity";
import { OtpModule } from "src/otp/otp.module";
import { type OtpContact, OtpService } from "src/otp/otp.service";
import { randomToken } from "src/utils/random";
import { createTestApp, eventually, type TestContext } from "./e2e-test-utils";
import {
  captureSentCodes,
  forgetRateEvents,
  type SentCodes,
  skipResendWait,
  uniqueEmail,
  uniquePhone,
  wrongCode,
} from "./otp-fixtures";

const IP = "203.0.113.7";
const OTP_GATE = 7_190_001;

const email = (destination = uniqueEmail()): OtpContact => ({
  channel: OtpChannel.Email,
  destination,
});

describe("One-time codes (e2e)", () => {
  let ctx: TestContext;
  let otp: OtpService;
  let sent: SentCodes;

  const challenges = () => ctx.dataSource.getRepository(OtpChallenge);

  const start = (contact: OtpContact = email()) =>
    otp.start({
      purpose: OtpPurpose.ParticipantSignIn,
      contact,
      ip: IP,
      webOtpHost: "localhost",
    });

  const started = async (contact?: OtpContact) => {
    const result = await start(contact);
    if (!result.ok) throw new Error(`code not sent: ${result.error.error}`);
    return { browserToken: result.value.browserToken, code: sent.lastCode() };
  };

  const verify = (browserToken: string, code: string) =>
    otp.verify({
      purpose: OtpPurpose.ParticipantSignIn,
      browserToken,
      code,
      ip: IP,
    });

  const throttledFor = (result: Awaited<ReturnType<typeof start>>): number => {
    if (result.ok || result.error.error !== OtpError.Throttled) {
      throw new Error("expected a throttle");
    }
    return result.error.retryAt.getTime() - Date.now();
  };

  const waitingUpdates = (count: number, waitEvents: string[]) =>
    eventually(
      (): Promise<{ waiting: number }[]> =>
        ctx.dataSource.query(
          `SELECT count(*)::int AS waiting FROM pg_stat_activity
           WHERE wait_event = ANY($1) AND query ILIKE 'UPDATE%otp_challenge%'`,
          [waitEvents],
        ),
      ([row]) => row.waiting >= count,
      `${count} challenge updates waiting on ${waitEvents.join(" or ")}`,
    );

  const refusal = async (browserToken: string, code: string) => {
    const result = await verify(browserToken, code);
    return result.ok ? null : result.error.error;
  };

  beforeAll(async () => {
    ctx = await createTestApp([OtpModule]);
    otp = ctx.app.get(OtpService);
    sent = captureSentCodes(ctx);
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("refuses a code after four wrong guesses and a fifth", async () => {
    const { browserToken, code } = await started();
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(await refusal(browserToken, wrongCode(code))).toBe(
        OtpError.WrongCode,
      );
    }
    expect(await refusal(browserToken, wrongCode(code))).toBe(
      OtpError.CodeInvalid,
    );
    expect(await refusal(browserToken, code)).toBe(OtpError.CodeInvalid);
  });

  it("refuses a code after ten minutes", async () => {
    const { browserToken, code } = await started();
    await challenges()
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    expect(await refusal(browserToken, code)).toBe(OtpError.CodeInvalid);
  });

  it("accepts a code only with the token of the browser that asked", async () => {
    const { browserToken, code } = await started();
    expect(await refusal(randomToken(32), code)).toBe(OtpError.CodeInvalid);
    expect(await verify(browserToken, code)).toEqual(
      R.success(expect.objectContaining({ channel: OtpChannel.Email })),
    );
  });

  it("waits a minute between codes, and a new code replaces the old one in every browser", async () => {
    const contact = email();
    const first = await started(contact);

    expect(throttledFor(await start(contact))).toBeGreaterThan(59 * 1000);

    await skipResendWait(ctx);
    const second = await started(contact);
    expect(await refusal(first.browserToken, first.code)).toBe(
      OtpError.CodeInvalid,
    );
    expect(await refusal(second.browserToken, second.code)).toBeNull();
  });

  it("voids the old code when a send fails, and still counts the attempt", async () => {
    const contact: OtpContact = {
      channel: OtpChannel.Sms,
      destination: uniquePhone(),
    };
    const first = await started(contact);
    await skipResendWait(ctx);

    sent.failDelivery();
    expect(await start(contact)).toEqual(
      R.failure({ error: OtpError.DeliveryFailed }),
    );
    expect(
      await challenges().countBy({ destination: contact.destination }),
    ).toBe(0);
    expect(await refusal(first.browserToken, first.code)).toBe(
      OtpError.CodeInvalid,
    );
    expect(
      await ctx.dataSource.getRepository(OtpRateEvent).count(),
    ).toBeGreaterThanOrEqual(4);
  });

  it("lets a code succeed once, even when two requests race it", async () => {
    const { browserToken, code } = await started();
    const results = await Promise.all([
      verify(browserToken, code),
      verify(browserToken, code),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await refusal(browserToken, code)).toBe(OtpError.CodeInvalid);
  });

  it("counts a guess against the five before comparing it", async () => {
    const { browserToken, code } = await started();
    const ds = ctx.dataSource;
    const gate = ds.createQueryRunner();
    await gate.connect();
    await gate.query("SELECT pg_advisory_lock($1)", [OTP_GATE]);
    await ds.query(`
      CREATE FUNCTION otp_test_gate() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_advisory_lock_shared(${OTP_GATE});
        PERFORM pg_advisory_unlock_shared(${OTP_GATE});
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
    await ds.query(`
      CREATE TRIGGER otp_test_gate BEFORE UPDATE ON otp_challenge
      FOR EACH STATEMENT EXECUTE FUNCTION otp_test_gate()
    `);

    const guesses: Promise<unknown>[] = [];
    try {
      guesses.push(
        ...Array.from({ length: 5 }, () =>
          verify(browserToken, wrongCode(code)),
        ),
      );
      await waitingUpdates(5, ["advisory"]);
      guesses.push(verify(browserToken, code));
      await waitingUpdates(6, ["advisory"]);
    } finally {
      await gate.query("SELECT pg_advisory_unlock($1)", [OTP_GATE]);
      await gate.release();
      await Promise.allSettled(guesses);
      await ds.query("DROP TRIGGER otp_test_gate ON otp_challenge");
      await ds.query("DROP FUNCTION otp_test_gate");
    }
  });

  it("refuses a guess when the code ran out of attempts while it waited", async () => {
    const { browserToken, code } = await started();
    const holder = ctx.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.query(`UPDATE otp_challenge SET "wrongAttempts" = 5`);

    let guess: ReturnType<typeof verify> | undefined;
    try {
      guess = verify(browserToken, code);
      await waitingUpdates(1, ["transactionid", "tuple"]);
    } finally {
      await holder.commitTransaction();
      await holder.release();
    }
    expect(await guess).toEqual(R.failure({ error: OtpError.CodeInvalid }));
  });

  it("reports a pending code until it runs out of attempts or expires", async () => {
    const pending = (browserToken: string) =>
      otp.pending({ purpose: OtpPurpose.ParticipantSignIn, browserToken });
    const contact = email();
    const exhausted = await started(contact);
    const shown = await pending(exhausted.browserToken);
    expect(shown).toEqual(expect.objectContaining(contact));
    expect(
      (shown?.resendAvailableAt.getTime() ?? 0) - Date.now(),
    ).toBeGreaterThan(59 * 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      await verify(exhausted.browserToken, wrongCode(exhausted.code));
    }
    expect(await pending(exhausted.browserToken)).toBeNull();

    const expired = await started();
    await challenges()
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    expect(await pending(expired.browserToken)).toBeNull();
  });

  it("refuses an abandoned code", async () => {
    const { browserToken, code } = await started();
    await otp.abandon({ purpose: OtpPurpose.ParticipantSignIn, browserToken });
    expect(await refusal(browserToken, code)).toBe(OtpError.CodeInvalid);
  });

  it("sends five codes an hour to one contact, whatever its case", async () => {
    const destination = uniqueEmail();
    for (let n = 0; n < 5; n++) {
      await started(email(n % 2 ? destination.toUpperCase() : destination));
      await skipResendWait(ctx);
    }
    expect(throttledFor(await start(email(destination)))).toBeGreaterThan(
      59 * 60 * 1000,
    );
  });

  it("sends thirty codes a minute from one IP", async () => {
    for (let n = 0; n < 30; n++) {
      await started();
    }
    expect(throttledFor(await start())).toBeGreaterThan(0);
  });

  it("checks thirty codes a minute from one IP", async () => {
    const pending: { browserToken: string }[] = [];
    for (let n = 0; n < 6; n++) {
      pending.push(await started());
    }
    const last = await started();
    await forgetRateEvents(ctx);
    for (const { browserToken } of pending) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await verify(browserToken, wrongCode(last.code));
      }
    }
    expect(await refusal(last.browserToken, last.code)).toBe(
      OtpError.Throttled,
    );
  });

  it("keeps no code in the database", async () => {
    const { code } = await started();
    const rows = JSON.stringify([
      await challenges().find(),
      await ctx.dataSource.getRepository(OtpRateEvent).find(),
    ]);
    expect(rows).not.toContain(code);
  });

  it("forgets expired challenges and stale rate events", async () => {
    await started();
    await challenges()
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    await ctx.dataSource
      .getRepository(OtpRateEvent)
      .createQueryBuilder()
      .update()
      .set({ createdAt: () => `"createdAt" - interval '25 hours'` })
      .execute();

    await otp.forgetExpired();

    expect(await challenges().count()).toBe(0);
    expect(await ctx.dataSource.getRepository(OtpRateEvent).count()).toBe(0);
  });
});
