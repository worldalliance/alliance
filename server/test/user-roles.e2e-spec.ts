import request from "supertest";
import type { Repository } from "typeorm";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin role toggles (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;

  const createTarget = async (email: string, admin = false): Promise<User> =>
    userRepo.save(
      userRepo.create({ name: "Member", email, password: "pass", admin }),
    );

  const patchRoles = (id: number, body: Record<string, boolean>) =>
    request(ctx.app.getHttpServer())
      .patch(`/user/userdetail/${id}/roles`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
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
  });

  it("revokes admin from another member", async () => {
    const target = await createTarget("demote@example.com", true);

    const res = await patchRoles(target.id, { admin: false });

    expect(res.status).toBe(200);
    expect(res.body.admin).toBe(false);
    expect(
      (await userRepo.findOneOrFail({ where: { id: target.id } })).admin,
    ).toBe(false);
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
  });
});
