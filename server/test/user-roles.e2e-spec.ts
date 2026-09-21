import { EventLog, EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin role toggles (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let eventLogRepo: Repository<EventLog>;

  const createTarget = async (email: string, admin = false): Promise<User> =>
    userRepo.save(
      userRepo.create({ name: "Member", email, password: "pass", admin }),
    );

  const patchRoles = (id: number, body: Record<string, boolean>) =>
    request(ctx.app.getHttpServer())
      .patch(`/user/userdetail/${id}/roles`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const roleChangeEntries = (targetId: number) =>
    eventLogRepo.find({
      where: { event: EventType.AdminRoleChanged, userId: targetId },
    });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    eventLogRepo = ctx.dataSource.getRepository(EventLog);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("grants admin to another member", async () => {
    const target = await createTarget("promote@example.com");

    const res = await patchRoles(target.id, { admin: true });

    expect(res.status).toBe(200);
    expect(res.body.admin).toBe(true);
    expect(
      (await userRepo.findOneOrFail({ where: { id: target.id } })).admin,
    ).toBe(true);

    const [entry, ...rest] = await roleChangeEntries(target.id);
    expect(rest).toEqual([]);
    expect(entry?.message).toBe(
      `Test Admin granted admin to Member (promote@example.com, id ${target.id})`,
    );
    expect(entry?.blob).toMatchObject({
      targetId: target.id,
      actorId: ctx.adminUserId,
      actorName: "Test Admin",
      admin: true,
    });
  });

  it("revokes admin from another member", async () => {
    const target = await createTarget("demote@example.com", true);

    const res = await patchRoles(target.id, { admin: false });

    expect(res.status).toBe(200);
    expect(res.body.admin).toBe(false);
    expect(
      (await userRepo.findOneOrFail({ where: { id: target.id } })).admin,
    ).toBe(false);

    const [entry] = await roleChangeEntries(target.id);
    expect(entry?.message).toBe(
      `Test Admin revoked admin from Member (demote@example.com, id ${target.id})`,
    );
    expect(entry?.blob).toMatchObject({ admin: false });
  });

  it("refuses to change the caller's own admin status", async () => {
    const res = await patchRoles(ctx.adminUserId, { admin: false });

    expect(res.status).toBe(400);
    expect(
      (await userRepo.findOneOrFail({ where: { id: ctx.adminUserId } })).admin,
    ).toBe(true);
  });

  it("refuses a self-change even when it would be a no-op", async () => {
    const res = await patchRoles(ctx.adminUserId, { admin: true });

    expect(res.status).toBe(400);
  });

  it("still lets the caller change their own other roles", async () => {
    const res = await patchRoles(ctx.adminUserId, { staff: true });

    expect(res.status).toBe(200);
    expect(res.body.staff).toBe(true);
    expect(await roleChangeEntries(ctx.adminUserId)).toEqual([]);
  });

  it("records nothing when the admin flag is already the requested value", async () => {
    const target = await createTarget("already-admin@example.com", true);

    const res = await patchRoles(target.id, { admin: true });

    expect(res.status).toBe(200);
    expect(await roleChangeEntries(target.id)).toEqual([]);
  });

  it("records nothing when only other roles change", async () => {
    const target = await createTarget("staff-only@example.com");

    const res = await patchRoles(target.id, { staff: true });

    expect(res.status).toBe(200);
    expect(res.body.staff).toBe(true);
    expect(await roleChangeEntries(target.id)).toEqual([]);
  });

  it("leaves the flag unchanged when the audit entry cannot be written", async () => {
    const target = await createTarget("audit-fails@example.com");
    const write = jest
      .spyOn(ctx.app.get(EventLogService), "sendMessageInTransaction")
      .mockRejectedValueOnce(new Error("event log is down"));

    const res = await patchRoles(target.id, { admin: true });

    write.mockRestore();
    expect(res.status).toBe(500);
    expect(
      (await userRepo.findOneOrFail({ where: { id: target.id } })).admin,
    ).toBe(false);
  });
});
