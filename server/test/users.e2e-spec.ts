import * as request from 'supertest';
import { FriendStatus } from '../src/user/friend.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { Repository } from 'typeorm';
import { User } from '../src/user/user.entity';
import { NotificationType } from 'src/notifs/entities/notification.entity';
import { City } from '../src/geo/city.entity';
import { GeoModule } from '../src/geo/geo.module';

describe('Users (e2e)', () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let cityRepo: Repository<City>;

  let userAId: number;
  let userAToken: string;
  let userBId: number;
  let userBToken: string;

  beforeAll(async () => {
    ctx = await createTestApp([GeoModule]);
    userRepo = ctx.dataSource.getRepository(User);
    cityRepo = ctx.dataSource.getRepository(City);
    const userA = userRepo.create({
      name: 'Friend A',
      email: 'frienda@example.com',
      password: 'Password123!',
    });
    await userRepo.save(userA);
    userAId = userA.id;
    userAToken = ctx.jwtService.sign({ sub: userAId });

    const userB = userRepo.create({
      name: 'Friend B',
      email: 'friendb@example.com',
      password: 'Password123!',
    });

    await userRepo.save(userB);
    userBId = userB.id;
    userBToken = ctx.jwtService.sign({ sub: userBId });
  }, 50000);

  it('can update user', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/update`)
      .send({
        name: 'Friend A',
        profileDescription: 'Friend A',
        profilePicture: 'Friend A',
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
    expect(res.body.onboardingComplete).toBe(true);

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
    expect(notifs.body[0].category).toBe(NotificationType.FriendRequest);
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
      NotificationType.FriendRequestAccepted,
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

  afterAll(async () => {
    await ctx.app.close();
  });
});
