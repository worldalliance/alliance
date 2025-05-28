import * as request from 'supertest';
import { FriendStatus } from '../src/user/friend.entity';
import { createTestApp, TestContext } from './e2e-test-utils';

describe('Friends (e2e)', () => {
  let ctx: TestContext;

  // IDs & tokens for the two regular users we’ll test with
  let userAId: number; // already created by `createTestApp`
  let userAToken: string; // ctx.accessToken
  let userBId: number;
  let userBToken: string;

  beforeAll(async () => {
    /* ───── spin-up Nest app & baseline user ───── */
    ctx = await createTestApp([]);

    // Default “regular user” that e2e-utils always seeds
    const userA = ctx.userRepo.create({
      name: 'Friend A',
      email: 'frienda@example.com',
      password: 'Password123!', // will be hashed by entity hook
    });
    await ctx.userRepo.save(userA);
    userAId = userA.id;
    userAToken = ctx.jwtService.sign({ sub: userAId });

    /* ───── create a second regular user (User B) ───── */
    const userB = ctx.userRepo.create({
      name: 'Friend B',
      email: 'friendb@example.com',
      password: 'Password123!', // will be hashed by entity hook
    });

    await ctx.userRepo.save(userB);
    userBId = userB.id;
    console.log('userBId', userBId);
    userBToken = ctx.jwtService.sign({ sub: userBId });
  });

  /* ────────────────────────────────────────────────────────────
   *  Friend-request life-cycle
   * ──────────────────────────────────────────────────────────── */

  it('User A can send a friend request to User B', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/user/friends/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe(FriendStatus.Pending);
  });

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

  it('Request appears in the correct sent/received queues', async () => {
    // Sent list for A
    const sent = await request(ctx.app.getHttpServer())
      .get('/user/friends/requests/sent')
      .set('Authorization', `Bearer ${userAToken}`);

    console.log(sent.body);
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

  it('User B can accept the friend request', async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`/user/friends/${userAId}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(FriendStatus.Accepted);
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
    await ctx.friendRepo.query('DELETE FROM friend');
    await ctx.userRepo.query('DELETE FROM user');
    await ctx.app.close();
  });
});
