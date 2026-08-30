import request from "supertest";
import { In, Not, type Repository } from "typeorm";
import { CommunityService } from "../src/community/community.service";
import {
  CommunityDto,
  CreateCommunityDto,
} from "../src/community/dto/community.dto";
import {
  CommunityInvite,
  CommunityInviteStatus,
} from "../src/community/entities/community-invite.entity";
import { Community } from "../src/community/entities/community.entity";
import { ConversationService } from "../src/messaging/conversation.service";
import { Conversation } from "../src/messaging/entities/conversation.entity";
import { Participant } from "../src/messaging/entities/participant.entity";
import { User } from "../src/user/entities/user.entity";
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from "./e2e-test-utils";

const defaultCreateDto: Pick<
  CreateCommunityDto,
  "public" | "allowMemberInvites" | "allowStaffAssignments" | "maxCapacity"
> = {
  public: false,
  allowMemberInvites: true,
  allowStaffAssignments: true,
  maxCapacity: 10,
};

function createDto(
  overrides: Partial<CreateCommunityDto> & { name: string },
): CreateCommunityDto {
  return { ...defaultCreateDto, ...overrides } as CreateCommunityDto;
}

describe("Community (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let communityRepo: Repository<Community>;
  let communityInviteRepo: Repository<CommunityInvite>;
  let communityService: CommunityService;
  let conversationService: ConversationService;
  let conversationRepo: Repository<Conversation>;
  let participantRepo: Repository<Participant>;
  let testUser: User;
  let testUserToken: string;
  let secondUser: User;
  let secondUserToken: string;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    communityRepo = ctx.dataSource.getRepository(Community);
    communityInviteRepo = ctx.dataSource.getRepository(CommunityInvite);
    communityService = ctx.app.get(CommunityService);
    conversationService = ctx.app.get(ConversationService);
    conversationRepo = ctx.dataSource.getRepository(Conversation);
    participantRepo = ctx.dataSource.getRepository(Participant);
  }, 50000);

  beforeEach(async () => {
    testUser = await userRepo.save(
      userRepo.create({
        name: "Community Test User",
        email: "community.test@example.com",
        password: "Password123!",
      }),
    );
    testUserToken = ctx.jwtService.sign(
      { sub: testUser.id, email: testUser.email, name: testUser.name },
      { secret: process.env.JWT_SECRET },
    );

    secondUser = await userRepo.save(
      userRepo.create({
        name: "Community Second User",
        email: "community.second@example.com",
        password: "Password123!",
      }),
    );
    secondUserToken = ctx.jwtService.sign(
      { sub: secondUser.id, email: secondUser.email, name: secondUser.name },
      { secret: process.env.JWT_SECRET },
    );
    // Both stand in for real members, who can only be in a group by way of a
    // signed contract.
    await Promise.all([
      giveActiveContract(ctx, testUser.id),
      giveActiveContract(ctx, secondUser.id),
    ]);
  });

  afterEach(async () => {
    await communityInviteRepo.createQueryBuilder("ci").delete().execute();
    await communityRepo.createQueryBuilder("community").delete().execute();
    await userRepo.delete({
      id: Not(In([ctx.testUserId, ctx.adminUserId])),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("POST /community/create creates community when authenticated", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(
        createDto({
          name: "HTTP Created Community",
          description: "Via controller",
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("HTTP Created Community");
    expect(res.body.description).toBe("Via controller");
    expect(res.body.id).toBeDefined();
  });

  it("POST /community/create rejects empty name with 400", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(createDto({ name: "", description: "Empty name" }));

    expect(res.status).toBe(400);
  });

  it("POST /community/create rejects an absent capacity with 400", async () => {
    const { maxCapacity: _maxCapacity, ...body } = createDto({
      name: "Missing Capacity",
      description: "No capacity key",
    });

    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(body);

    expect(res.status).toBe(400);
  });

  it("POST /community/create rejects a fractional, non-positive or out-of-range capacity with 400", async () => {
    for (const maxCapacity of [10.7, 0, 3_000_000_000]) {
      const res = await request(ctx.app.getHttpServer())
        .post("/community/create")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send(
          createDto({
            name: `Capacity ${maxCapacity}`,
            description: "Bad capacity",
            maxCapacity,
          }),
        );

      expect(res.status).toBe(400);
    }
  });

  it("POST /community/create rejects an over-long name or description with 400", async () => {
    for (const body of [
      { name: "x".repeat(121), description: "Long name" },
      { name: "Long description", description: "x".repeat(4001) },
    ]) {
      const res = await request(ctx.app.getHttpServer())
        .post("/community/create")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send(createDto(body));

      expect(res.status).toBe(400);
    }
  });

  it("POST /community/create rejects a null capacity the flags require with 400", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(
        createDto({
          name: "Uncapped Open Community",
          description: "Takes members it did not name",
          maxCapacity: null,
        }),
      );

    expect(res.status).toBe(400);
  });

  it("POST /community/create allows a null capacity when the group takes nobody automatically", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(
        createDto({
          name: "Uncapped Closed Community",
          description: "Invite only",
          public: false,
          allowMemberInvites: false,
          allowStaffAssignments: false,
          maxCapacity: null,
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.maxCapacity).toBeNull();
  });

  it("POST /community/create rejects a public group that blocks the flags it requires with 400", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(
        createDto({
          name: "Closed Public Community",
          description: "Public but takes nobody",
          public: true,
          allowMemberInvites: false,
          allowStaffAssignments: false,
        }),
      );

    expect(res.status).toBe(400);
  });

  it("POST /community/create returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create")
      .send(createDto({ name: "No Auth", description: "Should fail" }));

    expect(res.status).toBe(401);
  });

  it("POST /community/create/admin creates community when admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create/admin")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(
        createDto({
          name: "Admin HTTP Community",
          description: "Via admin endpoint",
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Admin HTTP Community");
    expect(res.body.id).toBeDefined();
  });

  it("POST /community/create/admin rejects a whitespace-only name with 400", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create/admin")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(createDto({ name: "   ", description: "Blank name" }));

    expect(res.status).toBe(400);
  });

  it("POST /community/create/admin trims the name", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create/admin")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(
        createDto({ name: "  Padded Admin  ", description: "Padded name" }),
      );

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Padded Admin");
  });

  it("POST /community/create/admin returns 401 when not admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .post("/community/create/admin")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(
        createDto({
          name: "Non-Admin Tries Admin",
          description: "Should fail",
        }),
      );

    expect(res.status).toBe(401);
  });

  it("GET /community/list returns communities when admin", async () => {
    // Ensure at least one community exists
    await communityService.createCommunityAdmin(
      createDto({ name: "Listed Community", description: "For list test" }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const names = res.body.map((c: CommunityDto) => c.name);
    expect(names).toContain("Listed Community");
  });

  it("GET /community/list returns communities sorted by name", async () => {
    const alphaName = "E2E List Alpha Group";
    const zuluName = "E2E List Zulu Group";
    await communityService.createCommunityAdmin(
      createDto({ name: zuluName, description: "z" }),
    );
    await communityService.createCommunityAdmin(
      createDto({ name: alphaName, description: "a" }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    const names = res.body.map((c: { name: string }) => c.name);
    const alphaIdx = names.indexOf(alphaName);
    const zuluIdx = names.indexOf(zuluName);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zuluIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(zuluIdx);
  });

  it("GET /community/list returns 401 when not admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/community/list")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(401);
  });

  it("GET /community/list returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer()).get("/community/list");

    expect(res.status).toBe(401);
  });

  it("GET /community/list/my returns communities for authenticated user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP My Community",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list/my")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((c: CommunityDto) => c.id);
    expect(ids).toContain(community.id);
  });

  it("GET /community/list/my returns leader communities before non-leader communities", async () => {
    const leaderCommunity = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP My Leader Community",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const memberCommunity = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP My Member Only Community",
        leaders: [secondUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list/my")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((c: CommunityDto) => c.id);
    const leaderIdx = ids.indexOf(leaderCommunity.id);
    const memberIdx = ids.indexOf(memberCommunity.id);
    expect(leaderIdx).toBeGreaterThanOrEqual(0);
    expect(memberIdx).toBeGreaterThanOrEqual(0);
    expect(leaderIdx).toBeLessThan(memberIdx);
  });

  it("GET /community/list/my returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      "/community/list/my",
    );

    expect(res.status).toBe(401);
  });

  it("GET /community/list/public returns only public communities when authenticated", async () => {
    const publicName = "E2E HTTP Public Group";
    const privateName = "E2E HTTP Private Group";
    await communityService.createCommunityAdmin(
      createDto({ name: publicName, description: "public", public: true }),
    );
    await communityService.createCommunityAdmin(
      createDto({ name: privateName, description: "private", public: false }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list/public")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((c: CommunityDto) => c.name);
    expect(names).toContain(publicName);
    expect(names).not.toContain(privateName);
  });

  it("GET /community/list/public returns communities sorted by name", async () => {
    const alphaName = "E2E ListPub Alpha";
    const zuluName = "E2E ListPub Zulu";
    await communityService.createCommunityAdmin(
      createDto({ name: zuluName, description: "z", public: true }),
    );
    await communityService.createCommunityAdmin(
      createDto({ name: alphaName, description: "a", public: true }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/list/public")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    const names = res.body.map((c: { name: string }) => c.name);
    const alphaIdx = names.indexOf(alphaName);
    const zuluIdx = names.indexOf(zuluName);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zuluIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(zuluIdx);
  });

  it("GET /community/list/public returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      "/community/list/public",
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/join joins public community when authenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Join Public",
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/join`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    expect(res.body.name).toBe("E2E HTTP Join Public");
  });

  it("POST /community/:communityId/join returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Join NoAuth",
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/${community.id}/join`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/join returns 400 when already a member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Join AlreadyMember",
        public: true,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: [testUser],
        users: [testUser],
      }),
    );

    // Join first time
    await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/join`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    // Try joining again
    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/join`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  it("PATCH /community/:communityId updates community when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Update",
        description: "Before update",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({
        name: "E2E HTTP Updated",
        description: "After update",
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("E2E HTTP Updated");
    expect(res.body.description).toBe("After update");
  });

  it("PATCH /community/:communityId rejects clearing a capacity the flags require with 400", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Clear Capacity",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ maxCapacity: null });

    expect(res.status).toBe(400);
  });

  it("PATCH /community/:communityId rejects going public without the flags it requires with 400", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Go Public",
        leaders: [testUser],
        users: [testUser],
        allowMemberInvites: false,
        allowStaffAssignments: false,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ public: true });

    expect(res.status).toBe(400);
  });

  it("PATCH /community/:communityId rejects clearing a flag a public group requires with 400", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Clear Flag",
        leaders: [testUser],
        users: [testUser],
        public: true,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ allowMemberInvites: false });

    expect(res.status).toBe(400);
  });

  it("PATCH /community/:communityId rejects null on a NOT NULL column with 400", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Update Null",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ public: null });

    expect(res.status).toBe(400);
  });

  it("PATCH /community/:communityId returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Update NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .send({ name: "Should Fail" });

    expect(res.status).toBe(401);
  });

  it("PATCH /community/:communityId returns 401 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Update NonLeader",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({ name: "Should Fail" });

    expect(res.status).toBe(401);
  });

  it("PATCH /community/:communityId returns 400 when name is empty", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Update EmptyName",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .patch(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("POST /community/:communityId/removeMember removes member when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Remove Member",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).not.toContain(secondUser.id);
  });

  it("POST /community/:communityId/removeMember returns 400 when not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Remove Member NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember`)
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({ userId: testUser.id });

    expect(res.status).toBe(400);
  });

  it("POST /community/:communityId/removeMember returns 400 when leader tries to remove themselves", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Remove Self",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: testUser.id });

    expect(res.status).toBe(400);
  });

  it("POST /community/:communityId/removeMember returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Remove Member NoAuth",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/removeMember/admin removes member when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove Member",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).not.toContain(secondUser.id);
  });

  it("POST /community/:communityId/removeMember/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove NotAdmin",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember/admin`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/removeMember/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove NoAuth",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeMember/admin`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/leave removes member from community when authenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Leave Community",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/leave`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(200);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).not.toContain(secondUser.id);
    expect(memberIds).toContain(testUser.id);
  });

  it("POST /community/:communityId/leave returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Leave NoAuth",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/${community.id}/leave`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/leave returns 400 when user is not a member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Leave NotMember",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/leave`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/:communityId/leave returns 400 when user is the last leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Leave LastLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/leave`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/:communityId/leave allows leader to leave when another leader exists", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Leave CoLeader",
        leaders: [testUser, secondUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/leave`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true, leaders: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).not.toContain(testUser.id);
    expect(memberIds).toContain(secondUser.id);
    const leaderIds = refreshed.leaders!.map((u: User) => u.id);
    expect(leaderIds).not.toContain(testUser.id);
  });

  it("POST /community/:communityId/join returns error for non-public community", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Join Private",
        public: false,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: 10,
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/join`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("DELETE /community/:communityId deletes community when authenticated as leader and sole member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Delete Solo",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    const found = await communityRepo.findOne({
      where: { id: community.id },
    });
    expect(found).toBeNull();
  });

  it("DELETE /community/:communityId returns 400 when community has other members", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Delete HasMembers",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("DELETE /community/:communityId returns 400 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Delete NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/${community.id}`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  it("DELETE /community/:communityId returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Delete NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).delete(
      `/community/${community.id}`,
    );

    expect(res.status).toBe(401);
  });

  it("DELETE /community/:communityId/admin deletes community when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Delete",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/${community.id}/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    const found = await communityRepo.findOne({
      where: { id: community.id },
    });
    expect(found).toBeNull();
  });

  it("DELETE /community/:communityId/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Delete NotAdmin",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/${community.id}/admin`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(401);
  });

  it("DELETE /community/:communityId/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Delete NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).delete(
      `/community/${community.id}/admin`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/addMember/admin adds member when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add Member",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addMember/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).toContain(secondUser.id);
  });

  it("POST /community/:communityId/addMember/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add NotAdmin",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addMember/admin`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/addMember/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addMember/admin`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/addLeader/admin adds leader when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add Leader",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addLeader/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true, leaders: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    const leaderIds = refreshed.leaders!.map((u: User) => u.id);
    expect(memberIds).toContain(secondUser.id);
    expect(leaderIds).toContain(secondUser.id);
  });

  it("POST /community/:communityId/addLeader/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add Leader NotAdmin",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addLeader/admin`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/addLeader/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Add Leader NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/addLeader/admin`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/removeLeader/admin removes leader when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove Leader",
        leaders: [testUser, secondUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeLeader/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(community.id);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true, leaders: true },
    });
    const leaderIds = refreshed.leaders!.map((u: User) => u.id);
    expect(leaderIds).not.toContain(secondUser.id);
    // User should still be a member
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).toContain(secondUser.id);
  });

  it("POST /community/:communityId/removeLeader/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove Leader NotAdmin",
        leaders: [testUser, secondUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeLeader/admin`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/:communityId/removeLeader/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP Admin Remove Leader NoAuth",
        leaders: [testUser, secondUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/${community.id}/removeLeader/admin`)
      .send({ userId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("GET /community/memberContactInfo/:communityId returns contact info when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetContactInfo Leader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/memberContactInfo/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    const ids = res.body.map((r: { id: number }) => r.id);
    expect(ids).toContain(testUser.id);
    expect(ids).toContain(secondUser.id);
  });

  it("GET /community/memberContactInfo/:communityId returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetContactInfo NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).get(
      `/community/memberContactInfo/${community.id}`,
    );

    expect(res.status).toBe(401);
  });

  it("GET /community/memberContactInfo/:communityId/admin returns contact info when admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetContactInfo Admin",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/memberContactInfo/${community.id}/admin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it("GET /community/memberContactInfo/:communityId/admin returns 401 when not admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetContactInfo Admin NotAdmin",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/memberContactInfo/${community.id}/admin`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(401);
  });

  it("GET /community/memberContactInfo/:communityId/admin returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetContactInfo Admin NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).get(
      `/community/memberContactInfo/${community.id}/admin`,
    );

    expect(res.status).toBe(401);
  });

  it("GET /community/memberContactInfo returns all contact info when admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/community/memberContactInfo")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /community/memberContactInfo returns 401 when not admin", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/community/memberContactInfo")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(401);
  });

  it("GET /community/memberContactInfo returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      "/community/memberContactInfo",
    );

    expect(res.status).toBe(401);
  });

  it("DELETE /community/communityInvites/:inviteId deletes invite when authenticated as leader and inviter", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP DeleteInvite Leader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/communityInvites/${invite.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    const found = await communityInviteRepo.findOneOrFail({
      where: { id: invite.id },
    });
    expect(found.deletedAt).not.toBeNull();
  });

  it("DELETE /community/communityInvites/:inviteId deletes invite when authenticated as admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP DeleteInvite Admin",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/communityInvites/${invite.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(res.status).toBe(200);
    const found = await communityInviteRepo.findOneOrFail({
      where: { id: invite.id },
    });
    expect(found.deletedAt).not.toBeNull();
  });

  it("DELETE /community/communityInvites/:inviteId returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP DeleteInvite NoAuth",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer()).delete(
      `/community/communityInvites/${invite.id}`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/create creates invite when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP CreateInvite Leader",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ invitedUserId: secondUser.id, communityId: community.id });

    expect(res.status).toBe(201);
    expect(res.body.community.id).toBe(community.id);
    expect(res.body.invitedUser.id).toBe(secondUser.id);
  });

  it("POST /community/communityInvites/create returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP CreateInvite NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/create")
      .send({ invitedUserId: secondUser.id, communityId: community.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/create returns 401 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP CreateInvite NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/create")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({ invitedUserId: testUser.id, communityId: community.id });

    // CommunityLeaderGuard rejects non-leaders with 401
    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/create returns 400 when pending invite already exists", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP CreateInvite Duplicate",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/create")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ invitedUserId: secondUser.id, communityId: community.id });

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/request creates request invite when authenticated as community member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RequestInvite Member",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/request")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ communityId: community.id, invitedUserId: secondUser.id });

    expect(res.status).toBe(201);
    expect(res.body.community.id).toBe(community.id);
    expect(res.body.invitedUser.id).toBe(secondUser.id);
    expect(res.body.status).toBe(CommunityInviteStatus.RequestPending);
  });

  it("POST /community/communityInvites/request returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RequestInvite NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/request")
      .send({ communityId: community.id, invitedUserId: secondUser.id });

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/request returns 400 when invited user is already a member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RequestInvite AlreadyMember",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/request")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ communityId: community.id, invitedUserId: secondUser.id });

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/request returns 400 when pending invite already exists", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RequestInvite Duplicate",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/request")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ communityId: community.id, invitedUserId: secondUser.id });

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/request returns error when inviting user is not a community member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RequestInvite NotMember",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post("/community/communityInvites/request")
      .set("Authorization", `Bearer ${secondUserToken}`)
      .send({ communityId: community.id, invitedUserId: testUser.id });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("POST /community/communityInvites/:inviteId/approveRequest approves request when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP ApproveRequest Leader",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/approveRequest`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(CommunityInviteStatus.InviteePending);
    expect(res.body.id).toBe(invite.id);
  });

  it("POST /community/communityInvites/:inviteId/approveRequest returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP ApproveRequest NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/communityInvites/${invite.id}/approveRequest`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/approveRequest returns 401 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP ApproveRequest NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/approveRequest`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    // CommunityLeaderGuard rejects non-leaders with 401
    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/approveRequest returns 400 when invite is not RequestPending", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP ApproveRequest WrongStatus",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/approveRequest`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/:inviteId/rejectRequest rejects request when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectRequest Leader",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/rejectRequest`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(201);
    const updated = await communityInviteRepo.findOneOrFail({
      where: { id: invite.id },
    });
    expect(updated.status).toBe(CommunityInviteStatus.RequestRejected);
  });

  it("POST /community/communityInvites/:inviteId/rejectRequest returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectRequest NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/communityInvites/${invite.id}/rejectRequest`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/rejectRequest returns 401 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectRequest NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: secondUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/rejectRequest`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    // CommunityLeaderGuard rejects non-leaders with 401
    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/rejectRequest returns 400 when invite is not RequestPending", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectRequest WrongStatus",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/rejectRequest`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("DELETE /community/communityInvites/:inviteId returns 401 when user is not a leader or admin", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP DeleteInvite NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .delete(`/community/communityInvites/${invite.id}`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    // CommunityLeaderGuard rejects non-leaders with 401
    expect(res.status).toBe(401);
  });

  it("GET /community/communityInvites/community/:communityId returns invites when authenticated as leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetCommunityInvites Leader",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/communityInvites/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].invitedUser.id).toBe(secondUser.id);
    expect(res.body[0].community.id).toBe(community.id);
  });

  it("GET /community/communityInvites/community/:communityId excludes deleted invites", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetCommunityInvites ExcludeDeleted",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
        deletedAt: new Date(),
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/communityInvites/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("GET /community/communityInvites/community/:communityId returns empty array when no invites exist", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetCommunityInvites Empty",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/communityInvites/community/${community.id}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("GET /community/communityInvites/community/:communityId returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetCommunityInvites NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer()).get(
      `/community/communityInvites/community/${community.id}`,
    );

    expect(res.status).toBe(401);
  });

  it("GET /community/communityInvites/community/:communityId returns 401 when user is not a leader", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetCommunityInvites NotLeader",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get(`/community/communityInvites/community/${community.id}`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    // CommunityLeaderGuard rejects non-leaders with 401
    expect(res.status).toBe(401);
  });

  it("GET /community/communityInvites returns incoming invites for authenticated user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetIncomingInvites",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/communityInvites")
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].invitedUser.id).toBe(secondUser.id);
    expect(res.body[0].community.id).toBe(community.id);
  });

  it("GET /community/communityInvites excludes deleted invites", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP GetIncomingInvites ExcludeDeleted",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
        deletedAt: new Date(),
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .get("/community/communityInvites")
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("GET /community/communityInvites returns empty array when no invites exist", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/community/communityInvites")
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("GET /community/communityInvites returns 401 when unauthenticated", async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      "/community/communityInvites",
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/accept accepts invite when authenticated as invited user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/accept`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(201);
    const updatedInvite = await communityInviteRepo.findOneOrFail({
      where: { id: invite.id },
    });
    expect(updatedInvite.status).toBe(CommunityInviteStatus.InviteeAccepted);
    const refreshed = await communityRepo.findOneOrFail({
      where: { id: community.id },
      relations: { users: true },
    });
    const memberIds = refreshed.users.map((u: User) => u.id);
    expect(memberIds).toContain(secondUser.id);
  });

  it("POST /community/communityInvites/:inviteId/accept returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/communityInvites/${invite.id}/accept`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/accept returns 400 when user is not the invited user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite WrongUser",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/accept`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/:inviteId/accept returns 400 when invite is not InviteePending", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite WrongStatus",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/accept`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/:inviteId/accept returns 400 when user is already a member", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite AlreadyMember",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/accept`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/:inviteId/accept removes user from non-leader communities", async () => {
    const oldCommunity = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite OldGroup",
        leaders: [testUser],
        users: [testUser, secondUser],
      }),
    );
    const newCommunity = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP AcceptInvite NewGroup",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community: newCommunity,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/accept`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(201);
    // User should be added to new community
    const refreshedNew = await communityRepo.findOneOrFail({
      where: { id: newCommunity.id },
      relations: { users: true },
    });
    expect(refreshedNew.users.map((u: User) => u.id)).toContain(secondUser.id);
    // User should be removed from old community (not a leader there)
    const refreshedOld = await communityRepo.findOneOrFail({
      where: { id: oldCommunity.id },
      relations: { users: true },
    });
    expect(refreshedOld.users.map((u: User) => u.id)).not.toContain(
      secondUser.id,
    );
  });

  it("POST /community/communityInvites/:inviteId/reject rejects invite when authenticated as invited user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectInvite",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/reject`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(201);
    const updatedInvite = await communityInviteRepo.findOneOrFail({
      where: { id: invite.id },
    });
    expect(updatedInvite.status).toBe(CommunityInviteStatus.InviteeRejected);
  });

  it("POST /community/communityInvites/:inviteId/reject returns 401 when unauthenticated", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectInvite NoAuth",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer()).post(
      `/community/communityInvites/${invite.id}/reject`,
    );

    expect(res.status).toBe(401);
  });

  it("POST /community/communityInvites/:inviteId/reject returns 400 when user is not the invited user", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectInvite WrongUser",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.InviteePending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/reject`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(400);
  });

  it("POST /community/communityInvites/:inviteId/reject returns 400 when invite is not InviteePending", async () => {
    const community = await communityRepo.save(
      communityRepo.create({
        name: "E2E HTTP RejectInvite WrongStatus",
        leaders: [testUser],
        users: [testUser],
      }),
    );
    const invite = await communityInviteRepo.save(
      communityInviteRepo.create({
        status: CommunityInviteStatus.RequestPending,
        invitingUser: testUser,
        invitedUser: secondUser,
        community,
      }),
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/community/communityInvites/${invite.id}/reject`)
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(res.status).toBe(400);
  });

  describe("POST /community/:communityId/addMember/admin", () => {
    const addMember = (communityId: number, userId: number) =>
      request(ctx.app.getHttpServer())
        .post(`/community/${communityId}/addMember/admin`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ userId });

    it("adds a member to a group that accepts staff assignments", async () => {
      const community = await communityRepo.save(
        communityRepo.create({
          name: "Staff Assignable Group",
          leaders: [testUser],
          users: [testUser],
          allowStaffAssignments: true,
          maxCapacity: 10,
        }),
      );

      await addMember(community.id, secondUser.id).expect(201);

      const updated = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true },
      });
      expect(updated.users.map((u) => u.id)).toContain(secondUser.id);
    });

    it("refuses a group that has opted out of staff assignments", async () => {
      const community = await communityRepo.save(
        communityRepo.create({
          name: "No Staff Assignments Group",
          leaders: [testUser],
          users: [testUser],
          public: false,
          allowMemberInvites: true,
          allowStaffAssignments: false,
          maxCapacity: 10,
        }),
      );

      await addMember(community.id, secondUser.id).expect(400);

      const updated = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true },
      });
      expect(updated.users.map((u) => u.id)).not.toContain(secondUser.id);
    });

    it("refuses a group that is already at capacity", async () => {
      const existingMember = await userRepo.save(
        userRepo.create({
          name: "Capacity Filler",
          email: "capacity.filler@example.com",
          password: "Password123!",
        }),
      );
      const community = await communityRepo.save(
        communityRepo.create({
          name: "Full Staff Assignable Group",
          leaders: [testUser],
          users: [testUser, existingMember],
          allowStaffAssignments: true,
          maxCapacity: 1,
        }),
      );

      await addMember(community.id, secondUser.id).expect(400);

      const updated = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true },
      });
      expect(updated.users.map((u) => u.id)).not.toContain(secondUser.id);
    });

    it("allows only one concurrent assignment into the final available slot", async () => {
      const competingMember = await userRepo.save(
        userRepo.create({
          name: "Competing Assigned Member",
          email: "competing.assigned.member@example.com",
          password: "Password123!",
        }),
      );
      await giveActiveContract(ctx, competingMember.id);
      const community = await communityRepo.save(
        communityRepo.create({
          name: "Final Staff Assignment Slot",
          leaders: [testUser],
          users: [testUser],
          allowStaffAssignments: true,
          maxCapacity: 1,
        }),
      );

      const responses = await Promise.all([
        addMember(community.id, secondUser.id),
        addMember(community.id, competingMember.id),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 400,
      ]);
      const updated = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true, leaders: true },
      });
      expect(updated.users.length - updated.leaders!.length).toBe(1);
    });
  });

  describe("POST /community/:communityId/moveMember/admin", () => {
    const setUpGroups = async (
      destinationOverrides?: Partial<Community>,
    ): Promise<{
      source: Community;
      destination: Community;
    }> => {
      const destinationLeader = await userRepo.save(
        userRepo.create({
          name: "Destination Leader",
          email: "destination.leader@example.com",
          password: "Password123!",
        }),
      );
      const [source, destination] = await Promise.all([
        communityRepo.save(
          communityRepo.create({
            name: "Source Group",
            leaders: [testUser],
            users: [testUser, secondUser],
            allowStaffAssignments: true,
            maxCapacity: 10,
          }),
        ),
        communityRepo.save(
          communityRepo.create({
            name: "Destination Group",
            leaders: [destinationLeader],
            users: [destinationLeader],
            allowStaffAssignments: true,
            maxCapacity: 10,
            ...destinationOverrides,
          }),
        ),
      ]);
      return { source, destination };
    };

    const moveMember = (params: {
      from: Community;
      to: Community;
      userId: number;
    }) =>
      request(ctx.app.getHttpServer())
        .post(`/community/${params.from.id}/moveMember/admin`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: params.userId, destinationCommunityId: params.to.id });

    const memberIds = async (community: Community): Promise<number[]> => {
      const refreshed = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true },
      });
      return refreshed.users.map((member) => member.id);
    };

    it("moves the member out of the source group and into the destination", async () => {
      const { source, destination } = await setUpGroups();

      await moveMember({
        from: source,
        to: destination,
        userId: secondUser.id,
      }).expect(200);

      expect(await memberIds(source)).not.toContain(secondUser.id);
      expect(await memberIds(destination)).toContain(secondUser.id);
    });

    it("updates participant authorization even when post-commit sync fails", async () => {
      const { source, destination } = await setUpGroups();
      await Promise.all([
        conversationService.syncCommunityConversationMembers(source.id),
        conversationService.syncCommunityConversationMembers(destination.id),
      ]);
      const [sourceConversation, destinationConversation] = await Promise.all([
        conversationRepo.findOneOrFail({
          where: { community: { id: source.id } },
        }),
        conversationRepo.findOneOrFail({
          where: { community: { id: destination.id } },
        }),
      ]);
      const sync = jest
        .spyOn(conversationService, "syncCommunityConversationMembers")
        .mockRejectedValue(new Error("sync failed"));

      try {
        await moveMember({
          from: source,
          to: destination,
          userId: secondUser.id,
        }).expect(200);
      } finally {
        sync.mockRestore();
      }

      expect(
        await participantRepo.exists({
          where: {
            conversation: { id: sourceConversation.id },
            user: { id: secondUser.id },
          },
        }),
      ).toBe(false);
      expect(
        await participantRepo.exists({
          where: {
            conversation: { id: destinationConversation.id },
            user: { id: secondUser.id },
          },
        }),
      ).toBe(true);
    });

    it("allows only one concurrent move into the final available slot", async () => {
      const { source, destination } = await setUpGroups({ maxCapacity: 1 });
      const competingMember = await userRepo.save(
        userRepo.create({
          name: "Competing Member",
          email: "competing.member@example.com",
          password: "Password123!",
        }),
      );
      await giveActiveContract(ctx, competingMember.id);
      const competingSource = await communityRepo.save(
        communityRepo.create({
          name: "Competing Source Group",
          leaders: [testUser],
          users: [testUser, competingMember],
          allowStaffAssignments: true,
          maxCapacity: 10,
        }),
      );

      const responses = await Promise.all([
        moveMember({
          from: source,
          to: destination,
          userId: secondUser.id,
        }),
        moveMember({
          from: competingSource,
          to: destination,
          userId: competingMember.id,
        }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      const destinationMemberIds = await memberIds(destination);
      const movedUserIds = [secondUser.id, competingMember.id];
      expect(
        movedUserIds.filter((userId) => destinationMemberIds.includes(userId)),
      ).toHaveLength(1);

      const sourceMemberships = await Promise.all([
        memberIds(source),
        memberIds(competingSource),
      ]);
      movedUserIds.forEach((userId, index) => {
        expect(destinationMemberIds.includes(userId)).not.toBe(
          sourceMemberships[index].includes(userId),
        );
      });
    });

    it("coordinates a concurrent assignment and move into the final slot", async () => {
      const { source, destination } = await setUpGroups({ maxCapacity: 1 });
      const competingMember = await userRepo.save(
        userRepo.create({
          name: "Competing Unassigned Member",
          email: "competing.unassigned.member@example.com",
          password: "Password123!",
        }),
      );
      await giveActiveContract(ctx, competingMember.id);

      const responses = await Promise.all([
        moveMember({
          from: source,
          to: destination,
          userId: secondUser.id,
        }),
        request(ctx.app.getHttpServer())
          .post(`/community/${destination.id}/addMember/admin`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ userId: competingMember.id }),
      ]);

      expect(
        responses.filter((response) => response.status === 400),
      ).toHaveLength(1);
      expect(
        responses.filter((response) => [200, 201].includes(response.status)),
      ).toHaveLength(1);
      const destinationMemberIds = await memberIds(destination);
      expect(
        [secondUser.id, competingMember.id].filter((userId) =>
          destinationMemberIds.includes(userId),
        ),
      ).toHaveLength(1);
      expect((await memberIds(source)).includes(secondUser.id)).not.toBe(
        destinationMemberIds.includes(secondUser.id),
      );
    });
  });
});
