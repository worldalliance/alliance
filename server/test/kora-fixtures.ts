import { KORA_PROJECT_PATH } from "@alliance/common/kora";
import { R } from "@alliance/common/result";
import { GoogleOAuthClient } from "src/auth/oauth/google-oauth.client";
import type { OAuthProfile } from "src/auth/oauth/oauth-client";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { createTestApp, type TestContext } from "./e2e-test-utils";
import { captureSentCodes, skipResendWait } from "./otp-fixtures";

export const ORIGIN = "http://localhost:5473";

export type Contact = { email: string } | { phoneNumber: string };

export type KoraHarness = {
  ctx: TestContext;
  browser: () => TestAgent;
  sendCode: (browser: TestAgent, contact: Contact) => request.Test;
  verify: (
    browser: TestAgent,
    body: { code: string; timeZone?: string | null },
  ) => request.Test;
  signup: (
    browser: TestAgent,
    body: { name: string; timeZone?: string | null },
  ) => request.Test;
  state: (browser: TestAgent) => Promise<KoraStateBody>;
  lastCode: () => string;
  /** Requests and verifies a code, leaving a new contact awaiting a name. */
  verified: (browser: TestAgent, contact: Contact) => Promise<void>;
  /** A participant signed in on `browser`. */
  signedUp: (
    browser: TestAgent,
    contact: Contact,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  /** Abandons this browser's code and any signup awaiting a name. */
  backOut: (browser: TestAgent) => Promise<unknown>;
  skipResendWait: () => Promise<void>;
  failDelivery: () => void;
};

export type KoraStateBody = {
  participant: { id: string; name: string } | null;
  pendingCode: {
    channel: string;
    maskedDestination: string;
    resendAvailableAt: string;
    expiresAt: string;
  } | null;
  signupPending: boolean;
};

export async function koraHarness(): Promise<KoraHarness> {
  const ctx = await createTestApp([KoraModule]);
  const sent = captureSentCodes(ctx);

  const post = (browser: TestAgent, path: string) =>
    browser.post(path).set("Origin", ORIGIN);
  const harness: KoraHarness = {
    ctx,
    browser: () => request.agent(ctx.app.getHttpServer()),
    sendCode: (browser, contact) => post(browser, "/kora/code").send(contact),
    verify: (browser, body) => post(browser, "/kora/code/verify").send(body),
    signup: (browser, body) => post(browser, "/kora/signup").send(body),
    state: async (browser) => (await browser.get("/kora/me").expect(200)).body,
    lastCode: sent.lastCode,
    verified: async (browser, contact) => {
      await harness.sendCode(browser, contact).expect(200);
      const res = await harness
        .verify(browser, { code: harness.lastCode() })
        .expect(200);
      expect(res.body).toEqual({ participant: null });
    },
    signedUp: async (browser, contact, name = "Test Participant") => {
      await harness.verified(browser, contact);
      return (await harness.signup(browser, { name }).expect(200)).body;
    },
    backOut: (browser) =>
      browser.delete("/kora/code").set("Origin", ORIGIN).expect(204),
    skipResendWait: () => skipResendWait(ctx),
    failDelivery: sent.failDelivery,
  };
  return harness;
}

/** Google returns whatever `profileOf` gives at callback time. */
export function stubGoogle(ctx: TestContext, profileOf: () => OAuthProfile) {
  const google = ctx.app.get(GoogleOAuthClient);
  google.authorizationUrl = ({ state }) =>
    `https://consent.example.com/?state=${state}`;
  google.exchangeCode = () => Promise.resolve(R.success(profileOf()));
}

export async function signInWithGoogle(browser: TestAgent): Promise<void> {
  const started = await browser
    .get("/kora/google/start")
    .query({ returnTo: `${ORIGIN}${KORA_PROJECT_PATH}` })
    .expect(302);
  const state = new URL(started.headers.location).searchParams.get("state");
  await browser
    .get("/kora/google/callback")
    .query({ code: "code", state: String(state) })
    .expect(302);
}
