import * as request from 'supertest';
import { Action } from '../src/actions/entities/action.entity';
import { ActionStatus } from 'src/actions/entities/action-event.entity';
import { CreateActionDto, ActionEventDto } from '../src/actions/dto/action.dto';
import { createTestApp, TestContext } from './e2e-test-utils';
import { UserActionRelation } from '../src/actions/entities/user-action.entity';
import { Repository } from 'typeorm';
import { NotificationType } from 'src/actions/entities/action-event.entity';

describe('Actions (e2e)', () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;
  let actionRepo: Repository<Action>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);

    // Create test action
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Active,
    });

    testDraftAction = actionRepo.create({
      name: 'Test Draft Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Draft,
    });

    await actionRepo.save(testAction);
    await actionRepo.save(testDraftAction);
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
        timeEstimate: '1h',
        events: []
      };

      const res = await request(ctx.app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(newAction);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Action');

      await actionRepo.query('DELETE FROM action WHERE id = ?', [res.body.id]);
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
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });
      expect(action).not.toBeNull();

      await ctx.agent.post(`/actions/join/${action!.id}`).expect(201);
    });

    it('user is shown their own relation to an action', async () => {
      const action = await actionRepo.findOneBy({
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

    it('user can see their relation to all actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/withStatus')
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

    it('can see completed actions for a user', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/completed/${ctx.testUserId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
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

    it('unauthenticated user can see actions', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/actions');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('admin can add an event to an action', async () => {
      const action = await ctx.actionRepo.findOneBy({
        name: 'Test Action',
      });

      const newEvent: ActionEventDto = {
        message: 'Test Event',
        newStatus: ActionStatus.Active,
        sendNotifsTo: NotificationType.All,
        updateDate: new Date(),
        showInTimeline: true,
      };

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/${action!.id}/events`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(newEvent);

      expect(res.status).toBe(201);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].message).toBe('Test Event');
    });

    it('events are included in action details', async () => {
      const action = await ctx.actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].message).toBe('Test Event');
    });
  });
  it('admin cannot add an event to an action with missing data', async () => {
    const action = await ctx.actionRepo.findOneBy({
      name: 'Test Action',
    });

    const incompleteEvent: Partial<ActionEventDto> = {
      message: 'Incomplete Event',
    };

    const res = await request(ctx.app.getHttpServer())
      .post(`/actions/${action!.id}/events`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send(incompleteEvent);

    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    await actionRepo.query('DELETE FROM action');
    await ctx.app.close();
  });
});