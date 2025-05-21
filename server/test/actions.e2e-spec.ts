import * as request from 'supertest';
import { Action, ActionStatus } from '../src/actions/entities/action.entity';
import { CreateActionDto } from '../src/actions/dto/action.dto';
import { createTestApp, TestContext } from './e2e-test-utils';
import { UserActionRelation } from '../src/actions/entities/user-action.entity';

describe('Actions (e2e)', () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;

  beforeAll(async () => {
    ctx = await createTestApp([]);

    // Create test action
    testAction = ctx.actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Active,
    });

    testDraftAction = ctx.actionRepo.create({
      name: 'Test Draft Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Draft,
    });

    await ctx.actionRepo.save(testAction);
    await ctx.actionRepo.save(testDraftAction);
  });

  describe('Actions', () => {
    it('admin can create a valid action', async () => {
      const newAction: CreateActionDto = {
        name: 'Test Action',
        description: 'Do something important',
        status: ActionStatus.Active,
        category: '',
        whyJoin: '',
        image: '',
        userRelations: [],
      };

      const res = await request(ctx.app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(newAction);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Action');

      await ctx.actionRepo.query('DELETE FROM action WHERE id = ?', [
        res.body.id,
      ]);
    });
    it('action creation with missing data rejected', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: 'Test Action',
          description: 'Do something important',
        });

      expect(res.status).toBe(400);
    });

    it('user can join an action', async () => {
      const action = await ctx.actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(201);
    });

    it('user is shown their own relation to an action', async () => {
      const action = await ctx.actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(201);

      const res2 = await request(ctx.app.getHttpServer())
        .get(`/actions/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.myRelation.status).toBe(UserActionRelation.joined);
    });

    it('user can see their relaton to all actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].myRelation.status).toBe(UserActionRelation.joined);
      expect(res.body[0].usersJoined).toBe(1);
    });

    it('can fetch all actions with status', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('status');
    });

    it('user cannot see draft actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('admin can see draft actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/all')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[1].status).toBe(ActionStatus.Draft);
    });
  });

  afterAll(async () => {
    await ctx.userActionRepo.query('DELETE FROM user_action');
    await ctx.actionRepo.query('DELETE FROM action');
    await ctx.userRepo.query('DELETE FROM user');
    await ctx.app.close();
  });
});
