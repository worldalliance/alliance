import { EventLog, EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin account deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let eventLogRepo: Repository<EventLog>;

  const createTarget = async (email: string): Promise<User> =>
    userRepo.save(
      userRepo.create({ name: "Doomed Member", email, password: "pass" }),
    );

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    eventLogRepo = ctx.dataSource.getRepository(EventLog);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("deletes the account and everything keyed to it", async () => {
    const target = await createTarget("delete-me@example.com");
    const owned = await eventLogRepo.save(
      eventLogRepo.create({
        event: EventType.AccountCreated,
        message: "their own history",
        blob: null,
        userId: target.id,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        reason: "Member emailed asking for deletion",
        confirmationEmail: "delete-me@example.com",
      });

    expect(res.status).toBe(200);
    expect(await userRepo.findOne({ where: { id: target.id } })).toBeNull();
    expect(await eventLogRepo.findOne({ where: { id: owned.id } })).toBeNull();
  });

  // EventLog.user cascades, so an entry attributed to the deleted member would
  // take the record of its own deletion with it.
  it("keeps the audit entry, detached from the deleted member", async () => {
    const target = await createTarget("audited@example.com");

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "Duplicate account", confirmationEmail: target.email })
      .expect(200);

    const entry = await eventLogRepo.findOneOrFail({
      where: { event: EventType.AccountDeleted },
      order: { createdAt: "DESC" },
    });

    expect(entry.userId).toBeNull();
    expect(entry.message).toContain("audited@example.com");
    expect(entry.message).toContain("Duplicate account");
    expect(entry.blob).toMatchObject({
      deletedUserId: target.id,
      adminId: ctx.adminUserId,
      reason: "Duplicate account",
    });
  });

  // Once the row is gone the audit entry is the only evidence the account
  // existed, so it shares the deletion's transaction rather than following it.
  it("keeps the account when the audit entry cannot be written", async () => {
    const target = await createTarget("audit-fails@example.com");

    const record = jest
      .spyOn(ctx.app.get(EventLogService), "sendMessageInTransaction")
      .mockRejectedValue(new Error("event log write failed"));
    try {
      await request(ctx.app.getHttpServer())
        .delete(`/user/userdetail/${target.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ reason: "audit down", confirmationEmail: target.email })
        .expect(500);
    } finally {
      record.mockRestore();
    }

    expect(await userRepo.findOne({ where: { id: target.id } })).not.toBeNull();
  });

  it("rejects a confirmation that is not the target’s email", async () => {
    const target = await createTarget("mismatch@example.com");

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "oops", confirmationEmail: "someone-else@example.com" })
      .expect(400);

    expect(await userRepo.findOne({ where: { id: target.id } })).not.toBeNull();
  });

  it("accepts a confirmation differing only in case and padding", async () => {
    const target = await createTarget("CaseTest@example.com");

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        reason: "requested",
        confirmationEmail: "  casetest@EXAMPLE.com ",
      })
      .expect(200);

    expect(await userRepo.findOne({ where: { id: target.id } })).toBeNull();
  });

  it("requires a reason", async () => {
    const target = await createTarget("no-reason@example.com");

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "   ", confirmationEmail: target.email })
      .expect(400);

    expect(await userRepo.findOne({ where: { id: target.id } })).not.toBeNull();
  });

  it("refuses to delete the acting admin", async () => {
    const admin = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${admin.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "oops", confirmationEmail: admin.email })
      .expect(400);

    expect(await userRepo.findOne({ where: { id: admin.id } })).not.toBeNull();
  });

  it("rejects a non-admin caller", async () => {
    const target = await createTarget("guarded@example.com");

    await request(ctx.app.getHttpServer())
      .delete(`/user/userdetail/${target.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ reason: "nope", confirmationEmail: target.email })
      .expect(401);

    expect(await userRepo.findOne({ where: { id: target.id } })).not.toBeNull();
  });
});
