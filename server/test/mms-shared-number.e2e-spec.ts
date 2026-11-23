import { randomUUID } from "crypto";
import { EventLog, EventType } from "src/eventlog/event-log.entity";
import { MmsOptout } from "src/mms/mms-optout.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import supertest from "supertest";
import type { Repository } from "typeorm";
import { eventually } from "./e2e-test-utils";
import { TWILIO_NUMBER } from "./mms-fixtures";
import { mmsInboundApp } from "./mms-inbound-app";

const { ctx } = mmsInboundApp();

describe("Inbound MMS keywords for a shared number (e2e)", () => {
  let userRepo: Repository<User>;
  let optoutRepo: Repository<MmsOptout>;
  let eventLogRepo: Repository<EventLog>;
  let memberIds: number[];

  const SHARED = "+14155559002";

  const inbound = (from: string, body: string) =>
    supertest(ctx().app.getHttpServer())
      .post("/mms/inbound")
      .type("form")
      .send({
        From: from,
        To: TWILIO_NUMBER,
        Body: body,
        MessageSid: randomUUID(),
      });

  const unsubscribedFlags = async () =>
    Promise.all(
      memberIds.map(
        async (id) =>
          (await userRepo.findOneByOrFail({ id })).phoneNumberUnsubscribed,
      ),
    );

  beforeAll(async () => {
    userRepo = ctx().dataSource.getRepository(User);
    optoutRepo = ctx().dataSource.getRepository(MmsOptout);
    eventLogRepo = ctx().dataSource.getRepository(EventLog);

    const members = await Promise.all(
      [
        ["sharer-a@example.com", "Sharer A", "(415) 555-9002"],
        ["sharer-b@example.com", "Sharer B", "415.555.9002"],
      ].map(([email, name, phoneNumber]) =>
        userRepo.save(
          userRepo.create({
            email,
            password: "pass",
            name,
            referralSource: ReferralSource.None,
            phoneNumber,
          }),
        ),
      ),
    );
    memberIds = members.map((member) => member.id);

    expect(await userRepo.countBy({ phoneNumber: SHARED })).toBe(2);
  });

  beforeEach(async () => {
    await userRepo.update(
      { phoneNumber: SHARED },
      { phoneNumberUnsubscribed: false },
    );
    await optoutRepo.delete({ phoneNumber: SHARED });
    await eventLogRepo.delete({ event: EventType.SmsResubscribe });
  });

  const byId = (a: number, b: number) => a - b;

  it("unsubscribes every member on the number", async () => {
    const res = await inbound(SHARED, "STOP");

    expect(res.status).toBe(201);
    expect(await unsubscribedFlags()).toEqual([true, true]);
  });

  it("logs the opt-out against each member, not just one", async () => {
    await inbound(SHARED, "STOP");

    const logged = await optoutRepo.find({
      where: { phoneNumber: SHARED },
      relations: { user: true },
    });
    expect(logged.map((row) => row.user?.id).sort(byId)).toEqual(
      [...memberIds].sort(byId),
    );
  });

  it("resubscribes every member on the number", async () => {
    await inbound(SHARED, "STOP");
    expect(await unsubscribedFlags()).toEqual([true, true]);

    await inbound(SHARED, "START");

    expect(await unsubscribedFlags()).toEqual([false, false]);
  });

  it("logs the resubscribe against each member, not just one", async () => {
    await inbound(SHARED, "START");

    const logged = await eventually(
      () =>
        eventLogRepo.find({
          where: { event: EventType.SmsResubscribe },
          relations: { user: true },
        }),
      (rows) => rows.length >= memberIds.length,
    );
    const attributed = logged
      .map((row) => row.user?.id)
      .filter((id): id is number => id !== undefined)
      .sort(byId);
    expect(attributed).toEqual([...memberIds].sort(byId));
  });
});
