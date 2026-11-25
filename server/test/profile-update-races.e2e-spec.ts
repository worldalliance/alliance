import { User } from "src/user/entities/user.entity";
import { lockPhoneNumber } from "src/user/user.utils";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  signAccessToken,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";
import { uniquePhone } from "./otp-fixtures";

describe("A profile update racing other writes (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let members = 0;

  const createMember = (fields: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        email: `profile-race-${++members}@example.com`,
        password: "pass",
        name: `Profile Race ${members}`,
        ...fields,
      }),
    );

  const update = (member: User, body: object) =>
    request(ctx.app.getHttpServer())
      .post("/user/update")
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .send(body);

  const reload = (member: User) => userRepo.findOneByOrFail({ id: member.id });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("keeps a STOP recorded while a profile update waits on the row", async () => {
    const member = await createMember({ phoneNumber: uniquePhone() });
    const runner = ctx.dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.manager
        .createQueryBuilder(User, "row")
        .where("row.id = :id", { id: member.id })
        .setLock("pessimistic_write")
        .getOne();
      const updated = update(member, { name: "Renamed" }).then(
        (res) => res.status,
      );
      await waitForLockWait(ctx.dataSource);
      await runner.manager.update(User, member.id, {
        phoneNumberUnsubscribed: true,
      });
      await runner.commitTransaction();
      expect(await updated).toBe(201);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }

    expect(await reload(member)).toEqual(
      expect.objectContaining({
        name: "Renamed",
        phoneNumberUnsubscribed: true,
      }),
    );
  });

  it("waits for the lock on the number it sets", async () => {
    const member = await createMember();
    const phoneNumber = uniquePhone();
    const runner = ctx.dataSource.createQueryRunner();
    await runner.startTransaction();
    try {
      await lockPhoneNumber(runner.manager, phoneNumber);
      const updated = update(member, { phoneNumber }).then((res) => res.status);
      await waitForLockWait(ctx.dataSource);
      expect((await reload(member)).phoneNumber).toBeNull();
      await runner.commitTransaction();
      expect(await updated).toBe(201);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }

    expect((await reload(member)).phoneNumber).toBe(phoneNumber);
  });
});
