import { welcomeMessage } from "src/notifs/textnotifcontents";
import { User } from "src/user/entities/user.entity";
import { PhoneOptInService } from "src/user/phone-opt-in.service";
import type { Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { stubSavedSend } from "./opt-in-fixtures";

describe("Phone number opt-in confirmation (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let sendMms: jest.SpyInstance;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  const reset = () =>
    ctx.dataSource.query(
      `UPDATE "user" SET "phoneNumber" = NULL, "optInMmsId" = NULL, "phoneNumberUnsubscribed" = false, "textByDefault" = true WHERE id = $1`,
      [ctx.testUserId],
    );

  beforeEach(async () => {
    await reset();
    sendMms = stubSavedSend(ctx);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await reset();
    await closeTestApp(ctx.app);
  });

  const saveNumber = (phoneNumber: string) =>
    userRepo.update(ctx.testUserId, { phoneNumber });

  const confirm = () => ctx.app.get(PhoneOptInService).confirm(ctx.testUserId);

  it("texts the confirmation once", async () => {
    await saveNumber("+14155552671");

    await confirm();
    await confirm();

    expect(sendMms).toHaveBeenCalledTimes(1);
    expect(sendMms).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14155552671",
        userId: ctx.testUserId,
        body: welcomeMessage,
      }),
    );
    const saved = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: { optInMms: true },
    });
    expect(saved.optInMms).not.toBeNull();
  });

  it("sends nothing to a member with no number", async () => {
    await confirm();

    expect(sendMms).not.toHaveBeenCalled();
  });

  it("sends nothing to a number that unsubscribed", async () => {
    await saveNumber("+14155552671");
    await userRepo.update(ctx.testUserId, { phoneNumberUnsubscribed: true });

    await confirm();

    expect(sendMms).not.toHaveBeenCalled();
  });

  it("sends nothing to a member who turned texts off", async () => {
    await saveNumber("+14155552671");
    await userRepo.update(ctx.testUserId, { textByDefault: false });

    await confirm();

    expect(sendMms).not.toHaveBeenCalled();
  });
});
