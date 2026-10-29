import { OtpError } from "@alliance/common/otp";
import { KoraParticipantSession } from "src/kora/entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "src/kora/entities/kora-participant-signup.entity";
import { KoraParticipantService } from "src/kora/kora-participant.service";
import { KoraSessionService } from "src/kora/kora-session.service";
import { ORIGIN, koraHarness, type KoraHarness } from "./kora-fixtures";
import {
  forgetRateEvents,
  uniqueEmail,
  uniquePhone,
  wrongCode,
} from "./otp-fixtures";

describe("Kora one-time codes (e2e)", () => {
  let h: KoraHarness;

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("accepts four wrong codes, then refuses the code after the fifth", async () => {
    const browser = h.browser();
    await h.sendCode(browser, { email: uniqueEmail() }).expect(200);
    const code = h.lastCode();
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await h
        .verify(browser, { code: wrongCode(code) })
        .expect(400);
      expect(res.body.error).toBe(OtpError.WrongCode);
      expect(res.body.message).toBe("That code isn’t correct. Try again.");
    }
    const fifth = await h
      .verify(browser, { code: wrongCode(code) })
      .expect(400);
    expect(fifth.body.error).toBe(OtpError.CodeInvalid);
    const right = await h.verify(browser, { code }).expect(400);
    expect(right.body).toEqual(
      expect.objectContaining({
        error: OtpError.CodeInvalid,
        message: "That code is no longer valid. Request a new code.",
      }),
    );
  });

  it("accepts the code only from the browser that asked for it", async () => {
    const asker = h.browser();
    await h.sendCode(asker, { email: uniqueEmail() }).expect(200);
    const res = await h.verify(h.browser(), { code: h.lastCode() }).expect(400);
    expect(res.body.error).toBe(OtpError.CodeInvalid);
    await h.verify(asker, { code: h.lastCode() }).expect(200);
  });

  it("refuses a second code within a minute, saying how long to wait", async () => {
    const email = uniqueEmail();
    const sent = await h.sendCode(h.browser(), { email }).expect(200);
    expect(
      new Date(sent.body.resendAvailableAt).getTime() - Date.now(),
    ).toBeGreaterThan(59 * 1000);
    expect(
      new Date(sent.body.expiresAt).getTime() - Date.now(),
    ).toBeGreaterThan(9.9 * 60 * 1000);

    const early = await h.sendCode(h.browser(), { email }).expect(429);
    expect(early.body).toEqual(
      expect.objectContaining({
        error: OtpError.Throttled,
        message: "Too many attempts. Try again in 60 seconds.",
      }),
    );
  });

  it("reports a failed send", async () => {
    h.failDelivery();
    const res = await h
      .sendCode(h.browser(), { phoneNumber: uniquePhone() })
      .expect(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: OtpError.DeliveryFailed,
        message:
          "We couldn’t send your code. Try again later or use another sign-in method.",
      }),
    );
  });

  it("sends thirty codes a minute to one connection", async () => {
    for (let n = 0; n < 30; n++) {
      await h.sendCode(h.browser(), { email: uniqueEmail() }).expect(200);
    }
    const res = await h
      .sendCode(h.browser(), { email: uniqueEmail() })
      .expect(429);
    expect(res.body.error).toBe(OtpError.Throttled);
  });

  it("restarts at contact entry when the contact is changed", async () => {
    const browser = h.browser();
    await h.sendCode(browser, { email: uniqueEmail() }).expect(200);
    await browser.delete("/kora/code").set("Origin", ORIGIN).expect(204);
    expect(await h.state(browser)).toEqual({
      participant: null,
      pendingCode: null,
      signupPending: false,
    });
    expect((await h.verify(browser, { code: h.lastCode() })).body.error).toBe(
      OtpError.CodeInvalid,
    );
  });

  it("forgets expired signups and sessions", async () => {
    await h.verified(h.browser(), { email: uniqueEmail() });
    await h.signedUp(h.browser(), { email: uniqueEmail() });
    for (const target of [KoraParticipantSignup, KoraParticipantSession]) {
      await h.ctx.dataSource
        .getRepository(target)
        .createQueryBuilder()
        .update()
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .execute();
    }

    await h.ctx.app.get(KoraParticipantService).forgetExpiredSignups();
    await h.ctx.app.get(KoraSessionService).forgetExpired();

    for (const target of [KoraParticipantSignup, KoraParticipantSession]) {
      expect(await h.ctx.dataSource.getRepository(target).count()).toBe(0);
    }
  });
});
