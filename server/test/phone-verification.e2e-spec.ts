import { OtpError } from "@alliance/common/otp";
import { EventLog, EventType } from "src/eventlog/event-log.entity";
import { MmsUnsubService } from "src/mms/mms-unsub.service";
import { OptOutSource } from "src/mms/opt-out-source";
import { welcomeMessage } from "src/notifs/textnotifcontents";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { EntityManager, type Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  signAccessToken,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";
import { stubSavedSend } from "./opt-in-fixtures";
import {
  captureSentCodes,
  forgetRateEvents,
  type SentCodes,
  uniquePhone,
  wrongCode,
} from "./otp-fixtures";

describe("Phone verification (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let codes: SentCodes;
  let members = 0;

  const createMember = (fields: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        email: `phone-${++members}@example.com`,
        password: "pass",
        name: `Phone Member ${members}`,
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

  const verify = async (member: User, phoneNumber: string) => {
    const sent = await sendCode(member, phoneNumber).expect(200);
    return post(member, "/user/phone/code/verify", {
      challengeToken: sent.body.challengeToken,
      code: codes.lastCode(),
    });
  };

  const me = async (member: User) =>
    (
      await request(ctx.app.getHttpServer())
        .get("/auth/me")
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        )
        .expect(200)
    ).body.user;

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

  it("saves the number only once its code is entered", async () => {
    const member = await createMember();
    const phoneNumber = uniquePhone();
    const sent = await sendCode(member, phoneNumber).expect(200);
    expect(sent.body.maskedDestination).toBe(`•••${phoneNumber.slice(-4)}`);
    expect((await reload(member)).phoneNumber).toBeNull();

    const wrong = await post(member, "/user/phone/code/verify", {
      challengeToken: sent.body.challengeToken,
      code: wrongCode(codes.lastCode()),
    }).expect(400);
    expect(wrong.body.error).toBe(OtpError.WrongCode);
    expect((await reload(member)).phoneNumber).toBeNull();

    await post(member, "/user/phone/code/verify", {
      challengeToken: sent.body.challengeToken,
      code: codes.lastCode(),
    }).expect(204);
    expect(await me(member)).toEqual(
      expect.objectContaining({ phoneNumber, phoneNumberVerified: true }),
    );
    expect((await reload(member)).phoneNumberVerifiedAt).toBeInstanceOf(Date);
  });

  it("texts the opt-in confirmation once the number is verified", async () => {
    const sendMms = stubSavedSend(ctx);
    try {
      const member = await createMember();
      const phoneNumber = uniquePhone();

      expect((await verify(member, phoneNumber)).status).toBe(204);

      expect(sendMms).toHaveBeenCalledTimes(1);
      expect(sendMms).toHaveBeenCalledWith(
        expect.objectContaining({
          to: phoneNumber,
          userId: member.id,
          body: welcomeMessage,
        }),
      );
    } finally {
      sendMms.mockRestore();
    }
  });

  it("keeps the old number until the new one is verified", async () => {
    const oldNumber = uniquePhone();
    const member = await createMember({ phoneNumber: oldNumber });
    await sendCode(member, uniquePhone()).expect(200);
    expect((await reload(member)).phoneNumber).toBe(oldNumber);
  });

  it("moves a number from the account holding it and tells staff", async () => {
    const phoneNumber = uniquePhone();
    const holder = await createMember({
      phoneNumber,
      phoneNumberVerifiedAt: new Date(),
      phoneNumberUnsubscribed: true,
    });
    const claimant = await createMember();

    expect((await verify(claimant, phoneNumber)).status).toBe(204);

    expect(await reload(holder)).toEqual(
      expect.objectContaining({
        phoneNumber: null,
        phoneNumberVerifiedAt: null,
        phoneNumberUnsubscribed: false,
      }),
    );
    expect(await reload(claimant)).toEqual(
      expect.objectContaining({ phoneNumber, phoneNumberUnsubscribed: true }),
    );
    const event = await ctx.dataSource.getRepository(EventLog).findOneByOrFail({
      event: EventType.PhoneNumberMoved,
      userId: holder.id,
    });
    expect(event.blob).toEqual({ phoneNumber, verifiedByUserId: claimant.id });
  });

  it("lets two members verify each other's numbers at once", async () => {
    const [first, second] = [uniquePhone(), uniquePhone()];
    const a = await createMember({ phoneNumber: first });
    const b = await createMember({ phoneNumber: second });
    const challenge = async (member: User, phoneNumber: string) => {
      const sent = await sendCode(member, phoneNumber).expect(200);
      return {
        challengeToken: sent.body.challengeToken,
        code: codes.lastCode(),
      };
    };
    const aClaim = await challenge(a, second);
    const bClaim = await challenge(b, first);
    // Holding a's row makes both verifies queue on their first row lock, so
    // one locking in a different order would deadlock against the other.
    const runner = ctx.dataSource.createQueryRunner();
    await runner.startTransaction();
    let statuses: request.Response[];
    try {
      await runner.manager
        .createQueryBuilder(User, "row")
        .where("row.id = :id", { id: a.id })
        .setLock("pessimistic_write")
        .getOne();
      const verifies = Promise.all([
        post(a, "/user/phone/code/verify", aClaim),
        post(b, "/user/phone/code/verify", bClaim),
      ]);
      await waitForLockWait(ctx.dataSource, 2);
      await runner.commitTransaction();
      statuses = await verifies;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }

    expect(statuses.map((res) => res.status)).toEqual([204, 204]);
    expect((await reload(a)).phoneNumber).toBe(second);
    expect((await reload(b)).phoneNumber).toBe(first);
  });

  it("keeps a STOP that arrives while the number moves", async () => {
    const phoneNumber = uniquePhone();
    await createMember({ phoneNumber });
    const claimant = await createMember();
    const sent = await sendCode(claimant, phoneNumber).expect(200);
    let stop: Promise<void> | undefined;
    const find = EntityManager.prototype.find;
    const holderLookup = jest
      .spyOn(EntityManager.prototype, "find")
      .mockImplementation(async function (this: EntityManager, ...args) {
        const found = await find.apply(this, args);
        if (args[0] === User && !stop) {
          stop = ctx.app.get(MmsUnsubService).unsubFromMms(phoneNumber, {
            kind: OptOutSource.Keyword,
            rawBody: "STOP",
          });
          await waitForLockWait(ctx.dataSource);
        }
        return found;
      });

    await post(claimant, "/user/phone/code/verify", {
      challengeToken: sent.body.challengeToken,
      code: codes.lastCode(),
    }).expect(204);
    holderLookup.mockRestore();
    await stop;

    expect(await reload(claimant)).toEqual(
      expect.objectContaining({ phoneNumber, phoneNumberUnsubscribed: true }),
    );
  });

  it("lets a member verify the unverified number they already have", async () => {
    const phoneNumber = uniquePhone();
    const member = await createMember({ phoneNumber });
    expect((await verify(member, phoneNumber)).status).toBe(204);
    expect(await me(member)).toEqual(
      expect.objectContaining({ phoneNumber, phoneNumberVerified: true }),
    );
  });

  it("gives a number a deleted account had to a new member", async () => {
    const phoneNumber = uniquePhone();
    const gone = await createMember({ phoneNumber });
    await userRepo.softDelete({ id: gone.id });
    const member = await createMember();
    expect((await verify(member, phoneNumber)).status).toBe(204);
    const deleted = await userRepo.findOneOrFail({
      where: { id: gone.id },
      withDeleted: true,
    });
    expect(deleted.phoneNumber).toBe(phoneNumber);
  });

  it("carries a STOP a deleted account recorded on the number", async () => {
    const phoneNumber = uniquePhone();
    const gone = await createMember({
      phoneNumber,
      phoneNumberUnsubscribed: true,
    });
    await userRepo.softDelete({ id: gone.id });
    const member = await createMember();
    expect((await verify(member, phoneNumber)).status).toBe(204);
    expect((await reload(member)).phoneNumberUnsubscribed).toBe(true);
  });

  it("drops the STOP of the number the member leaves", async () => {
    const member = await createMember({
      phoneNumber: uniquePhone(),
      phoneNumberUnsubscribed: true,
    });
    expect((await verify(member, uniquePhone())).status).toBe(204);
    expect((await reload(member)).phoneNumberUnsubscribed).toBe(false);
  });

  describe("a profile update without a code", () => {
    const update = (member: User, body: object) =>
      post(member, "/user/update", body);

    it("saves a free number as unverified", async () => {
      const member = await createMember({
        phoneNumber: uniquePhone(),
        phoneNumberVerifiedAt: new Date(),
      });
      const phoneNumber = uniquePhone();
      await update(member, { phoneNumber }).expect(201);
      expect(await me(member)).toEqual(
        expect.objectContaining({ phoneNumber, phoneNumberVerified: false }),
      );
    });

    it("keeps a number verified when the update repeats it", async () => {
      const phoneNumber = uniquePhone();
      const member = await createMember({
        phoneNumber,
        phoneNumberVerifiedAt: new Date(),
      });
      await update(member, { phoneNumber, name: "Renamed" }).expect(201);
      expect(await me(member)).toEqual(
        expect.objectContaining({ phoneNumber, phoneNumberVerified: true }),
      );
    });
  });
});
