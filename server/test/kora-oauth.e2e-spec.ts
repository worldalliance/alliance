import { AnalyticsEvent } from "@alliance/common/analytics";
import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import { OAuthError, OAuthIntent, OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { AppleOAuthClient } from "src/auth/oauth/apple-oauth.client";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { KoraParticipantOAuthIdentity } from "src/kora/entities/kora-participant-oauth-identity.entity";
import { KoraParticipant } from "src/kora/entities/kora-participant.entity";
import { KoraParticipantService } from "src/kora/kora-participant.service";
import { PosthogService } from "src/posthog/posthog.service";
import { User } from "src/user/entities/user.entity";
import type TestAgent from "supertest/lib/agent";
import { ORIGIN, koraHarness, type KoraHarness } from "./kora-fixtures";
import { forgetRateEvents, uniqueEmail } from "./otp-fixtures";

const RETURN_TO = `${ORIGIN}${KORA_PROJECT_PATH}`;

let subjects = 0;
const uniqueSubject = (): string => `subject-${++subjects}-${Math.random()}`;

describe("Kora OAuth sign-in (e2e)", () => {
  let h: KoraHarness;
  let profile: OAuthProfile;

  const participants = () => h.ctx.dataSource.getRepository(KoraParticipant);
  const identities = () =>
    h.ctx.dataSource.getRepository(KoraParticipantOAuthIdentity);

  const path = (suffix: string, provider = profile.provider) =>
    `/kora/${provider}/${suffix}`;

  const stateOf = (consentUrl: string): string =>
    String(new URL(consentUrl).searchParams.get("state"));

  const start = (browser: TestAgent, provider = profile.provider) =>
    browser
      .get(path("start", provider))
      .query({ returnTo: RETURN_TO, timeZone: "Europe/Oslo" })
      .expect(302);

  const callback = (
    browser: TestAgent,
    query: Record<string, string>,
    provider = profile.provider,
  ) => browser.get(path("callback", provider)).query(query).expect(302);

  /** One agent throughout: the cookie from the start call binds the flow. */
  const signIn = async (browser = h.browser()) => {
    const started = await start(browser);
    const finished = await callback(browser, {
      code: "code",
      state: stateOf(started.headers.location),
    });
    return { browser, location: finished.headers.location };
  };

  const errorOf = (location: string): string | null =>
    new URL(location).searchParams.get(`${profile.provider}Error`);

  const googleProfile = (overrides: Partial<OAuthProfile> = {}) => ({
    provider: OAuthProvider.Google,
    subject: uniqueSubject(),
    email: uniqueEmail(),
    emailVerified: true,
    name: "Google Person",
    ...overrides,
  });

  beforeAll(async () => {
    h = await koraHarness();
    for (const oauth of [
      h.ctx.app.get(GoogleOAuthClient),
      h.ctx.app.get(AppleOAuthClient),
    ]) {
      oauth.authorizationUrl = ({ state }) =>
        `https://consent.example.com/?state=${state}`;
      oauth.exchangeCode = () => Promise.resolve(R.success(profile));
    }
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    profile = googleProfile();
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("signs up with the provider's name and email, returning to the project page", async () => {
    const capture = jest.spyOn(h.ctx.app.get(PosthogService), "capture");
    const users = await h.ctx.dataSource.getRepository(User).count();

    const { browser, location } = await signIn();

    expect(location).toBe(RETURN_TO);
    const { participant } = await h.state(browser);
    expect(participant).toEqual({
      id: expect.any(String),
      name: "Google Person",
    });
    expect(
      await participants().findOneByOrFail({ id: participant!.id }),
    ).toEqual(
      expect.objectContaining({
        email: profile.email,
        phoneNumber: null,
        timeZone: "Europe/Oslo",
      }),
    );
    expect(
      await identities().findBy({ participantId: participant!.id }),
    ).toEqual([
      expect.objectContaining({
        provider: OAuthProvider.Google,
        subject: profile.subject,
        email: profile.email,
      }),
    ]);
    expect(capture).toHaveBeenCalledWith({
      event: AnalyticsEvent.KoraParticipantSignedUp,
      distinctId: `kora_participant:${participant!.id}`,
      properties: { method: OAuthProvider.Google },
    });
    expect(await h.ctx.dataSource.getRepository(User).count()).toBe(users);
    capture.mockRestore();
  });

  it("asks for a name the provider did not supply, then connects the account", async () => {
    profile = { ...googleProfile(), provider: OAuthProvider.Apple, name: "  " };
    const capture = jest.spyOn(h.ctx.app.get(PosthogService), "capture");

    const { browser, location } = await signIn();

    expect(location).toBe(RETURN_TO);
    expect(await h.state(browser)).toEqual({
      participant: null,
      pendingCode: null,
      signupPending: true,
    });
    expect(await participants().countBy({ email: profile.email })).toBe(0);

    const signedUp = (
      await h.signup(browser, { name: "Apple Person" }).expect(200)
    ).body;
    expect(
      await identities().findOneByOrFail({ subject: profile.subject }),
    ).toEqual(
      expect.objectContaining({
        participantId: signedUp.id,
        provider: OAuthProvider.Apple,
      }),
    );

    const again = await signIn();
    expect((await h.state(again.browser)).participant).toEqual(signedUp);
    expect(capture.mock.calls.map(([call]) => call)).toEqual([
      {
        event: AnalyticsEvent.KoraParticipantSignedUp,
        distinctId: `kora_participant:${signedUp.id}`,
        properties: { method: OAuthProvider.Apple },
      },
      {
        event: AnalyticsEvent.KoraParticipantSignedIn,
        distinctId: `kora_participant:${signedUp.id}`,
        properties: { method: OAuthProvider.Apple },
      },
    ]);
    capture.mockRestore();
  });

  it("cuts a provider's name to the longest a participant may have", async () => {
    profile = googleProfile({ name: `  ${"a".repeat(250)}  ` });
    const { browser, location } = await signIn();
    expect(location).toBe(RETURN_TO);
    expect((await h.state(browser)).participant?.name).toBe("a".repeat(200));
  });

  it("opens the email-code participant with the same verified email, and the reverse", async () => {
    const email = uniqueEmail();
    const byCode = await h.signedUp(h.browser(), { email }, "Code First");
    profile = googleProfile({ email: email.toUpperCase(), name: "Other Name" });

    const { browser } = await signIn();
    expect((await h.state(browser)).participant).toEqual(byCode);
    expect(await identities().countBy({ participantId: byCode.id })).toBe(1);

    profile = googleProfile({ name: "Provider First" });
    const viaProvider = await h.state((await signIn()).browser);
    const later = h.browser();
    await h.sendCode(later, { email: profile.email }).expect(200);
    const verified = await h.verify(later, { code: h.lastCode() }).expect(200);
    expect(verified.body).toEqual({ participant: viaProvider.participant });
  });

  it("keeps a provider account on its participant after the provider's email changes", async () => {
    const { browser } = await signIn();
    const first = (await h.state(browser)).participant!;
    const originalEmail = profile.email;
    const elsewhere = await h.signedUp(h.browser(), { email: uniqueEmail() });

    profile = {
      ...profile,
      email: (await participants().findOneByOrFail({ id: elsewhere.id }))
        .email!,
    };
    const again = await signIn();

    expect((await h.state(again.browser)).participant).toEqual(first);
    expect(await participants().findOneByOrFail({ id: first.id })).toEqual(
      expect.objectContaining({ email: originalEmail }),
    );
    expect(
      await identities().findOneByOrFail({ subject: profile.subject }),
    ).toEqual(
      expect.objectContaining({
        participantId: first.id,
        email: profile.email,
      }),
    );
  });

  it("keeps a different email, such as an Apple relay address, a separate participant", async () => {
    const first = (await h.state((await signIn()).browser)).participant!;
    profile = {
      ...googleProfile(),
      provider: OAuthProvider.Apple,
      email: `relay-${uniqueSubject()}@privaterelay.appleid.com`,
    };
    const second = (await h.state((await signIn()).browser)).participant!;
    expect(second.id).not.toBe(first.id);
  });

  it("signs a second account from the same provider into the email's participant without connecting it", async () => {
    const first = (await h.state((await signIn()).browser)).participant!;
    profile = { ...profile, subject: uniqueSubject() };

    const { browser } = await signIn();

    expect((await h.state(browser)).participant).toEqual(first);
    expect(await identities().countBy({ participantId: first.id })).toBe(1);
    expect(await identities().countBy({ subject: profile.subject })).toBe(0);
  });

  it("creates one participant when the same new account returns twice at once", async () => {
    const browsers = [h.browser(), h.browser()];
    const states = await Promise.all(
      browsers.map(async (browser) =>
        stateOf((await start(browser)).headers.location),
      ),
    );
    await Promise.all(
      browsers.map((browser, i) =>
        callback(browser, { code: "code", state: states[i] }),
      ),
    );
    const [a, b] = await Promise.all(
      browsers.map((browser) => h.state(browser)),
    );
    expect(a.participant).toEqual(b.participant);
    expect(await participants().countBy({ email: profile.email })).toBe(1);
    expect(await identities().countBy({ subject: profile.subject })).toBe(1);
  });

  it("refuses an email the provider has not verified", async () => {
    profile = googleProfile({ emailVerified: false });
    const { location } = await signIn();
    expect(errorOf(location)).toBe(OAuthError.EmailNotVerified);
    expect(await participants().countBy({ email: profile.email })).toBe(0);
  });

  it("returns a failed code exchange or a thrown error to the form", async () => {
    const google = h.ctx.app.get(GoogleOAuthClient);
    const participantService = h.ctx.app.get(KoraParticipantService);
    const { exchangeCode } = google;
    const { verifyProvider } = participantService;
    try {
      google.exchangeCode = () => Promise.resolve(R.failure(new Error("bad")));
      const exchangeFailed = await signIn();
      expect(errorOf(exchangeFailed.location)).toBe(OAuthError.Failed);
      expect((await h.state(exchangeFailed.browser)).participant).toBeNull();

      google.exchangeCode = exchangeCode;
      participantService.verifyProvider = () =>
        Promise.reject(new Error("boom"));
      const threw = await signIn();
      expect(errorOf(threw.location)).toBe(OAuthError.Failed);
      expect((await h.state(threw.browser)).participant).toBeNull();
    } finally {
      google.exchangeCode = exchangeCode;
      participantService.verifyProvider = verifyProvider;
    }
    expect(await participants().countBy({ email: profile.email })).toBe(0);
  });

  it("returns a cancelled consent to the form", async () => {
    const browser = h.browser();
    const started = await start(browser);
    const finished = await callback(browser, {
      error: "access_denied",
      state: stateOf(started.headers.location),
    });
    expect(errorOf(finished.headers.location)).toBe(OAuthError.Cancelled);
    expect(new URL(finished.headers.location).pathname).toBe(KORA_PROJECT_PATH);
  });

  it("refuses a callback in a browser that did not start the flow", async () => {
    const started = await start(h.browser());
    const elsewhere = h.browser();
    const finished = await callback(elsewhere, {
      code: "code",
      state: stateOf(started.headers.location),
    });
    expect(errorOf(finished.headers.location)).toBe(OAuthError.Failed);
    expect((await h.state(elsewhere)).participant).toBeNull();
  });

  it("refuses a state minted for the other provider or for the member flow", async () => {
    const browser = h.browser();
    const started = await start(browser, OAuthProvider.Google);
    const crossed = await callback(
      browser,
      { code: "code", state: stateOf(started.headers.location) },
      OAuthProvider.Apple,
    );
    expect(
      new URL(crossed.headers.location).searchParams.get("appleError"),
    ).toBe(OAuthError.Failed);

    const member = await browser
      .get(`/auth/${profile.provider}/start`)
      .query({ intent: OAuthIntent.Authenticate, returnTo: RETURN_TO })
      .expect(302);
    const fed = await callback(browser, {
      code: "code",
      state: stateOf(member.headers.location),
    });
    expect(errorOf(fed.headers.location)).toBe(OAuthError.Failed);
    expect((await h.state(browser)).participant).toBeNull();
  });

  it("is refused by the member callback", async () => {
    const browser = h.browser();
    const started = await start(browser);
    const users = await h.ctx.dataSource.getRepository(User).count();

    const fed = await browser
      .get(`/auth/${profile.provider}/callback`)
      .query({ code: "code", state: stateOf(started.headers.location) })
      .expect(302);

    expect(errorOf(fed.headers.location)).toBe(OAuthError.Failed);
    expect(String(fed.headers["set-cookie"])).not.toContain("access_token=");
    expect(await h.ctx.dataSource.getRepository(User).count()).toBe(users);
  });

  it("sends an expired flow back to where it started", async () => {
    const browser = h.browser();
    const started = await start(browser);
    const now = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    const finished = await callback(browser, {
      code: "code",
      state: stateOf(started.headers.location),
    });
    clock.mockRestore();
    expect(finished.headers.location).toBe(
      `${RETURN_TO}?${profile.provider}Error=${OAuthError.Expired}`,
    );
  });

  it("refuses a return address on another site", async () => {
    await h
      .browser()
      .get(path("start"))
      .query({ returnTo: "https://evil.example.com/" })
      .expect(400);
  });

  it("bounces Apple's form post to a GET, keeping the name out of the query", async () => {
    const res = await h
      .browser()
      .post(path("callback", OAuthProvider.Apple))
      .type("form")
      .send({ code: "code", state: "state", user: '{"name":{}}' })
      .expect(303);
    expect(res.headers.location).toBe("?code=code&state=state");
  });

  it("replaces a pending code and this browser's earlier session", async () => {
    const browser = h.browser();
    const earlier = await h.signedUp(browser, { email: uniqueEmail() });
    await h.sendCode(browser, { email: uniqueEmail() }).expect(200);

    await signIn(browser);

    const state = await h.state(browser);
    expect(state.pendingCode).toBeNull();
    expect(state.participant?.id).not.toBe(earlier.id);
  });
});
