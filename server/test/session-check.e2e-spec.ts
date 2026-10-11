import { io } from "socket.io-client";
import { TokenMode } from "src/auth/dto/signin.dto";
import { SessionService } from "src/auth/session.service";
import { JWTTokenType, sessionTokenPayload } from "src/auth/tokens";
import { Community } from "src/community/entities/community.entity";
import { EventLogGateway } from "src/eventlog/eventlog.gateway";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MessagingGateway } from "src/messaging/messaging.gateway";
import { MessagingModule } from "src/messaging/messaging.module";
import { MessagingOverviewGateway } from "src/messaging/messaging.overview.gateway";
import { TasksModule } from "src/tasks/tasks.module";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Session checks (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let url: string;
  let emails = 0;

  const server = () => ctx.app.getHttpServer();

  const createMember = (overrides: Partial<User> = {}): Promise<User> =>
    userRepo.save(
      userRepo.create({
        name: "Member",
        email: `session-check-${emails++}@example.com`,
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

  const me = (token: string) =>
    request(server()).get("/auth/me").set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule, EventLogModule, TasksModule]);
    userRepo = ctx.dataSource.getRepository(User);
    await ctx.app.listen(0);
    url = await ctx.app.getUrl();
  }, 50000);

  afterAll(async () => {
    ctx.app.getHttpServer().closeAllConnections();
    await ctx.app.close();
  });

  it("refuses the tokens of a deleted account", async () => {
    const member = await createMember();
    const { access_token, refresh_token } = (
      await request(server())
        .post("/auth/login")
        .send({
          email: member.email,
          password: "password",
          mode: TokenMode.Header,
        })
        .expect(200)
    ).body;
    // The handler answers a missing form with 404 without loading the account.
    const guarded = () =>
      request(server())
        .get("/tasks/myResponseHistory/0")
        .set("Authorization", `Bearer ${access_token}`);
    await guarded().expect(404);

    await deleteAccount(member);

    await guarded().expect(401);
    const refreshed = await request(server())
      .post("/auth/refresh?mode=header")
      .set("Authorization", `Bearer ${refresh_token}`)
      .expect(401);
    // The handler refuses a missing account with "Invalid user id".
    expect(refreshed.body.message).toBe("Unauthorized");
  });

  it("keeps a session issued before generations existed", async () => {
    const member = await createMember();
    const { sessionGeneration: _absent, ...legacy } = sessionTokenPayload({
      tokenType: JWTTokenType.access,
      user: member,
    });
    const token = ctx.jwtService.sign(legacy, {
      secret: process.env.JWT_SECRET,
    });

    await me(token).expect(200);
  });

  it("refuses a token from an earlier generation of its account", async () => {
    const member = await createMember({ sessionGeneration: 1 });

    await me(
      signAccessToken(ctx.jwtService, { ...member, sessionGeneration: 0 }),
    ).expect(401);
    await me(signAccessToken(ctx.jwtService, member)).expect(200);
  });

  it("refreshes a session of a later generation", async () => {
    const member = await createMember({ sessionGeneration: 1 });
    const { refresh_token } = (
      await request(server())
        .post("/auth/login")
        .send({
          email: member.email,
          password: "password",
          mode: TokenMode.Header,
        })
        .expect(200)
    ).body;

    const { access_token } = (
      await request(server())
        .post("/auth/refresh?mode=header")
        .set("Authorization", `Bearer ${refresh_token}`)
        .expect(200)
    ).body;
    await me(access_token).expect(200);
  });

  it("does not let an old admin token act for a new account with its email", async () => {
    const previous = await createMember({ admin: true });
    const token = signAccessToken(ctx.jwtService, previous);
    await request(server())
      .get("/user/cityCounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await deleteAccount(previous);
    const successor = await createMember({
      email: previous.email,
      admin: true,
    });

    await request(server())
      .get("/user/cityCounts")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
    await request(server())
      .get("/user/cityCounts")
      .set(
        "Authorization",
        `Bearer ${signAccessToken(ctx.jwtService, successor)}`,
      )
      .expect(200);
  });

  it.each([
    ["/messaging", MessagingGateway],
    ["/messaging/overview", MessagingOverviewGateway],
    ["/event-log", EventLogGateway],
  ] as const)(
    "disconnects the account's open sockets on %s",
    async (namespace, gateway) => {
      const member = await createMember({ admin: true });
      const socket = io(`${url}${namespace}`, {
        auth: { token: signAccessToken(ctx.jwtService, member) },
        transports: ["websocket"],
        reconnection: false,
      });
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", () => resolve());
        socket.on("connect_error", reject);
      });
      // The event log gateway names a socket's account only after accepting it.
      while (
        !(await ctx.app.get(gateway).server.fetchSockets()).some(
          (connected) => connected.data.userId === member.id,
        )
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const disconnected = new Promise<string>((resolve) =>
        socket.on("disconnect", resolve),
      );

      await deleteAccount(member);

      expect(await disconnected).toBe("io server disconnect");
    },
  );

  it.each(["/messaging", "/messaging/overview"])(
    "refuses a deleted account's token at the %s handshake",
    async (namespace) => {
      const member = await createMember();
      const token = signAccessToken(ctx.jwtService, member);
      await deleteAccount(member);

      const socket = io(`${url}${namespace}`, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      });
      const refusal = await new Promise<Error>((resolve, reject) => {
        socket.on("connect", () => reject(new Error("connected")));
        socket.on("connect_error", resolve);
      });
      socket.close();

      expect(refusal.message).toBe("Unauthorized");
    },
  );

  it("lets a group leader through a leader route only while the account lives", async () => {
    const leader = await createMember();
    const member = await createMember();
    const community = await ctx.dataSource.getRepository(Community).save({
      name: "Led group",
      description: "Led",
      users: [leader, member],
      leaders: [leader],
    });
    const invites = (user: User) =>
      request(server())
        .get(`/user/onetimeInvites/${community.id}`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, user)}`,
        );

    await invites(leader).expect(200);
    await invites(member).expect(401);

    await deleteAccount(leader);

    await invites(leader).expect(401);
  });

  it("treats a deleted account's token on a public route as no account", async () => {
    const member = await createMember();
    const submitPublicForm = () =>
      request(server())
        .post("/tasks/submitPublicForm/0")
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        )
        .send({
          answers: {},
          formSnapshotId: 1,
          actionId: 1,
          deviceType: "desktop",
        });

    expect((await submitPublicForm().expect(400)).body.message).toBe(
      "Authenticated users must use /tasks/submitForm/:id",
    );

    await deleteAccount(member);

    await submitPublicForm().expect(404);
  });

  it("answers a public route with 500 when the session lookup fails", async () => {
    const member = await createMember();
    const lookup = jest
      .spyOn(ctx.app.get(SessionService), "assertCurrent")
      .mockRejectedValue(new Error("connection terminated"));
    try {
      await request(server())
        .post("/tasks/submitPublicForm/0")
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        )
        .send({
          answers: {},
          formSnapshotId: 1,
          actionId: 1,
          deviceType: "desktop",
        })
        .expect(500);
    } finally {
      lookup.mockRestore();
    }
  });
});
