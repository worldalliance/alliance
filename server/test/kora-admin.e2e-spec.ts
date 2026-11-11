import { OAuthProvider } from "@alliance/common/oauth";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { KoraAbandonedSignup } from "src/kora/entities/kora-abandoned-signup.entity";
import { KoraParticipantSession } from "src/kora/entities/kora-participant-session.entity";
import { KoraParticipantSignup } from "src/kora/entities/kora-participant-signup.entity";
import { KoraParticipant } from "src/kora/entities/kora-participant.entity";
import { KoraParticipantService } from "src/kora/kora-participant.service";
import request from "supertest";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraHarness,
  signInWithGoogle,
  stubGoogle,
  type KoraHarness,
} from "./kora-fixtures";
import { forgetRateEvents, uniqueEmail, uniquePhone } from "./otp-fixtures";

type AbandonedBody = {
  id: string;
  channel: string;
  destination: string;
  provider: string | null;
  verifiedAt: string;
  recovered: boolean;
};

describe("Kora admin (e2e)", () => {
  let h: KoraHarness;
  let profile: OAuthProfile;

  const asAdmin = (method: "get" | "delete", path: string) =>
    request(h.ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${h.ctx.adminAccessToken}`);
  const overview = async () =>
    (await asAdmin("get", "/kora/admin/participants").expect(200)).body;
  const abandonedFor = async (destination: string) =>
    (await overview()).abandonedSignups.filter(
      (signup: AbandonedBody) =>
        signup.destination.toLowerCase() === destination.toLowerCase(),
    );
  const abandon = async (
    contact: { email: string } | { phoneNumber: string },
  ) => {
    const browser = h.browser();
    await h.verified(browser, contact);
    await h.backOut(browser);
  };

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
    await closeTestApp(h.ctx.app);
  });

  it("lists participants with their contact, newest first", async () => {
    const email = uniqueEmail();
    const phoneNumber = uniquePhone();
    const byEmail = await h.signedUp(h.browser(), { email }, "Email Person");
    const byPhone = await h.signedUp(
      h.browser(),
      { phoneNumber },
      "Phone Person",
    );

    const { participants } = await overview();
    const ids = participants.map((p: { id: string }) => p.id);
    expect(ids.indexOf(byPhone.id)).toBeLessThan(ids.indexOf(byEmail.id));
    expect(participants).toContainEqual({
      id: byEmail.id,
      name: "Email Person",
      email,
      phoneNumber: null,
      timeZone: null,
      createdAt: expect.any(String),
      providers: [],
    });
    expect(participants).toContainEqual(
      expect.objectContaining({ id: byPhone.id, email: null, phoneNumber }),
    );
  });

  it("lists the providers connected to a participant", async () => {
    const email = uniqueEmail();
    const participant = await h.signedUp(h.browser(), { email });
    profile = {
      provider: OAuthProvider.Google,
      subject: `subject-${Math.random()}`,
      email,
      emailVerified: true,
      name: "Google Person",
    };
    await signInWithGoogle(h.browser());

    const { participants } = await overview();
    expect(participants).toContainEqual(
      expect.objectContaining({ id: participant.id, providers: ["google"] }),
    );
  });

  it("lists an abandoned signup, marked recovered once the contact signs up", async () => {
    const email = uniqueEmail();
    await abandon({ email });
    expect(await abandonedFor(email)).toEqual([
      {
        id: expect.any(String),
        channel: "email",
        destination: email,
        provider: null,
        verifiedAt: expect.any(String),
        recovered: false,
      },
    ]);

    await h.skipResendWait();
    await h.signedUp(h.browser(), { email: email.toUpperCase() });
    expect(await abandonedFor(email)).toEqual([
      expect.objectContaining({ recovered: true }),
    ]);
  });

  it("deletes a participant with its sessions and its contact's abandoned signup", async () => {
    const email = uniqueEmail();
    await abandon({ email });
    await h.skipResendWait();
    const signedIn = h.browser();
    const participant = await h.signedUp(signedIn, { email });

    await asAdmin(
      "delete",
      `/kora/admin/participants/${participant.id}`,
    ).expect(204);
    expect(
      await h.ctx.dataSource
        .getRepository(KoraParticipant)
        .countBy({ id: participant.id }),
    ).toBe(0);
    expect(
      await h.ctx.dataSource.getRepository(KoraParticipantSession).countBy({
        participantId: participant.id,
      }),
    ).toBe(0);
    expect(
      await h.ctx.dataSource
        .getRepository(KoraAbandonedSignup)
        .countBy({ destination: email }),
    ).toBe(0);
    expect((await h.state(signedIn)).participant).toBeNull();

    await asAdmin(
      "delete",
      `/kora/admin/participants/${participant.id}`,
    ).expect(404);
  });

  it("keeps a deleted participant's contact deleted when a signup it left pending ends", async () => {
    const email = uniqueEmail();
    const expiring = h.browser();
    await h.verified(expiring, { email });
    await h.skipResendWait();
    const backingOut = h.browser();
    await h.verified(backingOut, { email });
    await h.skipResendWait();
    const participant = await h.signedUp(h.browser(), { email });

    await asAdmin(
      "delete",
      `/kora/admin/participants/${participant.id}`,
    ).expect(204);
    await h.backOut(backingOut);
    await expireSignups();
    expect(await abandonedFor(email)).toEqual([]);
  });

  it("keeps a deleted abandoned signup deleted when another pending signup for its contact ends", async () => {
    const phoneNumber = uniquePhone();
    await abandon({ phoneNumber });
    await h.skipResendWait();
    await h.verified(h.browser(), { phoneNumber });
    const [abandoned] = await abandonedFor(phoneNumber);

    await asAdmin(
      "delete",
      `/kora/admin/abandoned-signups/${abandoned.id}`,
    ).expect(204);
    await expireSignups();
    expect(await abandonedFor(phoneNumber)).toEqual([]);
  });

  it("deletes an abandoned signup on its own", async () => {
    const phoneNumber = uniquePhone();
    await abandon({ phoneNumber });
    const [abandoned] = await abandonedFor(phoneNumber);

    await asAdmin(
      "delete",
      `/kora/admin/abandoned-signups/${abandoned.id}`,
    ).expect(204);
    expect(await abandonedFor(phoneNumber)).toEqual([]);
    await asAdmin(
      "delete",
      `/kora/admin/abandoned-signups/${abandoned.id}`,
    ).expect(404);
  });

  it("is refused without admin authentication", async () => {
    const server = h.ctx.app.getHttpServer();
    await request(server).get("/kora/admin/participants").expect(401);
    await request(server)
      .get("/kora/admin/participants")
      .set("Authorization", `Bearer ${h.ctx.accessToken}`)
      .expect(401);
  });
});
