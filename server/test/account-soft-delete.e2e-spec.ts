import { NotFoundException } from "@nestjs/common";
import { Action } from "src/actions/entities/action.entity";
import { TokenMode } from "src/auth/dto/signin.dto";
import { softDeleteCascade } from "src/datasources/soft-delete";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, TestContext, waitForLockWait } from "./e2e-test-utils";

describe("Account soft deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const server = () => ctx.app.getHttpServer();

  const createMember = (overrides: Partial<User> = {}): Promise<User> =>
    userRepo.save(
      userRepo.create({
        name: "Member",
        email: `soft-delete-${emails++}@example.com`,
        password: "password",
        ...overrides,
      }),
    );

  const deleteAccount = (user: User) =>
    request(server())
      .delete(`/user/userdetail/${user.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "Requested", confirmationEmail: user.email })
      .expect(200);

  const login = (email: string) =>
    request(server())
      .post("/auth/login")
      .send({ email, password: "password", mode: TokenMode.Header });

  const me = (token: string) =>
    request(server()).get("/auth/me").set("Authorization", `Bearer ${token}`);

  const refresh = (token: string) =>
    request(server())
      .post("/auth/refresh?mode=header")
      .set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("hides the account and what it owned while keeping the rows", async () => {
    const member = await createMember({ name: "Departing Member" });
    const post = await ctx.dataSource.getRepository(Post).save({
      title: "Their post",
      authorId: member.id,
      editableContent: { body: "post body", attachments: [] },
    });
    const comment = await ctx.dataSource.getRepository(Comment).save({
      authorId: member.id,
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
      editableContent: { body: "their comment", attachments: [] },
    });

    await deleteAccount(member);

    const retained = await userRepo.findOneOrFail({
      where: { id: member.id },
      withDeleted: true,
    });
    expect(retained).toMatchObject({
      name: "Departing Member",
      email: member.email,
      deletedAt: expect.any(Date),
      sessionGeneration: 1,
    });
    expect(await userRepo.findOneBy({ id: member.id })).toBeNull();
    for (const [target, id] of [
      [Post, post.id],
      [Comment, comment.id],
    ] as const) {
      const row = await ctx.dataSource
        .getRepository(target)
        .findOneOrFail({ where: { id }, withDeleted: true });
      expect(row.deletedAt).toEqual(retained.deletedAt);
    }
    await request(server())
      .get(`/forum/posts/${post.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(404);
  });

  it("ends the account's sessions, even after the account is restored", async () => {
    const member = await createMember();
    const { access_token, refresh_token } = (
      await login(member.email).expect(200)
    ).body;
    await me(access_token).expect(200);

    await deleteAccount(member);

    await me(access_token).expect(401);
    await refresh(refresh_token).expect(401);
    await login(member.email).expect(401);

    await userRepo.update(member.id, { deletedAt: null });

    await me(access_token).expect(401);
    await refresh(refresh_token).expect(401);
    const fresh = (await login(member.email).expect(200)).body;
    await me(fresh.access_token).expect(200);
    await refresh(fresh.refresh_token).expect(200);
  });

  it("refuses to impersonate a deleted member", async () => {
    const member = await createMember();
    await deleteAccount(member);

    await request(server())
      .get(`/auth/impersonate/${member.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(400);
  });

  it("keeps an account deleted while a profile update of it waits", async () => {
    const member = await createMember();
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [member.id],
      });
      const updated = ctx.app
        .get(UserService)
        .update(member.id, { name: "Renamed" })
        .then(
          () => "updated",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await updated).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await userRepo.findOne({ where: { id: member.id }, withDeleted: true }),
    ).toMatchObject({ name: "Member", deletedAt: expect.any(Date) });
  });

  it("leaves a deleted account's columns alone", async () => {
    const member = await createMember();
    await deleteAccount(member);

    await expect(
      ctx.app.get(UserService).joinGroupAssignment(member.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await userRepo.findOne({ where: { id: member.id }, withDeleted: true }),
    ).toMatchObject({ undergoingGroupAssignment: false });
  });

  it("keeps an author deleted when an action loaded before saves", async () => {
    const author = await createMember();
    const actions = ctx.dataSource.getRepository(Action);
    const action = await actions.save({
      name: "Authored",
      category: [],
      body: "Body",
      authors: [author],
    });
    const loaded = await actions.findOneOrFail({
      where: { id: action.id },
      relations: { authors: true },
    });

    await deleteAccount(author);
    await actions.save({ ...loaded, name: "Renamed" });

    expect(
      await userRepo.findOne({ where: { id: author.id }, withDeleted: true }),
    ).toMatchObject({ deletedAt: expect.any(Date), sessionGeneration: 1 });
  });
});
