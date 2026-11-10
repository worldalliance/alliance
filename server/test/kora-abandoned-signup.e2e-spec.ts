import { OAuthProvider } from "@alliance/common/oauth";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { KoraAbandonedSignup } from "src/kora/entities/kora-abandoned-signup.entity";
import { KoraParticipantSignup } from "src/kora/entities/kora-participant-signup.entity";
import { KoraParticipant } from "src/kora/entities/kora-participant.entity";
import { KoraParticipantService } from "src/kora/kora-participant.service";
import { OtpChannel } from "src/otp/otp-copy";
import {
  koraHarness,
  signInWithGoogle,
  stubGoogle,
  type KoraHarness,
} from "./kora-fixtures";
import { forgetRateEvents, uniqueEmail, uniquePhone } from "./otp-fixtures";

describe("Kora abandoned signups (e2e)", () => {
  let h: KoraHarness;
  let profile: OAuthProfile;

  const abandonedFor = (destination: string) =>
    h.ctx.dataSource.getRepository(KoraAbandonedSignup).findBy({ destination });
  const expireSignups = async () => {
    await h.ctx.dataSource
      .getRepository(KoraParticipantSignup)
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    await h.ctx.app.get(KoraParticipantService).forgetExpiredSignups();
  };

  beforeAll(async () => {
    h = await koraHarness();
    stubGoogle(h.ctx, () => profile);
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("records a signup backed out of before the name", async () => {
    const email = uniqueEmail();
    const browser = h.browser();
    await h.verified(browser, { email });
    await h.backOut(browser);

    expect(await abandonedFor(email)).toEqual([
      {
        id: expect.any(String),
        channel: OtpChannel.Email,
        destination: email,
        provider: null,
        verifiedAt: expect.any(Date),
      },
    ]);
  });

  it("records nothing for a completed signup", async () => {
    const email = uniqueEmail();
    await h.signedUp(h.browser(), { email });
    await expireSignups();
    expect(await abandonedFor(email)).toEqual([]);
  });

  it("records an expired signup once per contact, keeping the latest verification", async () => {
    const phoneNumber = uniquePhone();
    await h.verified(h.browser(), { phoneNumber });
    await expireSignups();
    const [first] = await abandonedFor(phoneNumber);
    expect(first).toEqual(
      expect.objectContaining({ channel: OtpChannel.Sms, provider: null }),
    );

    await h.skipResendWait();
    await h.verified(h.browser(), { phoneNumber });
    await expireSignups();
    const again = await abandonedFor(phoneNumber);
    expect(again).toEqual([expect.objectContaining({ id: first.id })]);
    expect(again[0].verifiedAt.getTime()).toBeGreaterThan(
      first.verifiedAt.getTime(),
    );
  });

  it("records two signups for one contact that expire together once, keeping the later", async () => {
    const email = uniqueEmail();
    await h.verified(h.browser(), { email });
    await h.skipResendWait();
    await h.verified(h.browser(), { email });
    const signups = await h.ctx.dataSource
      .getRepository(KoraParticipantSignup)
      .findBy({ destination: email });
    const latest = Math.max(...signups.map((s) => s.createdAt.getTime()));

    await expireSignups();
    const recorded = await abandonedFor(email);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].verifiedAt.getTime()).toBe(latest);
  });

  it("does not record a signup while another for its contact is still open", async () => {
    const email = uniqueEmail();
    const browser = h.browser();
    await h.verified(browser, { email });
    profile = {
      provider: OAuthProvider.Google,
      subject: `subject-${Math.random()}`,
      email,
      emailVerified: true,
      name: null,
    };
    await signInWithGoogle(browser);
    expect((await h.state(browser)).signupPending).toBe(true);
    expect(await abandonedFor(email)).toEqual([]);

    await h.signup(browser, { name: "Finished" }).expect(200);
    expect(await abandonedFor(email)).toEqual([]);
  });

  it("records the newer attempt when an older signup for the contact has expired but not been swept", async () => {
    const email = uniqueEmail();
    await h.verified(h.browser(), { email });
    await h.ctx.dataSource
      .getRepository(KoraParticipantSignup)
      .update(
        { destination: email },
        { expiresAt: new Date(Date.now() - 1000) },
      );
    await h.skipResendWait();
    const newer = h.browser();
    await h.verified(newer, { email });
    const [{ createdAt }] = await h.ctx.dataSource
      .getRepository(KoraParticipantSignup)
      .find({ where: { destination: email }, order: { createdAt: "DESC" } });

    await h.backOut(newer);
    await h.ctx.app.get(KoraParticipantService).forgetExpiredSignups();
    const recorded = await abandonedFor(email);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].verifiedAt.getTime()).toBe(createdAt.getTime());
  });

  it.each([
    ["signed up", true],
    ["verified again", false],
  ])(
    "records a signup that expired before the contact %s, though the sweep ran later",
    async (_case, completes) => {
      const email = uniqueEmail();
      await h.verified(h.browser(), { email });
      await h.ctx.dataSource
        .getRepository(KoraParticipantSignup)
        .update(
          { destination: email },
          { expiresAt: new Date(Date.now() - 60_000) },
        );
      await h.skipResendWait();
      const later = h.browser();
      await h.verified(later, { email });
      if (completes) {
        await h.signup(later, { name: "Came Back" }).expect(200);
      }

      await h.ctx.app.get(KoraParticipantService).forgetExpiredSignups();
      expect(await abandonedFor(email)).toHaveLength(1);
    },
  );

  it("does not record an older signup a newer one outlived, when one sweep ends both", async () => {
    const email = uniqueEmail();
    await h.verified(h.browser(), { email });
    await h.skipResendWait();
    await h.verified(h.browser(), { email });
    await h.skipResendWait();
    await h.signedUp(h.browser(), { email });
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
    const signups = h.ctx.dataSource.getRepository(KoraParticipantSignup);
    const [newer, older] = await signups.find({
      where: { destination: email },
      order: { createdAt: "DESC" },
    });
    await signups.update(
      { tokenHash: older.tokenHash },
      { createdAt: minutesAgo(13), expiresAt: minutesAgo(3) },
    );
    await signups.update(
      { tokenHash: newer.tokenHash },
      { createdAt: minutesAgo(11), expiresAt: minutesAgo(1) },
    );
    await h.ctx.dataSource
      .getRepository(KoraParticipant)
      .update({ email }, { createdAt: minutesAgo(2) });

    await h.ctx.app.get(KoraParticipantService).forgetExpiredSignups();
    expect(await abandonedFor(email)).toEqual([]);
  });

  it("records the newer attempt when an older signup for the contact is still open", async () => {
    const email = uniqueEmail();
    const older = h.browser();
    await h.verified(older, { email });
    await h.skipResendWait();
    const newer = h.browser();
    await h.verified(newer, { email });
    const [{ createdAt }] = await h.ctx.dataSource
      .getRepository(KoraParticipantSignup)
      .find({ where: { destination: email }, order: { createdAt: "DESC" } });

    await h.backOut(newer);
    await h.backOut(older);
    const recorded = await abandonedFor(email);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].verifiedAt.getTime()).toBe(createdAt.getTime());
  });

  it.each([
    ["email", () => ({ email: uniqueEmail() })],
    ["phone", () => ({ phoneNumber: uniquePhone() })],
  ])(
    "does not record a signup whose %s became a participant another way",
    async (_kind, contactOf) => {
      const contact = contactOf();
      const left = h.browser();
      await h.verified(left, contact);
      await h.skipResendWait();
      await h.signedUp(h.browser(), contact);
      await h.backOut(left);
      expect(await abandonedFor(Object.values(contact)[0])).toEqual([]);
    },
  );

  it("records the provider that verified the contact", async () => {
    const email = uniqueEmail();
    profile = {
      provider: OAuthProvider.Google,
      subject: `subject-${Math.random()}`,
      email,
      emailVerified: true,
      name: null,
    };
    const browser = h.browser();
    await signInWithGoogle(browser);
    expect((await h.state(browser)).signupPending).toBe(true);
    await h.backOut(browser);

    expect(await abandonedFor(email)).toEqual([
      expect.objectContaining({
        channel: OtpChannel.Email,
        provider: OAuthProvider.Google,
      }),
    ]);
  });
});
