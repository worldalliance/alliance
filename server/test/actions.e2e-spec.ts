import * as request from 'supertest';
import { Action, ActionTaskType } from '../src/actions/entities/action.entity';
import {
  CreateActionDto,
  ActionEventDto,
  CreateActionEventDto,
} from '../src/actions/dto/action.dto';
import { createTestApp, TestContext } from './e2e-test-utils';
import { UserActionRelation } from '../src/actions/entities/user-action.entity';
import { Repository } from 'typeorm';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from '../src/actions/entities/action-event.entity';

describe('Actions (e2e)', () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);

    // Create test action with MemberAction status
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      body: 'Test action for forum tests',
      taskContents: 'Test action for forum tests',
    });

    testDraftAction = actionRepo.create({
      name: 'Test Draft Action',
      category: 'Test',
      body: 'Test action for forum tests',
    });

    await actionRepo.save(testAction);
    await actionRepo.save(testDraftAction);

    // Create events to set status for testAction to MemberAction
    const memberActionEvent = eventRepo.create({
      title: 'Action Started',
      description: 'Action is now in member action phase',
      newStatus: ActionStatus.MemberAction,
      sendNotifsTo: NotificationType.All,
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      showInTimeline: true,
      action: testAction,
    });
    await eventRepo.save(memberActionEvent);

    // testDraftAction has no events, so it defaults to Draft status
  }, 50000);

  describe('Actions', () => {
    it('admin can create a valid action', async () => {
      const newAction: CreateActionDto = {
        name: 'Test Action',
        body: 'Do something important',
        category: 'category',
        image: '',
        timeEstimate: '1h',
        shortDescription: 'Do something important',
        taskContents: 'Do something important',
        type: ActionTaskType.Activity,
      };

      const res = await request(ctx.app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(newAction);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Action');

      await actionRepo.query('DELETE FROM action WHERE id = $1', [res.body.id]);
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

    it('action will count joined users', async () => {
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });
      expect(action).not.toBeNull();
    });

    it('action will show locations of joined users', async () => {
      const locations = await request(ctx.app.getHttpServer())
        .get(`/actions/userlocations/${testAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(locations.status).toBe(200);
      expect(locations.body.length).toBe(0); //todo city data in test
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
        .get(`/actions/myStatus/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe(UserActionRelation.joined);
    });

    it('user can see their relation to all actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/myActionRelations')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].status).toBe(UserActionRelation.joined);
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

    it('unauthenticated user cannot access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer()).get(
        `/actions/${testDraftAction.id}`,
      );

      expect(res.status).toBe(404);
    });

    it('authenticated non-admin user cannot access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/${testDraftAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('admin can access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/${testDraftAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ActionStatus.Draft);
      expect(res.body.name).toBe('Test Draft Action');
    });

    it('unauthenticated user can see actions', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/actions');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('admin can add an event to an action', async () => {
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });

      const newEvent: CreateActionEventDto = {
        title: 'Test Event',
        description: 'Test Event',
        newStatus: ActionStatus.GatheringCommitments,
        date: new Date(),
        showInTimeline: true,
        sendNotifsTo: NotificationType.All,
      };

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/${action!.id}/events`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(newEvent);

      expect(res.status).toBe(201);
      expect(res.body.events.length).toBe(2);
      expect(res.body.events[1].title).toBe('Test Event');
    });

    it('events are included in action details', async () => {
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(2);
      expect(res.body.events[1].title).toBe('Test Event');
    });

    describe('Computed Status Tests', () => {
      it('new action with no events should have Draft status', async () => {
        const newAction = actionRepo.create({
          name: 'Status Test Action',
          category: 'Test',
          body: 'Test action for status computation',
        });
        await actionRepo.save(newAction);

        // Use admin token to access draft action
        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(ActionStatus.Draft);
        expect(res.body.events.length).toBe(0);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('adding first event should change status from Draft to new status', async () => {
        const newAction = actionRepo.create({
          name: 'Status Transition Test',
          category: 'Test',
          body: 'Test action for status transitions',
          taskContents: 'Test action for status transitions',
        });
        await actionRepo.save(newAction);

        // Verify initial draft status using admin token
        let res = await request(ctx.app.getHttpServer())
          .get(`/actions/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

        expect(res.body.status).toBe(ActionStatus.Draft);

        // Add event to change status
        const newEvent: CreateActionEventDto = {
          title: 'Launch Event',
          description: 'Action is now gathering commitments',
          newStatus: ActionStatus.GatheringCommitments,
          date: new Date(Date.now() - 1000), // 1 second ago
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(newEvent);

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(ActionStatus.GatheringCommitments);
        expect(res.body.events.length).toBe(1);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('status should reflect most recent past event when multiple events exist', async () => {
        const newAction = actionRepo.create({
          name: 'Multi Event Test',
          category: 'Test',
          body: 'Test action for multiple events',
          taskContents: 'Test action for multiple events',
        });
        await actionRepo.save(newAction);

        // Add first event (older)
        const firstEvent: CreateActionEventDto = {
          title: 'Launch',
          description: 'Action launched',
          newStatus: ActionStatus.GatheringCommitments,
          date: new Date(Date.now() - 3600000), // 1 hour ago
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(firstEvent);

        // Add second event (more recent)
        const secondEvent: CreateActionEventDto = {
          title: 'Commitments Reached',
          description: 'Action now in member action phase',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1800000), // 30 minutes ago
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        const res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(secondEvent);

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(ActionStatus.MemberAction);
        expect(res.body.events.length).toBe(2);

        // Verify by fetching the action
        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.body.status).toBe(ActionStatus.MemberAction);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('future events should not affect current status', async () => {
        const newAction = actionRepo.create({
          name: 'Future Event Test',
          category: 'Test',
          body: 'Test action for future events',
          taskContents: 'Test action for future events',
        });
        await actionRepo.save(newAction);

        // Add past event
        const pastEvent: CreateActionEventDto = {
          title: 'Launch',
          description: 'Action launched',
          newStatus: ActionStatus.GatheringCommitments,
          date: new Date(Date.now() - 3600000), // 1 hour ago
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(pastEvent);

        // Add future event
        const futureEvent: CreateActionEventDto = {
          title: 'Future Completion',
          description: 'Action will be completed',
          newStatus: ActionStatus.Completed,
          date: new Date(Date.now() + 3600000), // 1 hour from now
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        const res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(futureEvent);

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(ActionStatus.GatheringCommitments); // Should still be the past event's status
        expect(res.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('events on same date should use chronological order by event creation', async () => {
        const newAction = actionRepo.create({
          name: 'Same Date Test',
          category: 'Test',
          body: 'Test action for events on same date',
        });
        await actionRepo.save(newAction);

        const eventDate = new Date(Date.now() - 3600000); // 1 hour ago

        // Add first event
        const firstEvent: CreateActionEventDto = {
          title: 'First Event',
          description: 'First event on this date',
          newStatus: ActionStatus.GatheringCommitments,
          date: eventDate,
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(firstEvent);

        // Add second event with same date
        const secondEvent: CreateActionEventDto = {
          title: 'Second Event',
          description: 'Second event on same date',
          newStatus: ActionStatus.MemberAction,
          date: eventDate,
          showInTimeline: true,
          sendNotifsTo: NotificationType.All,
        };

        const res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(secondEvent);

        expect(res.status).toBe(201);
        expect(res.body.status).toBe(ActionStatus.MemberAction);
        expect(res.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('status computation should handle complex timeline scenarios', async () => {
        const newAction = actionRepo.create({
          name: 'Complex Timeline Test',
          category: 'Test',
          body: 'Test action for complex status timeline',
        });
        await actionRepo.save(newAction);

        const now = Date.now();

        // Add events in non-chronological order to test sorting
        const events = [
          {
            title: 'Future Resolution',
            newStatus: ActionStatus.Resolution,
            date: new Date(now + 7200000), // 2 hours from now
          },
          {
            title: 'Launch',
            newStatus: ActionStatus.GatheringCommitments,
            date: new Date(now - 14400000), // 4 hours ago
          },
          {
            title: 'Member Action Start',
            newStatus: ActionStatus.MemberAction,
            date: new Date(now - 3600000), // 1 hour ago (most recent past)
          },
          {
            title: 'Commitments Reached',
            newStatus: ActionStatus.CommitmentsReached,
            date: new Date(now - 7200000), // 2 hours ago
          },
        ];

        for (const event of events) {
          const eventDto: CreateActionEventDto = {
            title: event.title,
            description: `Event: ${event.title}`,
            newStatus: event.newStatus,
            date: event.date,
            showInTimeline: true,
            sendNotifsTo: NotificationType.All,
          };

          await request(ctx.app.getHttpServer())
            .post(`/actions/${newAction.id}/events`)
            .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
            .send(eventDto);
        }

        // Get final action state
        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(ActionStatus.MemberAction); // Most recent past event
        expect(res.body.events.length).toBe(4);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });
    });
  });
  it('admin cannot add an event to an action with missing data', async () => {
    const action = await actionRepo.findOneBy({
      name: 'Test Action',
    });

    const incompleteEvent: Partial<ActionEventDto> = {
      title: 'Incomplete Event',
    };

    const res = await request(ctx.app.getHttpServer())
      .post(`/actions/${action!.id}/events`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send(incompleteEvent);

    expect(res.status).toBe(400);
  });

  it('myActionRelations returns actions with user relation', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/actions/myActionRelations')
      .set('Authorization', `Bearer ${ctx.accessToken}`);

    expect(res.status).toBe(200);
  });

  describe('Automatic State Transitions', () => {
    it('should automatically transition from GatheringCommitments to CommitmentsReached when threshold is met', async () => {
      // Create action with commitment threshold
      const newAction = actionRepo.create({
        name: 'Auto Transition Test - Commitments',
        category: 'Test',
        body: 'Test action for automatic commitment transitions',
        commitmentThreshold: 2, // Need 2 users to reach threshold
      });
      await actionRepo.save(newAction);

      // Set action to GatheringCommitments status
      const gatheringEvent: CreateActionEventDto = {
        title: 'Start Gathering Commitments',
        description: 'Action is now gathering commitments',
        newStatus: ActionStatus.GatheringCommitments,
        date: new Date(Date.now() - 1000), // 1 second ago
        showInTimeline: true,
        sendNotifsTo: NotificationType.All,
      };

      await request(ctx.app.getHttpServer())
        .post(`/actions/${newAction.id}/events`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(gatheringEvent);

      // Verify status is GatheringCommitments
      let res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.GatheringCommitments);
      expect(res.body.events.length).toBe(1);

      // First user joins - should not trigger transition yet
      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.GatheringCommitments);
      expect(res.body.usersJoined).toBe(1);
      expect(res.body.events.length).toBe(1); // No automatic transition yet

      // Second user joins - should trigger automatic transition
      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.CommitmentsReached);
      expect(res.body.usersJoined).toBe(2);
      expect(res.body.events.length).toBe(2); // Automatic transition event created

      // Check the automatic event details
      const automaticEvent = res.body.events.find(
        (e: ActionEventDto) => e.title === 'Commitment threshold reached',
      );
      expect(automaticEvent).toBeDefined();
      expect(automaticEvent.description).toContain('2 people have committed');
      expect(automaticEvent.newStatus).toBe(ActionStatus.CommitmentsReached);
      expect(automaticEvent.sendNotifsTo).toBe(NotificationType.Joined);

      // Cleanup
      await actionRepo.delete(newAction.id);
    });

    it('should automatically transition from MemberAction to Resolution when all members complete', async () => {
      // Create action for testing completion transitions
      const newAction = actionRepo.create({
        name: 'Auto Transition Test - Completion',
        category: 'Test',
        body: 'Test action for automatic completion transitions',
      });
      await actionRepo.save(newAction);

      // Set action to MemberAction status
      const memberActionEvent: CreateActionEventDto = {
        title: 'Member Action Started',
        description: 'Members can now complete the action',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000), // 1 second ago
        showInTimeline: true,
        sendNotifsTo: NotificationType.All,
      };

      await request(ctx.app.getHttpServer())
        .post(`/actions/${newAction.id}/events`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(memberActionEvent);

      // Two users join the action
      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      // Verify initial state
      let res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.MemberAction);
      expect(res.body.usersJoined).toBe(2);
      expect(res.body.usersCompleted).toBe(0);
      expect(res.body.events.length).toBe(1);

      // First user completes - should not trigger transition yet
      await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.MemberAction);
      expect(res.body.usersJoined).toBe(2);
      expect(res.body.usersCompleted).toBe(1);
      expect(res.body.events.length).toBe(1); // No automatic transition yet

      // Second user completes - should trigger automatic transition
      await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.Resolution);
      expect(res.body.usersJoined).toBe(2);
      expect(res.body.usersCompleted).toBe(2);
      expect(res.body.events.length).toBe(2); // Automatic transition event created

      // Check the automatic event details
      const automaticEvent = res.body.events.find(
        (e: ActionEventDto) => e.title === 'All members completed action',
      );
      expect(automaticEvent).toBeDefined();
      expect(automaticEvent.description).toContain(
        'All 2 committed members have completed',
      );
      expect(automaticEvent.newStatus).toBe(ActionStatus.Resolution);
      expect(automaticEvent.sendNotifsTo).toBe(NotificationType.Joined);

      // Cleanup
      await actionRepo.delete(newAction.id);
    });

    it('should not transition to Resolution if no users have joined', async () => {
      // Create action with no users joined
      const newAction = actionRepo.create({
        name: 'Auto Transition Test - No Users',
        category: 'Test',
        body: 'Test action with no users joined',
      });
      await actionRepo.save(newAction);

      // Set action to MemberAction status
      const memberActionEvent: CreateActionEventDto = {
        title: 'Member Action Started',
        description: 'Members can now complete the action',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        showInTimeline: true,
        sendNotifsTo: NotificationType.All,
      };

      await request(ctx.app.getHttpServer())
        .post(`/actions/${newAction.id}/events`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send(memberActionEvent);

      // Verify no automatic transition occurs with 0 users
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.MemberAction);
      expect(res.body.usersJoined).toBe(0);
      expect(res.body.usersCompleted).toBe(0);
      expect(res.body.events.length).toBe(1); // Only the initial event

      // Cleanup
      await actionRepo.delete(newAction.id);
    });
  });

  afterAll(async () => {
    await actionRepo.query('DELETE FROM action');
    await ctx.app.close();
  });
});
