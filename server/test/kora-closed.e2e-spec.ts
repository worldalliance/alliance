import {
  KORA_PROJECT_PATH,
  KORA_SIGNUPS_CLOSED,
  KoraError,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { KoraParticipant } from "src/kora/entities/kora-participant.entity";
import {
  koraHarness,
  ORIGIN,
  setKoraProjectStatus,
  stubGoogle,
  type KoraHarness,
} from "./kora-fixtures";
import { forgetRateEvents, uniqueEmail, uniquePhone } from "./otp-fixtures";

describe("Kora sign-up once the project has closed (e2e)", () => {
  let h: KoraHarness;
  let profile: OAuthProfile;

  const close = () => setKoraProjectStatus(h.ctx, KoraProjectStatus.Closed);
  const participantCount = () =>
    h.ctx.dataSource.getRepository(KoraParticipant).count();

  beforeAll(async () => {
    h = await koraHarness();
    stubGoogle(h.ctx, () => profile);
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Pending);
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("refuses a new contact's code with the closed copy", async () => {
    await close();
    const browser = h.browser();
    const before = await participantCount();
    await h.sendCode(browser, { email: uniqueEmail() }).expect(200);

    const res = await h.verify(browser, { code: h.lastCode() }).expect(400);

    expect(res.body).toMatchObject({
      error: KoraError.ProjectClosed,
      message: KORA_SIGNUPS_CLOSED,
    });
    expect(await participantCount()).toBe(before);
    expect((await h.state(browser)).pendingCode).toBeNull();
  });

  it("still signs a returning participant in", async () => {
    const phoneNumber = uniquePhone();
    const joined = await h.signedUp(h.browser(), { phoneNumber }, "Returning");
    await close();

    const browser = h.browser();
    await h.sendCode(browser, { phoneNumber }).expect(200);
    const res = await h.verify(browser, { code: h.lastCode() }).expect(200);

    expect(res.body.participant).toMatchObject({ id: joined.id });
  });

  it("refuses to finish a signup that started before the project closed", async () => {
    const browser = h.browser();
    await h.verified(browser, { email: uniqueEmail() });
    await close();

    const res = await h.signup(browser, { name: "Late" }).expect(400);

    expect(res.body.error).toBe(KoraError.ProjectClosed);
  });

  it("sends a new Google account back with the closed error", async () => {
    await close();
    profile = {
      provider: OAuthProvider.Google,
      subject: `google-${uniqueEmail()}`,
      email: uniqueEmail(),
      emailVerified: true,
      name: "New Person",
    };
    const browser = h.browser();
    const started = await browser
      .get("/kora/google/start")
      .query({ returnTo: `${ORIGIN}${KORA_PROJECT_PATH}` })
      .expect(302);
    const state = new URL(started.headers.location).searchParams.get("state");
    const back = await browser
      .get("/kora/google/callback")
      .query({ code: "code", state: String(state) })
      .expect(302);

    expect(back.headers.location).toContain(OAuthError.NoAccount);
    expect((await h.state(browser)).participant).toBeNull();
  });
});
