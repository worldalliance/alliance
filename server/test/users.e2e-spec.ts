import { toE164 } from '@alliance/common/phone';
import { R } from '@alliance/common/result';
import { AuthService } from 'src/auth/auth.service';
import { ContractService } from 'src/contract/contract.service';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { ShareUrl } from 'src/share-urls/entities/share-url.entity';
import { StoredInviteAssignmentKind } from 'src/share-urls/invite-assignment';
import { ShareUrlsService } from 'src/share-urls/share-urls.service';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from 'src/user/entities/onetime-invite.entity';
import { UserService } from 'src/user/user.service';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { Community } from '../src/community/entities/community.entity';
import { City } from '../src/geo/city.entity';
import { GeoModule } from '../src/geo/geo.module';
import { FriendStatus } from '../src/user/entities/friend.entity';
import { ReferralSource, User } from '../src/user/entities/user.entity';
import {
  createTestApp,
  giveActiveContract,
  TestContext,
} from './e2e-test-utils';

describe('Users (e2e)', () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let cityRepo: Repository<City>;
  let communityRepo: Repository<Community>;
  let onetimeInviteRepo: Repository<OnetimeInvite>;
  let userService: UserService;
  let contractService: ContractService;
  let shareUrlsService: ShareUrlsService;
  let authService: AuthService;

  let userAId: number;
  let userAToken: string;
  let userBId: number;
  let userBToken: string;
  let communityLedByUserA: Community;
  let communityLedByUserB: Community;
  let communityMemberId: number;
  let communityMemberToken: string;

  beforeAll(async () => {
    ctx = await createTestApp([GeoModule]);
    userRepo = ctx.dataSource.getRepository(User);
    cityRepo = ctx.dataSource.getRepository(City);
    communityRepo = ctx.dataSource.getRepository(Community);
    onetimeInviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
    userService = ctx.app.get(UserService);
    contractService = ctx.app.get(ContractService);
    shareUrlsService = ctx.app.get(ShareUrlsService);
    authService = ctx.app.get(AuthService);
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

  describe('phone number on /user/update', () => {
    const phoneOf = async (id: number) =>
      (await userRepo.findOneByOrFail({ id })).phoneNumber;

    const update = (body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post('/user/update')
        .send(body)
        .set('Authorization', `Bearer ${userAToken}`);

    afterAll(async () => {
      await update({ phoneNumber: null });
    });

    it('stores a number sent in E.164', async () => {
      const res = await update({ phoneNumber: '+14155552671' });

      expect(res.status).toBe(201);
      expect(await phoneOf(userAId)).toBe('+14155552671');
    });

    it('rejects a number that is not already E.164', async () => {
      for (const typed of [
        '(415) 555-2671',
        '415.555.2672',
        '4155552671',
        ' +14155552671 ',
      ]) {
        const res = await update({ phoneNumber: typed });

        expect(res.status).toBe(400);
        expect(await phoneOf(userAId)).toBe('+14155552671');
      }
    });

    it('clears the number when null is submitted', async () => {
      expect(await phoneOf(userAId)).toBe('+14155552671');

      const res = await update({
        phoneNumber: null,
        profileDescription: 'saved alongside the cleared number',
      });

      expect(res.status).toBe(201);

      const user = await userRepo.findOneByOrFail({ id: userAId });
      expect(user.phoneNumber).toBeNull();
      expect(user.profileDescription).toBe(
        'saved alongside the cleared number',
      );
    });

    it('rejects an empty string rather than reading it as a clear', async () => {
      await update({ phoneNumber: '+14155552671' });

      for (const blank of ['', '   ']) {
        const res = await update({ phoneNumber: blank });

        expect(res.status).toBe(400);
        expect(await phoneOf(userAId)).toBe('+14155552671');
      }
    });

    it('still rejects a number that is neither null nor parseable', async () => {
      const res = await update({ phoneNumber: '555-12' });

      expect(res.status).toBe(400);
      expect(await phoneOf(userAId)).toBe('+14155552671');
    });

    it('accepts whatever the client turns a typed number into', async () => {
      for (const typed of [
        '(415) 555-2671',
        '415.555.2672',
        '+44 20 7946 0958',
        '+86 138 0013 8000',
      ]) {
        const asSentByClient = R.unwrapOr(toE164(typed), null);
        expect(asSentByClient).not.toBeNull();

        const res = await update({ phoneNumber: asSentByClient });

        expect(res.status).toBe(201);
        expect(await phoneOf(userAId)).toBe(asSentByClient);
      }
    });

    it('rejects a number that is E.164-shaped but cannot exist', async () => {
      await update({ phoneNumber: '+14155552671' });

      for (const wellFormed of ['+18001230000', '+861380013800']) {
        expect(/^\+[1-9]\d{1,14}$/.test(wellFormed)).toBe(true);
        expect(R.isSuccess(toE164(wellFormed))).toBe(false);

        const res = await update({ phoneNumber: wellFormed });

        expect(res.status).toBe(400);
        expect(await phoneOf(userAId)).toBe('+14155552671');
      }
    });

    it('drops a field that is not on the DTO rather than 400ing', async () => {
      const res = await update({
        phoneNumber: '+14155552671',
        phoneNumberValidated: true,
      });

      expect(res.status).toBe(201);
      expect(await phoneOf(userAId)).toBe('+14155552671');
    });

    it('names the expected format when it rejects', async () => {
      const res = await update({ phoneNumber: '(415) 555-2671' });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('E.164');
    });
  });

  describe('profile picture on /user/update', () => {
    const pictureOf = async (id: number) =>
      (await userRepo.findOneByOrFail({ id })).profilePicture;

    const update = (body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post('/user/update')
        .send(body)
        .set('Authorization', `Bearer ${userAToken}`);

    it('stores a key it is given', async () => {
      const res = await update({ profilePicture: 'some/uploaded/key.jpg' });

      expect(res.status).toBe(201);
      expect(await pictureOf(userAId)).toBe('some/uploaded/key.jpg');
    });

    it('stores blank input as null, not as an empty string', async () => {
      for (const blank of ['', '   ']) {
        await update({ profilePicture: 'some/uploaded/key.jpg' });

        const res = await update({ profilePicture: blank });

        expect(res.status).toBe(201);
        expect(await pictureOf(userAId)).toBeNull();
      }
    });

    it('rejects a non-string picture instead of storing it', async () => {
      await update({ profilePicture: 'some/uploaded/key.jpg' });

      const res = await update({ profilePicture: 42 });

      expect(res.status).toBe(400);
      expect(await pictureOf(userAId)).toBe('some/uploaded/key.jpg');
    });

    it('leaves the picture alone when the field is absent', async () => {
      await update({ profilePicture: 'some/uploaded/key.jpg' });

      const res = await update({ profileDescription: 'unrelated edit' });

      expect(res.status).toBe(201);
      expect(await pictureOf(userAId)).toBe('some/uploaded/key.jpg');
    });

    it('serializes a cleared picture as null rather than omitting it', async () => {
      await update({ profilePicture: null });

      const res = await request(ctx.app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('profilePicture');
      expect(res.body.profilePicture).toBeNull();
    });
  });

  describe('blank text fields on /user/update', () => {
    const update = (body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post('/user/update')
        .send(body)
        .set('Authorization', `Bearer ${userAToken}`);

    it.each(['profileDescription', 'customCityString'] as const)(
      'stores blank %s as null, not as an empty string',
      async (field) => {
        for (const blank of ['', '   ']) {
          await update({ [field]: 'something' });

          const res = await update({ [field]: blank });

          expect(res.status).toBe(201);
          expect(
            (await userRepo.findOneByOrFail({ id: userAId }))[field],
          ).toBeNull();
        }
      },
    );
  });

  describe('preferred reminder time on /user/update', () => {
    const reminderTimeOf = async (id: number) =>
      (await userRepo.findOneByOrFail({ id })).preferredReminderTime;

    const update = (body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .post('/user/update')
        .send(body)
        .set('Authorization', `Bearer ${userAToken}`);

    it('stores a time it is given', async () => {
      const res = await update({ preferredReminderTime: '09:30:00' });

      expect(res.status).toBe(201);
      expect(await reminderTimeOf(userAId)).toBe('09:30:00');
    });

    // The settings pages send the raw input value, so clearing the field
    // arrives as a blank string rather than as null.
    it('clears the time on blank input instead of keeping the old one', async () => {
      for (const blank of ['', '   ', null]) {
        await update({ preferredReminderTime: '09:30:00' });

        const res = await update({ preferredReminderTime: blank });

        expect(res.status).toBe(201);
        expect(await reminderTimeOf(userAId)).toBeNull();
      }
    });

    it('leaves the time alone when the field is absent', async () => {
      await update({ preferredReminderTime: '09:30:00' });

      const res = await update({ profileDescription: 'unrelated edit' });

      expect(res.status).toBe(201);
      expect(await reminderTimeOf(userAId)).toBe('09:30:00');
    });

    // The mobile settings screen is a free-text input, so unparseable times are
    // ordinary user input rather than a malformed request.
    it.each(['9am', '25:00', '10:75', '2026-01-01', 42, {}])(
      'rejects %p instead of failing on the write',
      async (invalid) => {
        await update({ preferredReminderTime: '09:30:00' });

        const res = await update({ preferredReminderTime: invalid });

        expect(res.status).toBe(400);
        expect(await reminderTimeOf(userAId)).toBe('09:30:00');
      },
    );

    it.each([
      ['09:30', '09:30:00'],
      ['  09:30  ', '09:30:00'],
      ['9:30', '09:30:00'],
    ])('normalizes %p to %p before storing it', async (input, stored) => {
      await update({ preferredReminderTime: null });

      const res = await update({ preferredReminderTime: input });

      expect(res.status).toBe(201);
      expect(await reminderTimeOf(userAId)).toBe(stored);
    });
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
      relations: { city: true },
    });
    expect(updatedUser?.anonymous).toBe(false);
    expect(updatedUser?.city?.id).toBe(newCity.id);
  });

  it('User A can send a friend request to User B', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/friends/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect([200, 201]).toContain(res.status);

    const status = await request(ctx.app.getHttpServer())
      .get(`/user/myfriendrelationship/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe(FriendStatus.Pending);
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

    const status = await request(ctx.app.getHttpServer())
      .get(`/user/myfriendrelationship/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe(FriendStatus.Accepted);
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

    const status = await request(ctx.app.getHttpServer())
      .get(`/user/myfriendrelationship/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe(FriendStatus.Declined);
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
      .post(`/contract/sign/${ctx.defaultContractId}`)
      .send({ signedName: 'Test Name' })
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    expect(typeof sign.text === 'string' || sign.body).toBeTruthy();

    const suspend = await request(ctx.app.getHttpServer())
      .post('/contract/suspend')
      .set('Authorization', `Bearer ${userAToken}`)
      .expect(201);

    expect(typeof suspend.text === 'string' || suspend.body).toBeTruthy();
  });

  it('counts one-time and reusable invite recruits after they sign the contract', async () => {
    const ambassador = await userRepo.save(
      userRepo.create({
        name: 'Invite Goal Ambassador',
        email: 'invite.goal.ambassador@example.com',
        password: 'Password123!',
        ambassador: true,
      }),
    );
    const invite = await onetimeInviteRepo.save(
      onetimeInviteRepo.create({
        invitee: 'Invite Goal Recruit',
        code: 'INVITE-GOAL-RECRUIT',
        status: OnetimeInviteStatus.LINK_USED,
        invitingUser: ambassador,
      }),
    );
    const recruit = await userRepo.save(
      userRepo.create({
        name: 'Invite Goal Recruit',
        email: 'invite.goal.recruit@example.com',
        password: 'Password123!',
        referredBy: ambassador,
        referredByInvite: invite,
        referralSource: ReferralSource.OnetimeInvite,
      }),
    );
    const reusableInvite = await shareUrlsService.getOrCreateForInvite({
      type: 'user',
      userId: ambassador.id,
    });
    const reusableInviteRecruit = await userRepo.save(
      userRepo.create({
        name: 'Reusable Invite Goal Recruit',
        email: 'reusable.invite.goal.recruit@example.com',
        password: 'Password123!',
        referredBy: ambassador,
        referredByShareUrl: reusableInvite,
        referralSource: ReferralSource.InviteShareLink,
      }),
    );
    const now = new Date();
    const goal = await userService.createAmbassadorInviteGoal(
      {
        targetSuccessfulRecruits: 2,
        startAt: now.toISOString(),
        dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
      ambassador.id,
    );

    const beforeSigning = await userService.getAmbassadorInviteDashboard(
      ambassador.id,
    );
    expect(beforeSigning.stats.totalSuccessfulRecruits).toBe(0);
    expect(
      beforeSigning.goals.find(
        ({ goal: resultGoal }) => resultGoal.id === goal.id,
      )?.stats.goalSuccessfulRecruits,
    ).toBe(0);

    await contractService.signContract({
      userId: recruit.id,
      signedName: recruit.name,
      contractId: ctx.defaultContractId,
    });
    await contractService.signContract({
      userId: reusableInviteRecruit.id,
      signedName: reusableInviteRecruit.name,
      contractId: ctx.defaultContractId,
    });

    const afterSigning = await userService.getAmbassadorInviteDashboard(
      ambassador.id,
    );
    expect(afterSigning.stats.totalSuccessfulRecruits).toBe(2);
    expect(
      afterSigning.goals.find(
        ({ goal: resultGoal }) => resultGoal.id === goal.id,
      )?.stats.goalSuccessfulRecruits,
    ).toBe(2);
  });

  describe('signContract behavior', () => {
    /** Signs up through a reusable invite link the way production does, so the
     * invite assignment snapshot on the user is written by real code. */
    const signUpThroughInvite = async (params: {
      name: string;
      email: string;
      invite: ShareUrl;
    }): Promise<User> => {
      const { sid } = params.invite;
      if (!sid) {
        throw new Error('invite link is missing its sid');
      }
      return authService.register({
        name: params.name,
        email: params.email,
        password: 'Password123!',
        mode: 'header',
        referralCode: sid,
      });
    };

    it('joins community from referredByInvite when signing contract for first time', async () => {
      // Create a new user with an invite
      const inviter = await userRepo.save(
        userRepo.create({
          name: 'Contract Inviter',
          email: 'contract.inviter@example.com',
          password: 'Password123!',
        }),
      );

      const inviteCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Invite Community',
          description: 'Community from invite',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );

      const invite = await onetimeInviteRepo.save(
        onetimeInviteRepo.create({
          invitee: 'contract.invited@example.com',
          code: 'CONTRACT-INVITE-CODE',
          status: OnetimeInviteStatus.LINK_UNUSED,
          invitingUser: inviter,
          community: inviteCommunity,
        }),
      );

      // Create user via signup (simulating the new flow)
      const newUser = await userRepo.save(
        userRepo.create({
          name: 'Contract Invited User',
          email: 'contract.invited@example.com',
          password: 'Password123!',
          referredBy: inviter,
          referredByInvite: invite,
          referralSource: ReferralSource.OnetimeInvite,
        }),
      );

      // Sign contract
      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      // Verify user joined the community
      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });

      expect(
        updatedUser?.communities.some((c) => c.id === inviteCommunity.id),
      ).toBe(true);

      // Verify notifications were sent to community leaders
      const notifRepo = ctx.dataSource.getRepository(Notification);
      const notifs = await notifRepo.find({
        where: { user: { id: inviter.id } },
      });

      expect(notifs.length).toBeGreaterThan(0);
      expect(
        notifs.some(
          (n) =>
            n.category === NotificationCategory.NewMemberReferred ||
            n.message.includes('joined the Alliance'),
        ),
      ).toBe(true);
    });

    it('joins the community selected by a reusable invite link', async () => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: 'Reusable Contract Inviter',
          email: 'reusable.contract.inviter@example.com',
          password: 'Password123!',
        }),
      );
      const inviteCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Reusable Invite Community',
          description: 'Community from reusable invite',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Reusable community invite',
          inviteCommunity.id,
        );
      const newUser = await signUpThroughInvite({
        name: 'Reusable Contract Invitee',
        email: 'reusable.contract.invitee@example.com',
        invite: reusableInvite,
      });
      expect(newUser.inviteAssignmentKind).toBe(
        StoredInviteAssignmentKind.Community,
      );
      expect(newUser.inviteAssignmentCommunityId).toBe(inviteCommunity.id);

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(
        updatedUser?.communities.some(
          (community) => community.id === inviteCommunity.id,
        ),
      ).toBe(true);
    });

    it('keeps the selected community after the reusable invite link is deleted', async () => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: 'Deleted Link Inviter',
          email: 'deleted.link.inviter@example.com',
          password: 'Password123!',
        }),
      );
      const inviteCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Deleted Link Community',
          description: 'Destination of a since-deleted invite link',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Since-deleted community invite',
          inviteCommunity.id,
        );
      const newUser = await signUpThroughInvite({
        name: 'Deleted Link Invitee',
        email: 'deleted.link.invitee@example.com',
        invite: reusableInvite,
      });

      await shareUrlsService.deleteInviteForUser(reusableInvite.id, inviter.id);

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true, referredByShareUrl: true },
      });
      expect(updatedUser?.referredByShareUrl).toBeNull();
      expect(
        updatedUser?.communities.some(
          (community) => community.id === inviteCommunity.id,
        ),
      ).toBe(true);
    });

    /**
     * An inviter who leads a second group with room, so a fallback placement
     * would be visible: these tests assert the deleted destination queues the
     * member for manual assignment rather than silently landing them there.
     */
    const inviterWithSpareGroup = async (params: {
      slug: string;
      name: string;
    }): Promise<{ inviter: User; doomed: Community; spare: Community }> => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: `${params.name} Inviter`,
          email: `${params.slug}.inviter@example.com`,
          password: 'Password123!',
        }),
      );
      const doomed = await communityRepo.save(
        communityRepo.create({
          name: `${params.name} Destination`,
          description: 'Named by the invite link, then deleted',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const spare = await communityRepo.save(
        communityRepo.create({
          name: `${params.name} Spare`,
          description: 'Has room, but the invite never named it',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      return { inviter, doomed, spare };
    };

    it('queues assignment when the reusable invite group was deleted before signup', async () => {
      const { inviter, doomed } = await inviterWithSpareGroup({
        slug: 'deleted.group',
        name: 'Deleted Group',
      });
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Doomed community invite',
          doomed.id,
        );
      await communityRepo.delete(doomed.id);

      const newUser = await signUpThroughInvite({
        name: 'Deleted Group Invitee',
        email: 'deleted.group.invitee@example.com',
        invite: reusableInvite,
      });
      expect(newUser.inviteAssignmentKind).toBe(
        StoredInviteAssignmentKind.Community,
      );
      expect(newUser.inviteAssignmentCommunityId).toBeNull();

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(updatedUser?.communities).toHaveLength(0);
      expect(updatedUser?.undergoingGroupAssignment).toBe(true);
    });

    it('queues assignment when the reusable invite group is deleted after signup', async () => {
      const { inviter, doomed } = await inviterWithSpareGroup({
        slug: 'later.deleted.group',
        name: 'Later Deleted Group',
      });
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Later-deleted community invite',
          doomed.id,
        );
      const newUser = await signUpThroughInvite({
        name: 'Later Deleted Group Invitee',
        email: 'later.deleted.group.invitee@example.com',
        invite: reusableInvite,
      });
      expect(newUser.inviteAssignmentCommunityId).toBe(doomed.id);

      await communityRepo.delete(doomed.id);

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(updatedUser?.inviteAssignmentKind).toBe(
        StoredInviteAssignmentKind.Community,
      );
      expect(updatedUser?.inviteAssignmentCommunityId).toBeNull();
      expect(updatedUser?.communities).toHaveLength(0);
      expect(updatedUser?.undergoingGroupAssignment).toBe(true);
    });

    it('recovers when the reusable invite group is deleted mid-signup', async () => {
      const { inviter, doomed } = await inviterWithSpareGroup({
        slug: 'raced.deleted.group',
        name: 'Raced Deleted Group',
      });
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Raced community invite',
          doomed.id,
        );
      await communityRepo.delete(doomed.id);
      // Stands in for the group being deleted after the snapshot's existence
      // check passed but before the insert: the stale id trips the foreign key.
      const staleSnapshot = jest
        .spyOn(userService, 'inviteAssignmentSnapshot')
        .mockResolvedValueOnce({
          inviteAssignmentKind: StoredInviteAssignmentKind.Community,
          inviteAssignmentCommunityId: doomed.id,
        });

      let newUser: User;
      let snapshotCalls = 0;
      try {
        newUser = await signUpThroughInvite({
          name: 'Raced Deleted Group Invitee',
          email: 'raced.deleted.group.invitee@example.com',
          invite: reusableInvite,
        });
      } finally {
        snapshotCalls = staleSnapshot.mock.calls.length;
        staleSnapshot.mockRestore();
      }

      // Without this the real check would return a null id and the assertions
      // below would pass without the recovery path ever running.
      expect(snapshotCalls).toBe(1);
      expect(newUser.inviteAssignmentKind).toBe(
        StoredInviteAssignmentKind.Community,
      );
      expect(newUser.inviteAssignmentCommunityId).toBeNull();

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(updatedUser?.communities).toHaveLength(0);
      expect(updatedUser?.undergoingGroupAssignment).toBe(true);
    });

    /**
     * Capacity bounds the members a leader receives *without* asking for them.
     * Naming a group on an invite link is asking, so it overrides the cap.
     */
    it('places into a reusable invite destination that is already full', async () => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: 'Full Reusable Inviter',
          email: 'full.reusable.inviter@example.com',
          password: 'Password123!',
        }),
      );
      const existingMember = await userRepo.save(
        userRepo.create({
          name: 'Full Reusable Existing Member',
          email: 'full.reusable.member@example.com',
          password: 'Password123!',
        }),
      );
      const fullCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Full Reusable Invite Community',
          description: 'Full reusable invite destination',
          leaders: [inviter],
          users: [inviter, existingMember],
          maxCapacity: 1,
        }),
      );
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Full reusable community invite',
          fullCommunity.id,
        );
      const newUser = await signUpThroughInvite({
        name: 'Full Reusable Invitee',
        email: 'full.reusable.invitee@example.com',
        invite: reusableInvite,
      });

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(
        updatedUser?.communities.some(
          (community) => community.id === fullCommunity.id,
        ),
      ).toBe(true);
      expect(updatedUser?.undergoingGroupAssignment).toBe(false);
    });

    it('joins an uncapped community selected by a reusable invite link', async () => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: 'Uncapped Reusable Inviter',
          email: 'uncapped.reusable.inviter@example.com',
          password: 'Password123!',
        }),
      );
      // maxCapacity may only be null while the group is private and takes
      // neither member invites nor staff assignments.
      const uncappedCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Uncapped Reusable Invite Community',
          description: 'Reusable invite destination with no member cap',
          leaders: [inviter],
          users: [inviter],
          public: false,
          allowMemberInvites: false,
          allowStaffAssignments: false,
          maxCapacity: null,
        }),
      );
      const reusableInvite =
        await shareUrlsService.createDuplicateInviteForUser(
          inviter.id,
          'Uncapped community invite',
          uncappedCommunity.id,
        );
      const newUser = await signUpThroughInvite({
        name: 'Uncapped Reusable Invitee',
        email: 'uncapped.reusable.invitee@example.com',
        invite: reusableInvite,
      });

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      expect(
        updatedUser?.communities.some(
          (community) => community.id === uncappedCommunity.id,
        ),
      ).toBe(true);
      expect(updatedUser?.undergoingGroupAssignment).toBe(false);
    });

    /**
     * An inviter who leads one group and is a plain member of another, both
     * with room. The legacy placement picks the led group and an `open`
     * assignment picks the other, so each test can prove which one ran.
     */
    const inviterLeadingAndJoining = async (params: {
      slug: string;
      name: string;
    }): Promise<{ inviter: User; led: Community; joined: Community }> => {
      const inviter = await userRepo.save(
        userRepo.create({
          name: `${params.name} Inviter`,
          email: `${params.slug}.inviter@example.com`,
          password: 'Password123!',
        }),
      );
      const otherLeader = await userRepo.save(
        userRepo.create({
          name: `${params.name} Other Leader`,
          email: `${params.slug}.other.leader@example.com`,
          password: 'Password123!',
        }),
      );
      const led = await communityRepo.save(
        communityRepo.create({
          name: `${params.name} Led`,
          description: 'Led by the inviter',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const joined = await communityRepo.save(
        communityRepo.create({
          name: `${params.name} Joined`,
          description: 'The inviter is a member here, not a leader',
          leaders: [otherLeader],
          users: [otherLeader, inviter],
          maxCapacity: 10,
        }),
      );
      return { inviter, led, joined };
    };

    it('keeps legacy placement for invite links that predate group selection', async () => {
      const { inviter, led, joined } = await inviterLeadingAndJoining({
        slug: 'legacy.invite.link',
        name: 'Legacy Invite Link',
      });
      // Carries no stored assignment, like every link made before this feature.
      const legacyInvite = await shareUrlsService.getOrCreateForInvite({
        type: 'user',
        userId: inviter.id,
      });
      const newUser = await signUpThroughInvite({
        name: 'Legacy Invite Link Invitee',
        email: 'legacy.invite.link.invitee@example.com',
        invite: legacyInvite,
      });
      expect(newUser.referralSource).toBe(ReferralSource.InviteShareLink);
      expect(newUser.inviteAssignmentKind).toBeNull();

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      const communityIds = (updatedUser?.communities ?? []).map(
        (community) => community.id,
      );
      expect(communityIds).toContain(led.id);
      expect(communityIds).not.toContain(joined.id);
    });

    it('places an "any open group" invite outside the groups the inviter leads', async () => {
      const { inviter, led, joined } = await inviterLeadingAndJoining({
        slug: 'open.invite.link',
        name: 'Open Invite Link',
      });
      const openInvite = await shareUrlsService.createDuplicateInviteForUser(
        inviter.id,
        'Any open group invite',
        null,
      );
      const newUser = await signUpThroughInvite({
        name: 'Open Invite Link Invitee',
        email: 'open.invite.link.invitee@example.com',
        invite: openInvite,
      });
      expect(newUser.inviteAssignmentKind).toBe(
        StoredInviteAssignmentKind.Open,
      );

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });
      const communityIds = (updatedUser?.communities ?? []).map(
        (community) => community.id,
      );
      expect(communityIds).toContain(joined.id);
      expect(communityIds).not.toContain(led.id);
    });

    it('joins community from referredBy when no invite community exists', async () => {
      const referrer = await userRepo.save(
        userRepo.create({
          name: 'Contract Referrer',
          email: 'contract.referrer@example.com',
          password: 'Password123!',
        }),
      );

      // Create a community that the referrer is a member of (but not leader)
      const otherLeader = await userRepo.save(
        userRepo.create({
          name: 'Other Leader',
          email: 'other.leader@example.com',
          password: 'Password123!',
        }),
      );

      const referrerCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Referrer Community',
          description: 'Community for referrer',
          leaders: [otherLeader],
          users: [referrer, otherLeader],
          maxCapacity: 10,
          allowMemberInvites: true,
        }),
      );

      // Create user with referredBy but no invite (OnetimeInvite = join adjacent community; referrer is member but not leader)
      const newUser = await userRepo.save(
        userRepo.create({
          name: 'Referred User',
          email: 'referred.user@example.com',
          password: 'Password123!',
          referredBy: referrer,
          referralSource: ReferralSource.OnetimeInvite,
        }),
      );

      // Sign contract
      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      // Verify user joined the community
      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
        relations: { communities: true },
      });

      expect(
        updatedUser?.communities.some((c) => c.id === referrerCommunity.id),
      ).toBe(true);
    });

    it('sets undergoingGroupAssignment when no community available for referredBy', async () => {
      const referrer = await userRepo.save(
        userRepo.create({
          name: 'No Community Referrer',
          email: 'no.community.referrer@example.com',
          password: 'Password123!',
        }),
      );

      const newUser = await userRepo.save(
        userRepo.create({
          name: 'No Community User',
          email: 'no.community.user@example.com',
          password: 'Password123!',
          referredBy: referrer,
          referralSource: ReferralSource.ReferralLink,
        }),
      );

      await contractService.signContract({
        userId: newUser.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: newUser.id },
      });

      expect(updatedUser?.undergoingGroupAssignment).toBe(true);
    });

    it('joins pendingCommunity on non-first contract signing if capacity allows', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Pending Community Leader',
          email: 'pending.leader@example.com',
          password: 'Password123!',
        }),
      );

      const pendingComm = await communityRepo.save(
        communityRepo.create({
          name: 'Pending Community',
          description: 'Pending',
          leaders: [leader],
          users: [leader],
          maxCapacity: 5,
        }),
      );

      // Create user and sign contract once
      const user = await userRepo.save(
        userRepo.create({
          name: 'Pending User',
          email: 'pending.user@example.com',
          password: 'Password123!',
        }),
      );

      await contractService.signContract({
        userId: user.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      // Suspend contract (this should set pendingCommunity)
      await contractService.suspendContract({ userId: user.id });

      // Set pendingCommunity manually to simulate the suspend flow
      const userWithPending = await userRepo.findOne({
        where: { id: user.id },
        relations: { pendingCommunity: true },
      });
      if (userWithPending) {
        userWithPending.pendingCommunity = pendingComm;
        await userRepo.save(userWithPending);
      }

      // Sign contract again
      await contractService.signContract({
        userId: user.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: user.id },
        relations: { communities: true, pendingCommunity: true },
      });

      expect(
        updatedUser?.communities.some((c) => c.id === pendingComm.id),
      ).toBe(true);
      expect(updatedUser?.pendingCommunity).toBeNull();
    });

    it('queues for assignment when the pendingCommunity filled the seat', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Full Community Leader',
          email: 'full.leader@example.com',
          password: 'Password123!',
        }),
      );

      const members = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          userRepo.save(
            userRepo.create({
              name: `Member ${i}`,
              email: `member${i}@example.com`,
              password: 'Password123!',
            }),
          ),
        ),
      );

      const fullComm = await communityRepo.save(
        communityRepo.create({
          name: 'Full Community',
          description: 'Full',
          leaders: [leader],
          users: [leader, ...members],
          maxCapacity: 5, // At capacity (1 leader + 5 members, cap counts non-leaders)
        }),
      );

      const user = await userRepo.save(
        userRepo.create({
          name: 'Full Community User',
          email: 'full.user@example.com',
          password: 'Password123!',
        }),
      );

      await contractService.signContract({
        userId: user.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });
      await contractService.suspendContract({ userId: user.id });

      // Stand in for the suspend flow, and clear the queue flag the first
      // signing set so the assertion below can only come from the re-signing.
      await userRepo.save({
        id: user.id,
        pendingCommunity: fullComm,
        undergoingGroupAssignment: false,
      });

      await contractService.signContract({
        userId: user.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      const updatedUser = await userRepo.findOne({
        where: { id: user.id },
        relations: { communities: true, pendingCommunity: true },
      });

      expect(updatedUser?.communities.some((c) => c.id === fullComm.id)).toBe(
        false,
      );
      expect(updatedUser?.pendingCommunity).toBeNull();
      // Their seat is gone, so they must land in the manual queue rather than
      // in no group at all.
      expect(updatedUser?.undergoingGroupAssignment).toBe(true);
    });
  });

  describe('suspendContract behavior', () => {
    it('removes user from communities they are not a leader of', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Suspension Leader',
          email: 'suspension.leader@example.com',
          password: 'Password123!',
        }),
      );

      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Suspension Community',
          description: 'For suspension test',
          leaders: [leader],
          users: [leader],
        }),
      );

      const member = await userRepo.save(
        userRepo.create({
          name: 'Suspension Member',
          email: 'suspension.member@example.com',
          password: 'Password123!',
          communities: [community],
        }),
      );

      // Sign contract first
      await contractService.signContract({
        userId: member.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      // Suspend contract
      await contractService.suspendContract({ userId: member.id });

      const updatedMember = await userRepo.findOne({
        where: { id: member.id },
        relations: { communities: true, pendingCommunity: true },
      });

      // Should be removed from community
      expect(
        updatedMember?.communities.some((c) => c.id === community.id),
      ).toBe(false);
      // Should have pendingCommunity set
      expect(updatedMember?.pendingCommunity?.id).toBe(community.id);
    });

    it('does not remove user from communities they lead', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Leader Suspension',
          email: 'leader.suspension@example.com',
          password: 'Password123!',
        }),
      );

      const ownCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Own Community',
          description: 'Owned by leader',
          leaders: [leader],
          users: [leader],
        }),
      );

      // Sign contract
      await contractService.signContract({
        userId: leader.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });

      // Suspend contract
      await contractService.suspendContract({ userId: leader.id });

      const updatedLeader = await userRepo.findOne({
        where: { id: leader.id },
        relations: { communities: true, leaderOf: true },
      });

      // Should still be in their own community
      expect(
        updatedLeader?.communities.some((c) => c.id === ownCommunity.id),
      ).toBe(true);
      expect(
        updatedLeader?.leaderOf.some((c) => c.id === ownCommunity.id),
      ).toBe(true);
    });

    it('sends notifications to community leaders when user is removed', async () => {
      const leader1 = await userRepo.save(
        userRepo.create({
          name: 'Notification Leader 1',
          email: 'notif.leader1@example.com',
          password: 'Password123!',
        }),
      );

      const leader2 = await userRepo.save(
        userRepo.create({
          name: 'Notification Leader 2',
          email: 'notif.leader2@example.com',
          password: 'Password123!',
        }),
      );

      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Notification Community',
          description: 'For notifications',
          leaders: [leader1, leader2],
          users: [leader1, leader2],
        }),
      );

      const member = await userRepo.save(
        userRepo.create({
          name: 'Notification Member',
          email: 'notif.member@example.com',
          password: 'Password123!',
          communities: [community],
        }),
      );

      await contractService.signContract({
        userId: member.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });
      await contractService.suspendContract({ userId: member.id });

      const notifRepo = ctx.dataSource.getRepository(Notification);
      const leader1Notifs = await notifRepo.find({
        where: { user: { id: leader1.id } },
      });

      const leader2Notifs = await notifRepo.find({
        where: { user: { id: leader2.id } },
      });

      expect(
        leader1Notifs.some(
          (n) =>
            n.category ===
              NotificationCategory.MemberSuspendedRemovedFromCommunity &&
            n.message.includes('suspended their contract'),
        ),
      ).toBe(true);

      expect(
        leader2Notifs.some(
          (n) =>
            n.category ===
              NotificationCategory.MemberSuspendedRemovedFromCommunity &&
            n.message.includes('suspended their contract'),
        ),
      ).toBe(true);
    });

    it('sets pendingCommunity to one of the removed communities', async () => {
      const leader1 = await userRepo.save(
        userRepo.create({
          name: 'Pending Leader 1',
          email: 'pending.leader1@example.com',
          password: 'Password123!',
        }),
      );

      const leader2 = await userRepo.save(
        userRepo.create({
          name: 'Pending Leader 2',
          email: 'pending.leader2@example.com',
          password: 'Password123!',
        }),
      );

      const comm1 = await communityRepo.save(
        communityRepo.create({
          name: 'Community 1',
          description: 'First',
          leaders: [leader1],
          users: [leader1],
        }),
      );

      const comm2 = await communityRepo.save(
        communityRepo.create({
          name: 'Community 2',
          description: 'Second',
          leaders: [leader2],
          users: [leader2],
        }),
      );

      const member = await userRepo.save(
        userRepo.create({
          name: 'Multi Community Member',
          email: 'multi.member@example.com',
          password: 'Password123!',
          communities: [comm1, comm2],
        }),
      );

      await contractService.signContract({
        userId: member.id,
        signedName: 'Test Name',
        contractId: ctx.defaultContractId,
      });
      await contractService.suspendContract({ userId: member.id });

      const updatedMember = await userRepo.findOne({
        where: { id: member.id },
        relations: { pendingCommunity: true },
      });

      // Should have one of the communities as pendingCommunity
      expect(updatedMember?.pendingCommunity).not.toBeNull();
      expect(
        [comm1.id, comm2.id].includes(updatedMember?.pendingCommunity?.id ?? 0),
      ).toBe(true);
    });
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
    describe('onetime invite workflows', () => {
      const createPendingInviteRequest = async (
        overrides: {
          token?: string;
          invitee?: string;
          inviteeDescription?: string;
          communityId?: number;
        } = {},
      ) => {
        const res = await request(ctx.app.getHttpServer())
          .post('/user/onetimeInvite/request')
          .set(
            'Authorization',
            `Bearer ${overrides.token ?? communityMemberToken}`,
          )
          .send({
            invitee:
              overrides.invitee ??
              `pending-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
            inviteeDescription:
              overrides.inviteeDescription ?? 'Pending invite request',
            communityId: overrides.communityId ?? communityLedByUserA.id,
          });

        expect(res.status).toBe(201);
        return res.body;
      };

      describe('createOnetimeInvite', () => {
        it('rejects requests for communities the user does not lead', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              invitee: 'outsider@example.com',
              communityId: communityLedByUserB.id,
            });

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('leader of community');
        });

        it('ignores provided invitingUserId for non-admins and uses the authenticated user', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              invitingUserId: userBId,
              invitee: 'mismatch@example.com',
              communityId: communityLedByUserA.id,
            });

          expect(res.status).toBe(201);
          expect(res.body.invitingUser.id).toBe(userAId);
        });

        it('creates invites for communities led by the requester', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              invitingUserId: userAId,
              invitee: 'leader@example.com',
              communityId: communityLedByUserA.id,
            });

          expect(res.status).toBe(201);
          expect(res.body.community.id).toBe(communityLedByUserA.id);
          expect(res.body.status).toBe(OnetimeInviteStatus.LINK_UNUSED);
        });

        it('allows admins to create onetime invites for any community', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
            .send({
              invitingUserId: ctx.adminUserId,
              invitee: 'admin-community@example.com',
              communityId: communityLedByUserB.id,
            });

          expect(res.status).toBe(201);
          expect(res.body.community.id).toBe(communityLedByUserB.id);
          expect(res.body.invitingUser.id).toBe(ctx.adminUserId);
          expect(res.body.status).toBe(OnetimeInviteStatus.LINK_UNUSED);
        });

        it('allows admins to create onetime invites on behalf of another user without specifying a community', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
            .send({
              invitingUserId: userAId,
              invitee: 'admin-onbehalf@example.com',
            });

          expect(res.status).toBe(201);
          expect(res.body.community).toBeUndefined();
          expect(res.body.invitingUser.id).toBe(userAId);
          expect(res.body.status).toBe(OnetimeInviteStatus.LINK_UNUSED);
        });

        it('returns not found when admins reference communities that do not exist', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
            .send({
              invitingUserId: ctx.adminUserId,
              invitee: 'missing-community@example.com',
              communityId: 999999,
            });

          expect(res.ok).toBeFalsy();
        });
      });

      describe('updateOnetimeInvite', () => {
        const createInvite = async (communityId?: number) => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/create')
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              invitee: `editable-${Math.random().toString(36).slice(2)}`,
              ...(communityId !== undefined && { communityId }),
            })
            .expect(201);
          return res.body;
        };

        const patch = (inviteId: number, body: Record<string, unknown>) =>
          request(ctx.app.getHttpServer())
            .patch(`/user/onetimeInvites/${inviteId}`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send(body);

        it('renames the invitee', async () => {
          const invite = await createInvite(communityLedByUserA.id);

          const res = await patch(invite.id, {
            invitee: '  Renamed Invitee  ',
          }).expect(200);

          expect(res.body.invitee).toBe('Renamed Invitee');
          expect(res.body.community.id).toBe(communityLedByUserA.id);
        });

        it('clears the group so the invitee is placed like any referral', async () => {
          const invite = await createInvite(communityLedByUserA.id);

          const res = await patch(invite.id, { communityId: null }).expect(200);

          expect(res.body.community ?? null).toBeNull();
        });

        it('refuses a group the inviter does not lead', async () => {
          const invite = await createInvite(communityLedByUserA.id);

          await patch(invite.id, {
            communityId: communityLedByUserB.id,
          }).expect(400);
        });

        it('refuses an empty invitee name', async () => {
          const invite = await createInvite(communityLedByUserA.id);

          await patch(invite.id, { invitee: '   ' }).expect(400);
        });

        it("refuses to edit someone else's invite", async () => {
          const invite = await createInvite(communityLedByUserA.id);

          await request(ctx.app.getHttpServer())
            .patch(`/user/onetimeInvites/${invite.id}`)
            .set('Authorization', `Bearer ${userBToken}`)
            .send({ invitee: 'Hijacked' })
            .expect(400);
        });

        it('refuses once the invite has been used', async () => {
          const invite = await createInvite(communityLedByUserA.id);
          await onetimeInviteRepo.update(invite.id, {
            status: OnetimeInviteStatus.LINK_USED,
          });

          await patch(invite.id, { invitee: 'Too late' }).expect(400);
        });
      });

      describe('requestOnetimeInvite', () => {
        it('rejects requests from users that are not members of the community', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/request')
            .set('Authorization', `Bearer ${userBToken}`)
            .send({
              invitee: 'nonmember@example.com',
              inviteeDescription: 'Trying to request as an outsider',
              communityId: communityLedByUserA.id,
            });

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('not a member');
        });

        it('creates a pending request when a community member submits it', async () => {
          const res = await request(ctx.app.getHttpServer())
            .post('/user/onetimeInvite/request')
            .set('Authorization', `Bearer ${communityMemberToken}`)
            .send({
              invitee: 'member-request@example.com',
              inviteeDescription: 'Member request for manual review',
              communityId: communityLedByUserA.id,
            });

          expect(res.status).toBe(201);
          expect(res.body.status).toBe(OnetimeInviteStatus.REQUEST_PENDING);
          expect(res.body.community.id).toBe(communityLedByUserA.id);
          expect(res.body.invitingUser.id).toBe(communityMemberId);
          expect(res.body.inviteeDescription).toBe(
            'Member request for manual review',
          );
        });
      });

      describe('approveOnetimeInvite', () => {
        it('allows community leaders to approve pending requests', async () => {
          const pendingInvite = await createPendingInviteRequest();

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/approve`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send();

          expect(res.status).toBe(201);
          expect(res.body.id).toBe(pendingInvite.id);
          expect(res.body.status).toBe(OnetimeInviteStatus.LINK_UNUSED);
          expect(res.body.invitingUser.id).toBe(communityMemberId);
        });

        it('rejects approval attempts from non-leaders', async () => {
          const pendingInvite = await createPendingInviteRequest();

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/approve`)
            .set('Authorization', `Bearer ${communityMemberToken}`)
            .send();

          expect(res.status).toBe(401);
        });

        it('rejects approval attempts from leaders of other communities', async () => {
          const pendingInvite = await createPendingInviteRequest();

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/approve`)
            .set('Authorization', `Bearer ${userBToken}`)
            .send();

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('not a leader');
        });
      });

      describe('rejectOnetimeInvite', () => {
        it('allows community leaders to reject pending requests', async () => {
          const pendingInvite = await createPendingInviteRequest();

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/reject`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send();

          expect(res.status).toBe(201);
          const refreshed = await onetimeInviteRepo.findOne({
            where: { id: pendingInvite.id },
          });
          expect(refreshed?.status).toBe(OnetimeInviteStatus.REQUEST_REJECTED);
        });

        it('rejects rejection attempts from leaders of other communities', async () => {
          const pendingInvite = await createPendingInviteRequest();

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/reject`)
            .set('Authorization', `Bearer ${userBToken}`)
            .send();

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('not a leader');
        });

        it('prevents processing an invite that has already been approved', async () => {
          const pendingInvite = await createPendingInviteRequest();

          await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/approve`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send()
            .expect(201);

          const res = await request(ctx.app.getHttpServer())
            .post(`/user/onetimeInvite/${pendingInvite.id}/reject`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send();

          expect(res.status).toBe(400);
          expect(res.body.message).toContain(
            'Invite is not a pending request.',
          );
        });
      });
    });
  });

  describe('assignGroupsAdmin', () => {
    it('persists all users when multiple are assigned to the same community', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Batch Leader',
          email: 'batch.leader@example.com',
          password: 'Password123!',
        }),
      );

      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Batch Community',
          description: 'For batch assignment test',
          leaders: [leader],
          users: [leader],
          maxCapacity: 10,
        }),
      );

      // Create two users undergoing group assignment
      const batchUser1 = await userRepo.save(
        userRepo.create({
          name: 'Batch User 1',
          email: 'batch.user1@example.com',
          password: 'Password123!',
          undergoingGroupAssignment: true,
        }),
      );

      const batchUser2 = await userRepo.save(
        userRepo.create({
          name: 'Batch User 2',
          email: 'batch.user2@example.com',
          password: 'Password123!',
          undergoingGroupAssignment: true,
        }),
      );
      // The assignment queue only ever holds people who have signed.
      await Promise.all([
        giveActiveContract(ctx, batchUser1.id),
        giveActiveContract(ctx, batchUser2.id),
      ]);

      // Assign both users to the same community in a single call
      const res = await request(ctx.app.getHttpServer())
        .post('/user/groupAssignment/assign')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          assignments: [
            { userId: batchUser1.id, communityId: community.id },
            { userId: batchUser2.id, communityId: community.id },
          ],
        });

      expect(res.status).toBe(201);

      // Verify both users are in the community
      const updatedCommunity = await communityRepo.findOneOrFail({
        where: { id: community.id },
        relations: { users: true },
      });

      const memberIds = updatedCommunity.users.map((u) => u.id);
      expect(memberIds).toContain(batchUser1.id);
      expect(memberIds).toContain(batchUser2.id);
      expect(memberIds).toContain(leader.id);
    });

    it('refuses a group that has opted out of staff assignments', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Opted Out Leader',
          email: 'optedout.leader@example.com',
          password: 'Password123!',
        }),
      );
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Opted Out Community',
          description: 'Leader turned off staff assignments',
          leaders: [leader],
          users: [leader],
          public: false,
          allowMemberInvites: true,
          allowStaffAssignments: false,
          maxCapacity: 10,
        }),
      );
      const pending = await userRepo.save(
        userRepo.create({
          name: 'Opted Out Assignee',
          email: 'optedout.assignee@example.com',
          password: 'Password123!',
          undergoingGroupAssignment: true,
        }),
      );

      const res = await request(ctx.app.getHttpServer())
        .post('/user/groupAssignment/assign')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          assignments: [{ userId: pending.id, communityId: community.id }],
        });

      expect(res.status).toBe(400);

      const updated = await userRepo.findOneOrFail({
        where: { id: pending.id },
        relations: { communities: true },
      });
      expect(updated.communities).toHaveLength(0);
      expect(updated.undergoingGroupAssignment).toBe(true);
    });

    it('assigns nobody when one member of the batch has no active contract', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Atomic Leader',
          email: 'atomic.leader@example.com',
          password: 'Password123!',
        }),
      );
      const destination = await communityRepo.save(
        communityRepo.create({
          name: 'Atomic Destination',
          description: 'Where the batch was headed',
          leaders: [leader],
          users: [leader],
          maxCapacity: 10,
        }),
      );
      // The valid member is assigned first, so an unvalidated batch would move
      // them out of here before it reached the one it has to refuse.
      const origin = await communityRepo.save(
        communityRepo.create({
          name: 'Atomic Origin',
          description: 'The group the valid member starts in',
          leaders: [leader],
          users: [leader],
          maxCapacity: 10,
        }),
      );
      const signed = await userRepo.save(
        userRepo.create({
          name: 'Atomic Signed',
          email: 'atomic.signed@example.com',
          password: 'Password123!',
          undergoingGroupAssignment: true,
          communities: [origin],
        }),
      );
      // Queued, then their contract lapsed — nothing dequeues them.
      const lapsed = await userRepo.save(
        userRepo.create({
          name: 'Atomic Lapsed',
          email: 'atomic.lapsed@example.com',
          password: 'Password123!',
          undergoingGroupAssignment: true,
        }),
      );
      await giveActiveContract(ctx, signed.id);

      const res = await request(ctx.app.getHttpServer())
        .post('/user/groupAssignment/assign')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          assignments: [
            { userId: signed.id, communityId: destination.id },
            { userId: lapsed.id, communityId: destination.id },
          ],
        });

      expect(res.status).toBe(400);

      const [updatedSigned, updatedLapsed] = await Promise.all([
        userRepo.findOneOrFail({
          where: { id: signed.id },
          relations: { communities: true },
        }),
        userRepo.findOneOrFail({
          where: { id: lapsed.id },
          relations: { communities: true },
        }),
      ]);
      // Untouched: still in the group they started in, still queued.
      expect(updatedSigned.communities.map((c) => c.id)).toEqual([origin.id]);
      expect(updatedSigned.undergoingGroupAssignment).toBe(true);
      expect(updatedLapsed.communities).toHaveLength(0);
      expect(updatedLapsed.undergoingGroupAssignment).toBe(true);
    });

    it('correctly reassigns a user to a community they were previously removed from', async () => {
      const leader = await userRepo.save(
        userRepo.create({
          name: 'Reassign Leader',
          email: 'reassign.leader@example.com',
          password: 'Password123!',
        }),
      );

      const oldCommunity = await communityRepo.save(
        communityRepo.create({
          name: 'Old Community',
          description: 'Community user starts in',
          leaders: [leader],
          users: [leader],
          maxCapacity: 10,
        }),
      );

      // User starts as a member of oldCommunity
      const reassignUser = await userRepo.save(
        userRepo.create({
          name: 'Reassign User',
          email: 'reassign.user@example.com',
          password: 'Password123!',
          communities: [oldCommunity],
          undergoingGroupAssignment: true,
        }),
      );
      await giveActiveContract(ctx, reassignUser.id);

      // Assign the user back to the same community they're already in
      // (this simulates the flow where the user is removed from old communities
      // then added to the target, which happens to be the same community)
      const res = await request(ctx.app.getHttpServer())
        .post('/user/groupAssignment/assign')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          assignments: [
            { userId: reassignUser.id, communityId: oldCommunity.id },
          ],
        });

      expect(res.status).toBe(201);

      // Verify the user is a member of the community
      const updatedCommunity = await communityRepo.findOneOrFail({
        where: { id: oldCommunity.id },
        relations: { users: true },
      });

      const memberIds = updatedCommunity.users.map((u) => u.id);
      expect(memberIds).toContain(reassignUser.id);
      expect(memberIds).toContain(leader.id);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});
