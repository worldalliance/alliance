import { SignUpDto } from "src/auth/dto/sign-up.dto";
import { ACCESS_COOKIE, JWTTokenType } from "src/auth/tokens";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import { RefreshTokensResponseDto } from "../src/auth/dto/authtokens.dto";
import { SignInResponseDto } from "../src/auth/dto/signin.dto";
import { Community } from "../src/community/entities/community.entity";
import { Friend } from "../src/user/entities/friend.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Auth (e2e)", () => {
  let userRepository: Repository<User>;
  let inviteRepo: Repository<OnetimeInvite>;
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepository = ctx.dataSource.getRepository(User);
    inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
  }, 50000);

  it("returns 401 for invalid login", () => {
    return request(ctx.app.getHttpServer())
      .post("/auth/login")
      .send({ email: "baduser@test.com", password: "password", mode: "header" })
      .expect(401);
  });

  it("registers a new user", () => {
    return request(ctx.app.getHttpServer())
      .post("/auth/register")
      .send({
        email: "newusertest@test.com",
        password: "password",
        name: "Test User",
        mode: "header",
        timeZone: "America/Los_Angeles",
      } satisfies SignUpDto)
      .expect(201);
  });

  it("returns a token for a valid login", async () => {
    const user = userRepository.create({
      email: "newusertest@test.com",
      password: "password",
      name: "Test User",
    });
    await userRepository.save(user);

    const response = await request(ctx.app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "newusertest@test.com",
        password: "password",
        mode: "header",
      })
      .expect(200);

    const body = response.body as SignInResponseDto;

    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
  });

  describe("token refresh", () => {
    const login = async (): Promise<SignInResponseDto> => {
      await userRepository.save(
        userRepository.create({
          email: "newusertest@test.com",
          password: "password",
          name: "Test User",
        }),
      );

      const response = await request(ctx.app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "newusertest@test.com",
          password: "password",
          mode: "header",
        })
        .expect(200);

      return response.body as SignInResponseDto;
    };

    it("returns 401 for an invalid refresh token", () => {
      return request(ctx.app.getHttpServer())
        .post("/auth/refresh")
        .set("Authorization", "Bearer invalid")
        .expect(401);
    });

    it("returns a new access token for a valid refresh token", async () => {
      const { refresh_token } = await login();

      const refreshResponse = await request(ctx.app.getHttpServer())
        .post("/auth/refresh")
        .set("Authorization", `Bearer ${refresh_token}`)
        .expect(200);

      const refreshBody = refreshResponse.body as RefreshTokensResponseDto;

      expect(refreshBody.access_token).toBeDefined();
    });

    it.each(["Basic", "bearer"])(
      "refuses a refresh token sent as %p",
      async (scheme) => {
        const { refresh_token } = await login();

        await request(ctx.app.getHttpServer())
          .post("/auth/refresh")
          .set("Authorization", `${scheme} ${refresh_token}`)
          .expect(401);
      },
    );
  });

  describe("signUp with invite codes", () => {
    let invitingUser: User;
    let communityRepo: Repository<Community>;

    beforeEach(async () => {
      communityRepo = ctx.dataSource.getRepository(Community);

      // Create an inviting user
      invitingUser = await userRepository.save(
        userRepository.create({
          email: "inviter@test.com",
          password: "password",
          name: "Inviter User",
        }),
      );
    });

    it("registers a user with an invite code and sets referredByInvite", async () => {
      // Create a community for the invite
      const community = await communityRepo.save(
        communityRepo.create({
          name: "Test Community",
          description: "Test",
          leaders: [invitingUser],
          users: [invitingUser],
        }),
      );

      // Create an invite
      const invite = await inviteRepo.save(
        inviteRepo.create({
          invitee: "invited@test.com",
          code: "TEST-INVITE-CODE",
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser,
          community,
        }),
      );

      // Register with the invite code
      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "invited@test.com",
          password: "password",
          name: "Invited User",
          referralCode: "TEST-INVITE-CODE",
          mode: "header",
          timeZone: "America/Los_Angeles",
        } satisfies SignUpDto)
        .expect(201);

      // Verify the user was created with referredByInvite
      const newUser = await userRepository.findOne({
        where: { email: "invited@test.com" },
        relations: { referredByInvite: true, referredBy: true },
      });

      expect(newUser).not.toBeNull();
      expect(newUser?.referredByInvite?.id).toBe(invite.id);
      expect(newUser?.referredBy?.id).toBe(invitingUser.id);

      // Verify the invite was invalidated
      const updatedInvite = await inviteRepo.findOne({
        where: { id: invite.id },
      });
      expect(updatedInvite?.status).toBe(OnetimeInviteStatus.LINK_USED);
    });

    it("creates friendship between inviting user and new user when registering with invite", async () => {
      await inviteRepo.save(
        inviteRepo.create({
          invitee: "friend-invited@test.com",
          code: "FRIEND-INVITE-CODE",
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser,
        }),
      );

      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "friend-invited@test.com",
          password: "password",
          name: "Friend Invited User",
          referralCode: "FRIEND-INVITE-CODE",
          mode: "header",
          timeZone: "America/Los_Angeles",
        } satisfies SignUpDto)
        .expect(201);

      // Verify friendship was created
      const newUser = await userRepository.findOne({
        where: { email: "friend-invited@test.com" },
      });

      const friendRepo = ctx.dataSource.getRepository(Friend);
      const friendship = await friendRepo.findOne({
        where: [
          {
            requester: { id: invitingUser.id },
            addressee: { id: newUser!.id },
          },
          {
            requester: { id: newUser!.id },
            addressee: { id: invitingUser.id },
          },
        ],
      });

      expect(friendship).not.toBeNull();
    });

    it("does not join community immediately on signup with invite", async () => {
      const community = await communityRepo.save(
        communityRepo.create({
          name: "Signup Community",
          description: "Test",
          leaders: [invitingUser],
          users: [invitingUser],
        }),
      );

      const invite = await inviteRepo.save(
        inviteRepo.create({
          invitee: "no-join@test.com",
          code: "NO-JOIN-CODE",
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser,
          community,
        }),
      );

      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "no-join@test.com",
          password: "password",
          name: "No Join User",
          referralCode: "NO-JOIN-CODE",
          mode: "header",
          timeZone: "America/Los_Angeles",
        } satisfies SignUpDto)
        .expect(201);

      // Verify user is NOT in the community yet
      const newUser = await userRepository.findOne({
        where: { email: "no-join@test.com" },
        relations: { communities: true, referredByInvite: true },
      });

      expect(newUser?.communities).toEqual([]);
      expect(newUser?.referredByInvite?.id).toBe(invite.id);
    });

    it("allows registration without invite code in test environment", async () => {
      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "no-invite@test.com",
          password: "password",
          name: "No Invite User",
          referralCode: "INVALID-CODE",
          mode: "header",
          timeZone: "America/Los_Angeles",
        } satisfies SignUpDto)
        .expect(201);

      const newUser = await userRepository.findOne({
        where: { email: "no-invite@test.com" },
        relations: { referredByInvite: true, referredBy: true },
      });

      expect(newUser).not.toBeNull();
      expect(newUser?.referredByInvite).toBeNull();
      expect(newUser?.referredBy).toBeNull();
    });

    it("registers a user with a user referral code (not OnetimeInvite)", async () => {
      // Create a user with a referral code
      const referringUser = await userRepository.save(
        userRepository.create({
          email: "referrer@test.com",
          password: "password",
          name: "Referrer User",
        }),
      );
      // referralCode is generated automatically, but let's ensure it exists
      if (!referringUser.referralCode) {
        await referringUser.generateReferralCode();
        await userRepository.save(referringUser);
      }

      // Register with the user's referral code
      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "referred@test.com",
          password: "password",
          name: "Referred User",
          referralCode: referringUser.referralCode,
          mode: "header",
          timeZone: "America/Los_Angeles",
        } satisfies SignUpDto)
        .expect(201);

      // Verify the user was created with referredBy set
      const newUser = await userRepository.findOne({
        where: { email: "referred@test.com" },
        relations: { referredByInvite: true, referredBy: true },
      });

      expect(newUser).not.toBeNull();
      expect(newUser?.referredByInvite).toBeNull(); // Should not have OnetimeInvite
      expect(newUser?.referredBy?.id).toBe(referringUser.id); // Should have referring user

      // Verify friendship was created
      const friendRepo = ctx.dataSource.getRepository(Friend);
      const friendship = await friendRepo.findOne({
        where: [
          {
            requester: { id: referringUser.id },
            addressee: { id: newUser!.id },
          },
          {
            requester: { id: newUser!.id },
            addressee: { id: referringUser.id },
          },
        ],
      });

      expect(friendship).not.toBeNull();
    });
  });

  describe("time zone", () => {
    it("stores the time zone the client signed up with", async () => {
      const referringUser = await userRepository.save(
        userRepository.create({
          email: "tz-referrer@test.com",
          password: "password",
          name: "TZ Referrer",
        }),
      );
      if (!referringUser.referralCode) {
        await referringUser.generateReferralCode();
        await userRepository.save(referringUser);
      }

      await request(ctx.app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "tz-member@test.com",
          password: "password",
          name: "TZ Member",
          referralCode: referringUser.referralCode,
          mode: "header",
          timeZone: "Europe/Berlin",
        } satisfies SignUpDto)
        .expect(201);

      const newUser = await userRepository.findOneOrFail({
        where: { email: "tz-member@test.com" },
      });
      expect(newUser.timeZone).toBe("Europe/Berlin");
    });

    it.each([["not-a-zone"], [""], [undefined]])(
      "rejects a signup carrying %p as its time zone",
      async (timeZone) => {
        const res = await request(ctx.app.getHttpServer())
          .post("/auth/register")
          .send({
            email: `bad-tz-${String(timeZone)}@test.com`,
            password: "password",
            name: "Bad TZ",
            referralCode: "ANY-CODE",
            mode: "header",
            timeZone,
          });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.message)).toContain("timeZone");
        expect(
          await userRepository.findOneBy({
            email: `bad-tz-${String(timeZone)}@test.com`,
          }),
        ).toBeNull();
      },
    );
  });

  describe("token type", () => {
    const authenticatedRoutes = [
      "/auth/me",
      "/user/list",
      "/user/onetimeInvites/1",
      "/actions/activities/feed",
    ];

    it("refuses a mailed password-reset token wherever a session is read", async () => {
      const admin = await userRepository.save(
        userRepository.create({
          email: "reset-admin@test.com",
          password: "password",
          name: "Reset Admin",
          admin: true,
        }),
      );
      const resetToken = await ctx.app
        .get(UserService)
        .generatePasswordResetToken(admin.id);
      const accessToken = signAccessToken(ctx.jwtService, admin);

      for (const route of authenticatedRoutes) {
        const refused = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Authorization", `Bearer ${resetToken}`);
        expect([route, refused.status]).toEqual([route, 401]);

        const allowed = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Authorization", `Bearer ${accessToken}`);
        expect([route, allowed.status]).toEqual([route, 200]);
      }
    });

    it.each(
      Object.values(JWTTokenType).filter(
        (type) => type !== JWTTokenType.access,
      ),
    )("refuses a %s token on an authenticated route", async (tokenType) => {
      const user = await userRepository.save(
        userRepository.create({
          email: `${tokenType}-token@test.com`,
          password: "password",
          name: "Typed Token",
        }),
      );
      const token = ctx.jwtService.sign(
        { sub: user.id, email: user.email, tokenType },
        { secret: process.env.JWT_SECRET },
      );

      await request(ctx.app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    });

    it("refuses a mailed password-reset token in the access_token cookie", async () => {
      const admin = await userRepository.save(
        userRepository.create({
          email: "reset-cookie@test.com",
          password: "password",
          name: "Reset Cookie",
          admin: true,
        }),
      );
      const resetToken = await ctx.app
        .get(UserService)
        .generatePasswordResetToken(admin.id);
      const accessToken = signAccessToken(ctx.jwtService, admin);

      for (const route of authenticatedRoutes) {
        const refused = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Cookie", [`${ACCESS_COOKIE}=${resetToken}`]);
        expect([route, refused.status]).toEqual([route, 401]);

        const allowed = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Cookie", [`${ACCESS_COOKIE}=${accessToken}`]);
        expect([route, allowed.status]).toEqual([route, 200]);
      }
    });

    it("takes the Bearer header over the cookie when a request carries both", async () => {
      const admin = await userRepository.save(
        userRepository.create({
          email: "both-tokens@test.com",
          password: "password",
          name: "Both Tokens",
          admin: true,
        }),
      );
      const accessToken = signAccessToken(ctx.jwtService, admin);
      const guestToken = ctx.jwtService.sign(
        { sub: "guest-id", tokenType: JWTTokenType.guest },
        { secret: process.env.JWT_SECRET },
      );

      for (const route of authenticatedRoutes) {
        const badHeader = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Authorization", `Bearer ${guestToken}`)
          .set("Cookie", [`${ACCESS_COOKIE}=${accessToken}`]);
        expect([route, badHeader.status]).toEqual([route, 401]);

        const badCookie = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Authorization", `Bearer ${accessToken}`)
          .set("Cookie", [`${ACCESS_COOKIE}=${guestToken}`]);
        expect([route, badCookie.status]).toEqual([route, 200]);

        const otherScheme = await request(ctx.app.getHttpServer())
          .get(route)
          .set("Authorization", "Basic dXNlcjpwYXNz")
          .set("Cookie", [`${ACCESS_COOKIE}=${accessToken}`]);
        expect([route, otherScheme.status]).toEqual([route, 200]);
      }
    });

    it.each([{ tokenType: "toString" }, {}])(
      "refuses a token whose tokenType we never issue (%o)",
      async (claims) => {
        const user = await userRepository.save(
          userRepository.create({
            email: "untyped-token@test.com",
            password: "password",
            name: "Untyped Token",
          }),
        );
        const token = ctx.jwtService.sign(
          { sub: user.id, email: user.email, ...claims },
          { secret: process.env.JWT_SECRET },
        );

        await request(ctx.app.getHttpServer())
          .get("/auth/me")
          .set("Authorization", `Bearer ${token}`)
          .expect(401);
      },
    );
  });

  afterEach(async () => {
    await userRepository.deleteAll();
    // await inviteRepo.deleteAll();
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
