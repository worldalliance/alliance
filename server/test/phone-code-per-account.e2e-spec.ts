import { OtpError } from "@alliance/common/otp";
import { OtpChannel, OtpPurpose } from "src/otp/otp-copy";
import { OtpService } from "src/otp/otp.service";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  signAccessToken,
  type TestContext,
} from "./e2e-test-utils";
import {
  captureSentCodes,
  forgetRateEvents,
  type SentCodes,
  skipResendWait,
  uniquePhone,
} from "./otp-fixtures";

describe("Phone verification codes per account (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let codes: SentCodes;
  let members = 0;

  const createMember = (fields: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        email: `phone-code-${++members}@example.com`,
        password: "pass",
        name: `Phone Code Member ${members}`,
        ...fields,
      }),
    );

  const post = (member: User, path: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .send(body);

  const sendCode = (member: User, phoneNumber: string) =>
    post(member, "/user/phone/code", { phoneNumber });

  const enterCode = (member: User, challengeToken: string, code: string) =>
    post(member, "/user/phone/code/verify", { challengeToken, code });

  const reload = (member: User) => userRepo.findOneByOrFail({ id: member.id });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    codes = captureSentCodes(ctx);
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("leaves another member's pending code usable and undelayed", async () => {
    const phoneNumber = uniquePhone();
    const owner = await createMember();
    const sent = await sendCode(owner, phoneNumber).expect(200);
    const ownerCode = codes.lastCode();

    await sendCode(await createMember(), phoneNumber).expect(200);

    await enterCode(owner, sent.body.challengeToken, ownerCode).expect(204);
    expect((await reload(owner)).phoneNumber).toBe(phoneNumber);
  });

  it("waits a minute between one member's codes for a number", async () => {
    const member = await createMember();
    const phoneNumber = uniquePhone();
    await sendCode(member, phoneNumber).expect(200);
    const again = await sendCode(member, phoneNumber).expect(429);
    expect(again.body.error).toBe(OtpError.Throttled);
  });

  it("accepts a code only from the account that asked for it", async () => {
    const phoneNumber = uniquePhone();
    const sent = await sendCode(await createMember(), phoneNumber).expect(200);
    const other = await createMember();

    const refused = await enterCode(
      other,
      sent.body.challengeToken,
      codes.lastCode(),
    ).expect(400);
    expect(refused.body.error).toBe(OtpError.CodeInvalid);
    expect((await reload(other)).phoneNumber).toBeNull();
  });

  it("sends one account five codes an hour across numbers", async () => {
    const member = await createMember();
    for (let i = 0; i < 5; i++) {
      await sendCode(member, uniquePhone()).expect(200);
    }
    const sixth = await sendCode(member, uniquePhone()).expect(429);
    expect(sixth.body.error).toBe(OtpError.Throttled);
  });

  it("sends a number five codes an hour, except to the account holding it", async () => {
    const phoneNumber = uniquePhone();
    const holder = await createMember({ phoneNumber });
    for (let i = 0; i < 5; i++) {
      await sendCode(await createMember(), phoneNumber).expect(200);
    }
    await sendCode(await createMember(), phoneNumber).expect(429);

    const sent = await sendCode(holder, phoneNumber).expect(200);
    await enterCode(holder, sent.body.challengeToken, codes.lastCode()).expect(
      204,
    );
    expect((await reload(holder)).phoneNumberVerifiedAt).toBeInstanceOf(Date);
  });

  it("keeps accounts sharing a number under its limit", async () => {
    const phoneNumber = uniquePhone();
    const holders = await Promise.all(
      Array.from({ length: 6 }, () => createMember({ phoneNumber })),
    );
    for (const holder of holders.slice(0, 5)) {
      await sendCode(holder, phoneNumber).expect(200);
    }
    await sendCode(holders[5], phoneNumber).expect(429);
  });

  it("counts KORA sign-in codes apart from phone verification", async () => {
    const phoneNumber = uniquePhone();
    const otp = ctx.app.get(OtpService);
    for (let i = 0; i < 5; i++) {
      await skipResendWait(ctx);
      const started = await otp.start({
        purpose: OtpPurpose.KoraSignIn,
        contact: { channel: OtpChannel.Sms, destination: phoneNumber },
        requester: null,
        ip: `203.0.113.${i}`,
        webOtpHost: null,
      });
      expect(started.ok).toBe(true);
    }
    await sendCode(await createMember(), phoneNumber).expect(200);
  });
});
