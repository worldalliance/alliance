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
    skipResendWait: () => skipResendWait(ctx),
    failDelivery: sent.failDelivery,
  };
  return harness;
}
