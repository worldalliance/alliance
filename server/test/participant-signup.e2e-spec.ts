import { ParticipantError } from "@alliance/common/participant";
import { Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { ProjectParticipantSession } from "src/participants/entities/project-participant-session.entity";
import { ProjectParticipantSignup } from "src/participants/entities/project-participant-signup.entity";
import { ProjectParticipant } from "src/participants/entities/project-participant.entity";
import { ParticipantCookie } from "src/participants/participant-cookies";
import { User } from "src/user/entities/user.entity";
import { WaitlistEntry } from "src/waitlist/entities/waitlist-entry.entity";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { forgetRateEvents, uniqueEmail, uniquePhone } from "./otp-fixtures";
import {
  ORIGIN,
  participantHarness,
  type ParticipantHarness,
} from "./participant-fixtures";

const INVALID_CONTACT = "Enter a valid email address or mobile number.";

function cookieFrom(res: request.Response, name: string): string | undefined {
  const cookies: string[] = [res.headers["set-cookie"] ?? []].flat();
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

describe("Participant signup and login (e2e)", () => {
  let h: ParticipantHarness;

  const participants = () => h.ctx.dataSource.getRepository(ProjectParticipant);
  const sessions = () =>
    h.ctx.dataSource.getRepository(ProjectParticipantSession);

  beforeAll(async () => {
    h = await participantHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
  });

  afterAll(async () => {
    await h.ctx.app.close();
  });

  it("signs up by email, asking for the name only after the code, and records nothing else", async () => {
    const browser = h.browser();
    const email = uniqueEmail();
    const users = await h.ctx.dataSource.getRepository(User).count();

    const sent = await h.sendCode(browser, { email }).expect(200);
    expect(sent.body.channel).toBe("email");
    expect(sent.body.maskedDestination).toMatch(/^p•••@example\.com$/);
    expect(h.lastCode()).toMatch(/^\d{6}$/);
    expect((await h.state(browser)).pendingCode?.maskedDestination).toBe(
      sent.body.maskedDestination,
    );

    await h.verify(browser, { code: h.lastCode() }).expect(200);
    expect(await h.state(browser)).toEqual({
      participant: null,
      pendingCode: null,
      signupPending: true,
    });

    const res = await h
      .signup(browser, { name: "  Ada Participant  ", timeZone: "Europe/Oslo" })
      .expect(200);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: "Ada Participant",
    });
    expect(await h.state(browser)).toEqual({
      participant: res.body,
      pendingCode: null,
      signupPending: false,
    });
    expect(await participants().findOneByOrFail({ id: res.body.id })).toEqual(
      expect.objectContaining({
        email,
        phoneNumber: null,
        timeZone: "Europe/Oslo",
        contactVerifiedAt: expect.any(Date),
      }),
    );
    expect(await h.ctx.dataSource.getRepository(User).count()).toBe(users);
    expect(
      await h.ctx.dataSource.getRepository(WaitlistEntry).countBy({ email }),
    ).toBe(0);
    expect(
      await h.ctx.dataSource.getRepository(Mail).countBy({ to: email }),
    ).toBe(0);
  });

  it("signs up by phone with no email or timezone, then signs in again without a name", async () => {
    const phoneNumber = uniquePhone();
    const first = await h.signedUp(
      h.browser(),
      { phoneNumber },
      "Phone Person",
    );
    expect(await participants().findOneByOrFail({ id: first.id })).toEqual(
      expect.objectContaining({ email: null, phoneNumber, timeZone: null }),
    );
    expect(
      await h.ctx.dataSource.getRepository(Mms).countBy({ to: phoneNumber }),
    ).toBe(0);

    const later = h.browser();
    await h.sendCode(later, { phoneNumber }).expect(200);
    const res = await h
      .verify(later, { code: h.lastCode(), timeZone: "Asia/Tokyo" })
      .expect(200);
    expect(res.body).toEqual({ participant: first });
    expect((await h.state(later)).participant).toEqual(first);
    expect(
      (await participants().findOneByOrFail({ id: first.id })).timeZone,
    ).toBe("Asia/Tokyo");
  });

  it("matches a returning email regardless of case and keeps the first timezone", async () => {
    const email = uniqueEmail();
    const browser = h.browser();
    await h.verified(browser, { email });
    const first = (
      await h
        .signup(browser, { name: "Case", timeZone: "Europe/Paris" })
        .expect(200)
    ).body;

    const later = h.browser();
    await h.sendCode(later, { email: `  ${email.toUpperCase()} ` }).expect(200);
    const res = await h
      .verify(later, { code: h.lastCode(), timeZone: "Asia/Tokyo" })
      .expect(200);
    expect(res.body).toEqual({ participant: first });
    expect(
      (await participants().findOneByOrFail({ id: first.id })).timeZone,
    ).toBe("Europe/Paris");
    expect(await participants().countBy({ email })).toBe(1);
  });

  it.each([
    ["both contacts", { email: "a@example.com", phoneNumber: "+14155550100" }],
    ["no contact", {}],
    ["a malformed email", { email: "not-an-email" }],
    ["a number that is not E.164", { phoneNumber: "415 555 0100" }],
  ])("refuses %s", async (_label, body) => {
    const res = await h
      .browser()
      .post("/participants/code")
      .set("Origin", ORIGIN)
      .send(body)
      .expect(400);
    expect([res.body.message].flat()).toContain(INVALID_CONTACT);
  });

  it.each([
    ["blank", "   "],
    ["missing", undefined],
    ["too long", "x".repeat(201)],
  ])("refuses a %s name and keeps the signup open", async (_label, name) => {
    const browser = h.browser();
    await h.verified(browser, { email: uniqueEmail() });
    await h.signup(browser, { name: name as string }).expect(400);
    expect((await h.state(browser)).signupPending).toBe(true);
  });

  it("refuses an expired or replayed signup", async () => {
    const expired = h.browser();
    await h.verified(expired, { email: uniqueEmail() });
    await h.ctx.dataSource
      .getRepository(ProjectParticipantSignup)
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    const res = await h.signup(expired, { name: "Late" }).expect(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Your verification has expired. Verify your contact again.",
        error: ParticipantError.SignupExpired,
      }),
    );

    const browser = h.browser();
    await h.sendCode(browser, { email: uniqueEmail() }).expect(200);
    const verified = await h
      .verify(browser, { code: h.lastCode() })
      .expect(200);
    const signupCookie = cookieFrom(verified, ParticipantCookie.Signup);
    expect(signupCookie).toBeDefined();
    await h.signup(browser, { name: "Once" }).expect(200);
    await request(h.ctx.app.getHttpServer())
      .post("/participants/signup")
      .set("Origin", ORIGIN)
      .set("Cookie", signupCookie!.split(";")[0])
      .send({ name: "Twice" })
      .expect(400);
  });

  it("drops a pending signup when the browser signs in as an existing participant", async () => {
    const email = uniqueEmail();
    await h.signedUp(h.browser(), { email }, "Returning");
    const browser = h.browser();
    await h.verified(browser, { email: uniqueEmail() });
    await h.skipResendWait();
    await h.sendCode(browser, { email }).expect(200);
    await h.verify(browser, { code: h.lastCode() }).expect(200);
    expect(await h.state(browser)).toEqual(
      expect.objectContaining({
        participant: expect.objectContaining({ name: "Returning" }),
        signupPending: false,
      }),
    );
    await h.signup(browser, { name: "Fresh" }).expect(400);
  });

  it("resolves simultaneous signups for one contact to one participant", async () => {
    const email = uniqueEmail();
    const [a, b] = [h.browser(), h.browser()];
    await h.verified(a, { email });
    await h.verified(b, { email });

    const [first, second] = await Promise.all([
      h.signup(a, { name: "Name A" }),
      h.signup(b, { name: "Name B" }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(second.body);
    const stored = await participants().findOneByOrFail({ email });
    expect(stored.name).toBe(first.body.name);
    expect(await participants().countBy({ email })).toBe(1);
  });

  it("signs a participant in again after a lost signup response, without a duplicate", async () => {
    const email = uniqueEmail();
    const created = await h.signedUp(h.browser(), { email });
    const browser = h.browser();
    await h.sendCode(browser, { email }).expect(200);
    const res = await h.verify(browser, { code: h.lastCode() }).expect(200);
    expect(res.body.participant).toEqual(created);
    expect(await participants().countBy({ email })).toBe(1);
  });

  describe("sessions", () => {
    const sessionToken = (res: request.Response): string => {
      const cookie = cookieFrom(res, ParticipantCookie.Session);
      if (!cookie) throw new Error("no session cookie");
      return cookie.split(";")[0].split("=")[1];
    };

    async function signedInBrowser(): Promise<{
      browser: TestAgent;
      token: string;
      participant: { id: string; name: string };
    }> {
      const browser = h.browser();
      await h.verified(browser, { email: uniqueEmail() });
      const res = await h
        .signup(browser, { name: "Session Person" })
        .expect(200);
      return { browser, token: sessionToken(res), participant: res.body };
    }

    it("sets an HttpOnly, Strict cookie lasting thirty days and extends it on use", async () => {
      const browser = h.browser();
      await h.verified(browser, { email: uniqueEmail() });
      const res = await h.signup(browser, { name: "Cookie" }).expect(200);
      const cookie = cookieFrom(res, ParticipantCookie.Session) ?? "";
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);

      await sessions().update(
        { participantId: res.body.id },
        { expiresAt: new Date(Date.now() + 1000) },
      );
      const renewed = await browser.get("/participants/me").expect(200);
      expect(cookieFrom(renewed, ParticipantCookie.Session)).toContain(
        `Max-Age=${30 * 24 * 60 * 60}`,
      );
      const [row] = await sessions().find({
        where: { participantId: res.body.id },
      });
      expect(row.expiresAt.getTime()).toBeGreaterThan(
        Date.now() + 29 * 24 * 60 * 60 * 1000,
      );
    });

    it("ends a session idle past its expiry", async () => {
      const { browser, participant } = await signedInBrowser();
      await sessions().update(
        { participantId: participant.id },
        { expiresAt: new Date(Date.now() - 1000) },
      );
      const res = await browser.get("/participants/me").expect(200);
      expect(res.body.participant).toBeNull();
      expect(cookieFrom(res, ParticipantCookie.Session)).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });

    it("signs out only the current browser, and the old token stays dead", async () => {
      const email = uniqueEmail();
      const phone = h.browser();
      await h.verified(phone, { email });
      const created = await h
        .signup(phone, { name: "Two Devices" })
        .expect(200);
      const phoneToken = sessionToken(created);

      const laptop = h.browser();
      await h.sendCode(laptop, { email }).expect(200);
      await h.verify(laptop, { code: h.lastCode() }).expect(200);

      await phone
        .post("/participants/sign-out")
        .set("Origin", ORIGIN)
        .expect(204);
      expect((await h.state(phone)).participant).toBeNull();
      expect((await h.state(laptop)).participant).toEqual(created.body);

      const replay = await request(h.ctx.app.getHttpServer())
        .get("/participants/me")
        .set("Cookie", `${ParticipantCookie.Session}=${phoneToken}`)
        .expect(200);
      expect(replay.body.participant).toBeNull();
    });

    it("replaces this browser's session when it signs in again", async () => {
      const { browser, participant } = await signedInBrowser();
      const contact = await participants().findOneByOrFail({
        id: participant.id,
      });
      await h.sendCode(browser, { email: contact.email! }).expect(200);
      await h.verify(browser, { code: h.lastCode() }).expect(200);
      expect(await sessions().countBy({ participantId: participant.id })).toBe(
        1,
      );
    });

    it("is refused by member, admin, and guest authentication", async () => {
      const { token } = await signedInBrowser();
      const server = h.ctx.app.getHttpServer();
      await request(server)
        .get("/user/me")
        .set("Cookie", `${ParticipantCookie.Session}=${token}`)
        .expect(401);
      await request(server)
        .get("/user/me")
        .set("Cookie", `access_token=${token}`)
        .expect(401);
      await request(server)
        .get("/user/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      await request(server)
        .get("/user/tags")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    });

    it("leaves member cookies alone on sign-out", async () => {
      const { browser } = await signedInBrowser();
      const res = await browser
        .post("/participants/sign-out")
        .set("Origin", ORIGIN)
        .set("Cookie", "access_token=member")
        .expect(204);
      const cleared: string[] = [res.headers["set-cookie"] ?? []].flat();
      expect(cleared.map((c) => c.split("=")[0])).toEqual([
        ParticipantCookie.Session,
      ]);
    });
  });

  describe("cross-site and availability", () => {
    const sessionChanging = [
      ["post", "/participants/code"],
      ["delete", "/participants/code"],
      ["post", "/participants/code/verify"],
      ["post", "/participants/signup"],
      ["post", "/participants/sign-out"],
    ] as const;
    it.each(
      sessionChanging.flatMap(([method, path]) => [
        [method, path, "no Origin", undefined],
        [method, path, "another site's Origin", "https://evil.example"],
      ]),
    )("refuses %s %s with %s", async (method, path, _label, origin) => {
      const req = h.browser()[method](path);
      await (origin ? req.set("Origin", origin) : req).expect(403);
    });

    it("answers 404 in production", async () => {
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        await h.browser().get("/participants/me").expect(404);
        await h.sendCode(h.browser(), { email: uniqueEmail() }).expect(404);
      } finally {
        process.env.NODE_ENV = nodeEnv;
      }
    });
  });
});
