import { addDays, subDays } from "date-fns";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

describe("POST /user/nmembers (e2e)", () => {
  let ctx: TestContext;
  let users: Repository<User>;
  let events: Repository<ContractEvent>;
  let suffix = 0;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    users = ctx.dataSource.getRepository(User);
    events = ctx.dataSource.getRepository(ContractEvent);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const count = async (): Promise<number> => {
    const response = await request(ctx.app.getHttpServer())
      .post("/user/nmembers")
      .expect(201);
    return response.body.count;
  };

  const newUser = () => {
    suffix += 1;
    return users.save(
      users.create({
        name: "Counted Member",
        email: `nmembers.${Date.now()}.${suffix}@example.com`,
        password: "Password123!",
      }),
    );
  };

  const addEvent = (params: {
    userId: number;
    type: ContractEventType;
    date: Date;
  }) =>
    events.save({
      user: { id: params.userId },
      type: params.type,
      date: params.date,
      contract: { id: ctx.defaultContractId },
    });

  it("counts a signed member and no one without a signature", async () => {
    const before = await count();
    const signed = await newUser();
    await newUser();

    await giveActiveContract(ctx, signed.id);

    expect(await count()).toBe(before + 1);
  });

  it("drops a member who suspended at the same instant as signing", async () => {
    const before = await count();
    const member = await newUser();
    const date = new Date();

    await addEvent({
      userId: member.id,
      type: ContractEventType.SIGNED,
      date,
    });
    await addEvent({
      userId: member.id,
      type: ContractEventType.SUSPENDED,
      date,
    });

    expect(await count()).toBe(before);
  });

  it("follows a member's latest event by date, not by save order", async () => {
    const before = await count();
    const member = await newUser();
    const now = new Date();

    await addEvent({
      userId: member.id,
      type: ContractEventType.SUSPENDED,
      date: subDays(now, 2),
    });
    await addEvent({
      userId: member.id,
      type: ContractEventType.SIGNED,
      date: subDays(now, 3),
    });
    expect(await count()).toBe(before);

    await addEvent({
      userId: member.id,
      type: ContractEventType.SIGNED,
      date: subDays(now, 1),
    });
    expect(await count()).toBe(before + 1);
  });

  it("ignores a signature dated in the future", async () => {
    const before = await count();
    const member = await newUser();

    await addEvent({
      userId: member.id,
      type: ContractEventType.SIGNED,
      date: addDays(new Date(), 1),
    });

    expect(await count()).toBe(before);
  });

  it("drops a soft-deleted member and a soft-deleted signature", async () => {
    const before = await count();
    const deletedMember = await newUser();
    const memberWithDeletedEvent = await newUser();
    await giveActiveContract(ctx, deletedMember.id);
    const event = await addEvent({
      userId: memberWithDeletedEvent.id,
      type: ContractEventType.SIGNED,
      date: new Date(),
    });
    expect(await count()).toBe(before + 2);

    await users.softDelete(deletedMember.id);
    await events.softDelete(event.id);

    expect(await count()).toBe(before);
  });
});
