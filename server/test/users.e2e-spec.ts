import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import request from 'supertest';
import { Repository } from 'typeorm';
import { City } from '../src/geo/city.entity';
import { GeoModule } from '../src/geo/geo.module';
import { FriendStatus } from '../src/user/entities/friend.entity';
import { User } from '../src/user/entities/user.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { UserService } from 'src/user/user.service';
import { Community } from '../src/user/entities/community.entity';

describe('Users (e2e)', () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let cityRepo: Repository<City>;
  let communityRepo: Repository<Community>;
  let userService: UserService;

  let userAId: number;
  let userAToken: string;
  let userBId: number;
  let userBToken: string;
  let communityLedByUserA: Community;
  let communityLedByUserB: Community;
  let inviteTargetUserId: number;
  let alternateInviteTargetUserId: number;
  let adminInviteTargetUserId: number;
  let communityMemberId: number;
  let communityMemberToken: string;

  beforeAll(async () => {
    ctx = await createTestApp([GeoModule]);
    userRepo = ctx.dataSource.getRepository(User);
    cityRepo = ctx.dataSource.getRepository(City);
    communityRepo = ctx.dataSource.getRepository(Community);
    userService = ctx.app.get(UserService);
    const userA = userRepo.create({
      name: 'Friend A',
      email: 'frienda@example.com',
      password: 'Password123!',
    });
    await userRepo.save(userA);
    userAId = userA.id;
    userAToken = ctx.jwtService.sign(
      { sub: userAId, email: userA.email, name: userA.name },
      { secret: process.env.JWT_SECRET },
    );

    const userB = userRepo.create({
      name: 'Friend B',
      email: 'friendb@example.com',
      password: 'Password123!',
    });

    await userRepo.save(userB);
    userBId = userB.id;
    userBToken = ctx.jwtService.sign(
      { sub: userBId, email: userB.email, name: userB.name },
      { secret: process.env.JWT_SECRET },
    );

    const inviteTarget = await userRepo.save(
      userRepo.create({
        name: 'Pending Invite Target',
        email: 'pending.invite@example.com',
        password: 'Password123!',
      }),
    );
    inviteTargetUserId = inviteTarget.id;

    const alternateInviteTarget = await userRepo.save(
      userRepo.create({
        name: 'Second Invite Target',
        email: 'second.invite@example.com',
        password: 'Password123!',
      }),
    );
    alternateInviteTargetUserId = alternateInviteTarget.id;

    const adminInviteTarget = await userRepo.save(
      userRepo.create({
        name: 'Admin Invite Target',
        email: 'admin.invite@example.com',
        password: 'Password123!',
      }),
    );
    adminInviteTargetUserId = adminInviteTarget.id;

    communityLedByUserA = await communityRepo.save(
      communityRepo.create({
        name: 'Community Alpha',
        description: 'Alpha',
        leaders: [userA],
        users: [userA],
      }),
    );

    const communityMember = await userRepo.save(
      userRepo.create({
        name: 'Community Member',
        email: 'community.member@example.com',
        password: 'Password123!',
        communities: [communityLedByUserA],
      }),
    );
    communityMemberId = communityMember.id;
    communityMemberToken = ctx.jwtService.sign(
      {
        sub: communityMemberId,
        email: communityMember.email,
        name: communityMember.name,
      },
      { secret: process.env.JWT_SECRET },
    );

    communityLedByUserB = await communityRepo.save(
      communityRepo.create({
        name: 'Community Beta',
        description: 'Beta',
        leaders: [userB],
        users: [userB],
      }),
    );
  }, 50000);

  it('can update user', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/update`)
      .send({
        name: 'Friend A',
        profileDescription: 'Friend A',
      })
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(201);
  });

  it('can complete onboarding with city and anonymous settings', async () => {
    // First create a test city
    const testCity = cityRepo.create({
      id: 1,
      name: 'Test City',
      admin1: 'Test State',
      admin2: 'Test County',
      countryCode: 'TC',
      latitude: 37.7749,
      longitude: -122.4194,
      countryName: 'Test Country',
    });
    await cityRepo.save(testCity);

    const res = await request(ctx.app.getHttpServer())
      .post('/user/onboarding')
      .send({
        cityId: testCity.id,
        over18: true,
        anonymous: true,
      })
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(201);

    // Verify the user was updated in the database
    const updatedUser = await userRepo.findOne({
      where: { id: userAId },
      relations: ['city'],
    });
    expect(updatedUser).not.toBeNull();

    expect(updatedUser?.anonymous).toBe(true);
    expect(updatedUser?.over18).toBe(true);
    expect(updatedUser?.city?.id).toBe(testCity.id);
    expect(updatedUser?.onboardingComplete).toBe(true);
  });

  it('can update user anonymous setting and city via update endpoint', async () => {
    // Create another test city
    const newCity = cityRepo.create({
      id: 1,
      name: 'New Test City',
      admin1: 'New State',
      admin2: 'New County',
      countryName: 'New Country',
      countryCode: 'NC',
      latitude: 40.7128,
      longitude: -74.006,
    });
    await cityRepo.save(newCity);

    const res = await request(ctx.app.getHttpServer())
      .post('/user/update')
      .send({
        anonymous: false,
        cityId: newCity.id,
      })
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(201);

    // Verify the user was updated in the database
    const updatedUser = await userRepo.findOne({
      where: { id: userAId },
      relations: ['city'],
    });
    expect(updatedUser?.anonymous).toBe(false);
    expect(updatedUser?.city?.id).toBe(newCity.id);
  });

  it('User A can send a friend request to User B', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/friends/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe(FriendStatus.Pending);
  });

  it('Request appears in the correct sent/received queues', async () => {
    // Sent list for A
    const sent = await request(ctx.app.getHttpServer())
      .get('/user/friends/requests/sent')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(sent.status).toBe(200);
    expect(sent.body.length).toBe(1);
    expect(sent.body[0].id).toBe(userBId);

    // Received list for B
    const recv = await request(ctx.app.getHttpServer())
      .get('/user/friends/requests/received')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(recv.status).toBe(200);
    expect(recv.body.length).toBe(1);
    expect(recv.body[0].id).toBe(userAId);
  });

  it('user B has a notification for the friend request', async () => {
    const notifs = await request(ctx.app.getHttpServer())
      .get('/notifs')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(notifs.status).toBe(200);
    expect(notifs.body.length).toBe(1);
    expect(notifs.body[0].category).toBe(NotificationCategory.FriendRequest);
  });

  it('User B can accept the friend request', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`/user/friends/${userAId}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(FriendStatus.Accepted);
  });

  it('user A has a notification for the friend request being accepted', async () => {
    const notifs = await request(ctx.app.getHttpServer())
      .get('/notifs')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(notifs.status).toBe(200);
    expect(notifs.body.length).toBe(1);
    expect(notifs.body[0].category).toBe(
      NotificationCategory.FriendRequestAccepted,
    );
  });

  it('Both users now appear in each other’s friend lists', async () => {
    const aFriends = await request(ctx.app.getHttpServer())
      .get(`/user/listfriends/${userAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    const bFriends = await request(ctx.app.getHttpServer())
      .get(`/user/listfriends/${userBId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(aFriends.status).toBe(200);
    expect(bFriends.status).toBe(200);
    expect(aFriends.body.some((u) => u.id === userBId)).toBe(true);
    expect(bFriends.body.some((u) => u.id === userAId)).toBe(true);
  });

  it('user can check their friend status', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/user/myfriendrelationship/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(FriendStatus.Accepted);
  });

  it('Either user can un-friend the other', async () => {
    const res = await request(ctx.app.getHttpServer())
      .delete(`/user/friends/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect([200, 204]).toContain(res.status);

    // Lists should now be empty
    const list = await request(ctx.app.getHttpServer())
      .get(`/user/listfriends/${userAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(list.status).toBe(200);
    expect(list.body.length).toBe(0);
  });

  it('User A can re-send and User B can decline', async () => {
    /* resend */
    await request(ctx.app.getHttpServer())
      .post(`/user/friends/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    /* decline */
    const res = await request(ctx.app.getHttpServer())
      .patch(`/user/friends/${userAId}/decline`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(FriendStatus.Declined);
  });

  /* ────────────────────────────────────────────────────────────
   *  Auth guard checks
   * ──────────────────────────────────────────────────────────── */

  it('Unauthenticated requests are rejected', async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      '/user/listfriends/1',
    );
    expect(res.status).toBe(401);
  });

  it('User cannot send a friend request to themself', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/friends/${userAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(400);
  });

  /* ──────────────────────────────────────────────────────────── */

  it('user can sign and suspend the contract', async () => {
    const sign = await request(ctx.app.getHttpServer())
      .post('/user/signcontract')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    expect(typeof sign.text === 'string' || sign.body).toBeTruthy();

    const suspend = await request(ctx.app.getHttpServer())
      .post('/user/suspendcontract')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    expect(typeof suspend.text === 'string' || suspend.body).toBeTruthy();
  });

  it('returns profile information for the authenticated user', async () => {
    const profile = await request(ctx.app.getHttpServer())
      .get('/user/myprofile')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(profile.body.id).toBe(userAId);

    const members = await request(ctx.app.getHttpServer())
      .get('/user/members')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(200);

    expect(Array.isArray(members.body)).toBe(true);
    expect(members.body.length).toBeGreaterThan(0);
  });

  it('allows admins to list all users', async () => {
    const list = await request(ctx.app.getHttpServer())
      .get('/user/list')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
  });

  it('verifies email tokens via the public endpoint', async () => {
    const token = await userService.getVerifyEmailToken(userAId);

    await request(ctx.app.getHttpServer())
      .post('/user/verifyEmail')
      .send({ token })
      .expect(201);

    const refreshed = await userRepo.findOne({ where: { id: userAId } });
    expect(refreshed?.emailVerified).toBe(true);
  });

  describe('community invite permissions', () => {
    it('prevents leaders from inviting people into communities they do not lead', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/user/createCommunityInvite')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          invitedUserId: inviteTargetUserId,
          communityId: communityLedByUserB.id,
        });

      expect(res.status).toBe(401);
    });

    it('allows leaders to create community invites for their own communities', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/user/createCommunityInvite')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          invitedUserId: alternateInviteTargetUserId,
          communityId: communityLedByUserA.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.community.id).toBe(communityLedByUserA.id);
      expect(res.body.invitedUser.id).toBe(alternateInviteTargetUserId);
    });

    describe('createOnetimeInvite', () => {
      it('rejects requests without a community id for non-admins', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            invitee: 'missing-community@example.com',
          });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Community ID not provided');
      });

      it('rejects requests for communities the user is not a member of', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            invitee: 'outsider@example.com',
            communityId: communityLedByUserB.id,
          });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('not a member');
      });

      it('ignores provided invitingUserId for non-admins and uses the authenticated user', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            invitingUserId: userBId,
            invitee: 'mismatch@example.com',
            communityId: communityLedByUserA.id,
          });

        expect(res.status).toBe(201);
        expect(res.body.invitingUser.id).toBe(userAId);
      });

      it('auto-approves invites when the inviting user leads the community', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            invitingUserId: userAId,
            invitee: 'leader@example.com',
            communityId: communityLedByUserA.id,
          });

        expect(res.status).toBe(201);
        expect(res.body.approved).toBe(true);
        expect(res.body.community.id).toBe(communityLedByUserA.id);
      });

      it('requires invitee descriptions when the inviting user is not a leader or admin', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${communityMemberToken}`)
          .send({
            invitee: 'member-nodecription@example.com',
            communityId: communityLedByUserA.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('invitee description');
      });

      it('allows community members to submit invites with descriptions for manual approval', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${communityMemberToken}`)
          .send({
            invitee: 'member-withdescription@example.com',
            inviteeDescription: 'Member request for manual review',
            communityId: communityLedByUserA.id,
          });

        expect(res.status).toBe(201);
        expect(res.body.invitingUser.id).toBe(communityMemberId);
        expect(res.body.approved).toBe(false);
        expect(res.body.inviteeDescription).toBe(
          'Member request for manual review',
        );
      });

      it('allows admins to create onetime invites for any community', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send({
            invitingUserId: ctx.adminUserId,
            invitee: 'admin-community@example.com',
            communityId: communityLedByUserB.id,
          });

        expect(res.status).toBe(201);
        expect(res.body.community.id).toBe(communityLedByUserB.id);
        expect(res.body.invitingUser.id).toBe(ctx.adminUserId);
        expect(res.body.approved).toBe(true);
      });

      it('allows admins to create onetime invites on behalf of another user without specifying a community', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send({
            invitingUserId: userAId,
            invitee: 'admin-onbehalf@example.com',
          });

        expect(res.status).toBe(201);
        expect(res.body.community).toBeUndefined();
        expect(res.body.invitingUser.id).toBe(userAId);
        expect(res.body.approved).toBe(true);
      });

      it('returns not found when admins reference communities that do not exist', async () => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/createOnetimeInvite')
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send({
            invitingUserId: ctx.adminUserId,
            invitee: 'missing-community@example.com',
            communityId: 999999,
          });

        expect(res.status).toBe(404);
        expect(res.body.message).toContain('not found');
      });
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
