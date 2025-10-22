import { UserActionRelation } from 'src/actions/actions.service';
import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import { CommentParentObject } from 'src/forum/entities/comment.entity';
import { UserService } from 'src/user/user.service';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import {
  ActionDto,
  ActionEventDto,
  CreateActionDto,
  CreateActionEventDto,
} from '../src/actions/dto/action.dto';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from '../src/actions/entities/action-event.entity';
import { Action, ActionTaskType } from '../src/actions/entities/action.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { Group } from '../src/user/entities/group.entity';
import { User } from '../src/user/entities/user.entity';

describe('Actions (e2e)', () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let userService: UserService;
  let groupRepo: Repository<Group>;
  let userRepo: Repository<User>;
  let restrictedGroup: Group;
  let groupRestrictedAction: Action;
  let outsiderToken: string;

  const createPublishedAction = async (
    name: string,
    options: {
      status?: ActionStatus;
      sendNotifsTo?: NotificationType;
      actionOverrides?: Partial<Action>;
    } = {},
  ) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: 'Test',
        body: 'Body copy',
        taskContents: 'Task copy',
        shortDescription: `${name} short description`,
        showToNonparticipating: true,
        participatingGroups: [ctx.defaultGroup],
        ...options.actionOverrides,
      }),
    );

    const event = await eventRepo.save(
      eventRepo.create({
        title: `${name} launch`,
        description: 'Action live',
        newStatus: options.status ?? ActionStatus.MemberAction,
        sendNotifsTo: options.sendNotifsTo ?? NotificationType.All,
        date: new Date(Date.now() - 1000),
        showInTimeline: true,
        action,
      }),
    );

    return { action, event };
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    userService = ctx.app.get(UserService);
    groupRepo = ctx.dataSource.getRepository(Group);
    userRepo = ctx.dataSource.getRepository(User);

    // Create test action with MemberAction status
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      body: 'Test action for forum tests',
      taskContents: 'Test action for forum tests',
      showToNonparticipating: true,
      participatingGroups: [ctx.defaultGroup],
    });

    testDraftAction = actionRepo.create({
      name: 'Test Draft Action',
      category: 'Test',
      body: 'Test action for forum tests',
      showToNonparticipating: true,
      participatingGroups: [ctx.defaultGroup],
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

    const defaultUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });
    defaultUser.contractDateSigned = new Date();
    await userRepo.save(defaultUser);

    restrictedGroup = await groupRepo.save(
      groupRepo.create({
        name: 'Restricted Cohort',
        description: 'Members only',
        users: [defaultUser],
      }),
    );

    const outsider = await userRepo.save(
      userRepo.create({
        email: 'outsider@example.com',
        password: 'pass',
        name: 'Outsider',
      }),
    );

    outsiderToken = ctx.jwtService.sign(
      { sub: outsider.id, email: outsider.email, name: outsider.name },
      { secret: process.env.JWT_SECRET },
    );

    const { action: restricted } = await createPublishedAction(
      'Group Restricted Action',
      {
        actionOverrides: {
          participatingGroups: [restrictedGroup],
          showToNonparticipating: true,
        },
      },
    );

    await createPublishedAction('Group Restricted Hidden Action', {
      actionOverrides: {
        participatingGroups: [restrictedGroup],
        showToNonparticipating: false,
      },
    });

    groupRestrictedAction = await actionRepo.findOneOrFail({
      where: { id: restricted.id },
      relations: ['participatingGroups'],
    });
  }, 50000);

  describe('Actions', () => {
    it('admin can create a valid action', async () => {
      const newAction: CreateActionDto = {
        name: 'Test Action',
        body: 'Do something important',
        category: 'category',
        image: '',
        timeEstimate: 5,
        shortDescription: 'Do something important',
        type: ActionTaskType.Activity,
        commitmentless: false,
        everyoneShouldComplete: false,
        participatingGroups: [],
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
      expect(res2.body.relation).toBe(UserActionRelation.Joined);
    });

    it('user can see their action activities', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/myActivity')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].type).toBe(ActionActivityType.USER_JOINED);
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

      expect(
        res.body.some(
          (action: ActionDto) => action.status === ActionStatus.Draft,
        ),
      ).toBe(false);
    });

    it('admin can see draft actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/all')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.some(
          (action: ActionDto) => action.status === ActionStatus.Draft,
        ),
      ).toBe(true);
    });

    it('unauthenticated user cannot access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer()).get(
        `/actions/slug/${testDraftAction.id}`,
      );

      expect(res.status).toBe(404);
    });

    it('authenticated non-admin user cannot access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${testDraftAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('admin can access individual draft action', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${testDraftAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ActionStatus.Draft);
      expect(res.body.name).toBe('Test Draft Action');
    });

    it('unauthenticated user can see actions', async () => {
      const res = await request(ctx.app.getHttpServer()).get('/actions');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(1);

      expect(
        res.body.some(
          (action: ActionDto) => action.status === ActionStatus.Draft,
        ),
      ).toBe(false);
    });

    it('allows members of participating groups to join restricted actions', async () => {
      const res = await ctx.agent
        .post(`/actions/join/${groupRestrictedAction.id}`)
        .expect(201);

      expect(res.body.actionId).toBe(groupRestrictedAction.id);
    });

    it('blocks users outside participating groups from joining restricted actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${groupRestrictedAction.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('only counts eligible participants in pre-event notification data', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/preEventNotifData/${groupRestrictedAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .query({
          type: ActionStatus.MemberAction,
          sendNotifsTo: NotificationType.All,
        });

      expect(res.status).toBe(200);
      expect(res.body.emails.length).toBe(1);
      expect(res.body.texts.length).toBe(0);
    });

    it('shows actions to outsider if showToNonparticipating is true', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.some(
          (action: ActionDto) => action.name === 'Group Restricted Action',
        ),
      ).toBe(true);
    });

    it('does not show actions to non-participating groups if showToNonparticipating is false', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.some(
          (action: ActionDto) =>
            action.name === 'Group Restricted Hidden Action',
        ),
      ).toBe(false);
    });

    it('excludes shouldComplete flag for users without eligible contracts when everyoneShouldComplete is false', async () => {
      const { action, event } = await createPublishedAction(
        'Contract Restricted Action',
        {
          status: ActionStatus.MemberAction,
          actionOverrides: {
            everyoneShouldComplete: false,
          },
        },
      );

      const unsignedUser = await userService.create({
        email: `unsigned-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Unsigned User',
        groups: [ctx.defaultGroup],
      });

      const lateSigner = await userService.create({
        email: `late-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Late Signer',
        contractDateSigned: new Date(event.date.getTime() + 1000),
        groups: [ctx.defaultGroup],
      });

      const eligibleUser = await userService.create({
        email: `eligible-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Eligible User',
        contractDateSigned: new Date(event.date.getTime() - 1000),
        groups: [ctx.defaultGroup],
      });

      const unsignedToken = ctx.jwtService.sign(
        {
          sub: unsignedUser.id,
          email: unsignedUser.email,
          name: unsignedUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const lateToken = ctx.jwtService.sign(
        {
          sub: lateSigner.id,
          email: lateSigner.email,
          name: lateSigner.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const eligibleToken = ctx.jwtService.sign(
        {
          sub: eligibleUser.id,
          email: eligibleUser.email,
          name: eligibleUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [unsignedRes, lateRes, eligibleRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions')
          .set('Authorization', `Bearer ${unsignedToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions')
          .set('Authorization', `Bearer ${lateToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions')
          .set('Authorization', `Bearer ${eligibleToken}`)
          .expect(200),
      ]);

      const findAction = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === action.id);

      const unsignedAction = findAction(unsignedRes);
      const lateAction = findAction(lateRes);
      const eligibleAction = findAction(eligibleRes);

      expect(unsignedAction).toBeDefined();
      expect(unsignedAction!.shouldParticipate).toBe(false);
      expect(lateAction).toBeDefined();
      expect(lateAction!.shouldParticipate).toBe(false);
      expect(eligibleAction).toBeDefined();
      expect(eligibleAction!.shouldParticipate).toBe(true);

      await actionRepo.delete(action.id);
      await userRepo.delete(unsignedUser.id);
      await userRepo.delete(lateSigner.id);
      await userRepo.delete(eligibleUser.id);
    });

    it('shows actions with everyoneShouldComplete true to users without contracts', async () => {
      const { action } = await createPublishedAction('Onboarding Action', {
        status: ActionStatus.MemberAction,
        actionOverrides: {
          everyoneShouldComplete: true,
        },
      });

      const contractlessUser = await userService.create({
        email: `contractless-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Contractless User',
        groups: [ctx.defaultGroup],
      });

      const contractlessToken = ctx.jwtService.sign(
        {
          sub: contractlessUser.id,
          email: contractlessUser.email,
          name: contractlessUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${contractlessToken}`)
        .expect(200);

      const targetAction = res.body.find((a: ActionDto) => a.id === action.id);

      expect(targetAction).toBeDefined();
      expect(targetAction.shouldParticipate).toBe(true);

      await actionRepo.delete(action.id);
      await userRepo.delete(contractlessUser.id);
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
      expect(res.body.title).toBe('Test Event');
    });

    it('events are included in action details', async () => {
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(2);
      expect(res.body.events.map((e: ActionEventDto) => e.title)).toContain(
        'Test Event',
      );
    });

    describe('Computed Status Tests', () => {
      it('new action with no events should have Draft status', async () => {
        const newAction = actionRepo.create({
          name: 'Status Test Action',
          category: 'Test',
          body: 'Test action for status computation',
          participatingGroups: [ctx.defaultGroup],
        });
        await actionRepo.save(newAction);

        // Use admin token to access draft action
        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
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
          participatingGroups: [ctx.defaultGroup],
        });
        await actionRepo.save(newAction);

        // Verify initial draft status using admin token
        let res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
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

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.GatheringCommitments);
        expect(getRes.body.events.length).toBe(1);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('status should reflect most recent past event when multiple events exist', async () => {
        const newAction = actionRepo.create({
          name: 'Multi Event Test',
          category: 'Test',
          body: 'Test action for multiple events',
          taskContents: 'Test action for multiple events',
          participatingGroups: [ctx.defaultGroup],
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

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(secondEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction);
        expect(getRes.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it('future events should not affect current status', async () => {
        const newAction = actionRepo.create({
          name: 'Future Event Test',
          category: 'Test',
          body: 'Test action for future events',
          taskContents: 'Test action for future events',
          participatingGroups: [ctx.defaultGroup],
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

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(futureEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.GatheringCommitments); // Should still be the past event's status
        expect(getRes.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });
      //   it('events on same date should use chronological order by event creation', async () => {
      //     const newAction = actionRepo.create({
      //       name: 'Same Date Test',
      //       category: 'Test',
      //       body: 'Test action for events on same date',
      //     });
      //     await actionRepo.save(newAction);

      //     const eventDate = new Date(Date.now() - 3600000); // 1 hour ago

      //     // Add first event
      //     const firstEvent: CreateActionEventDto = {
      //       title: 'First Event',
      //       description: 'First event on this date',
      //       newStatus: ActionStatus.GatheringCommitments,
      //       date: eventDate,
      //       showInTimeline: true,
      //       sendNotifsTo: NotificationType.All,
      //     };

      //     await request(ctx.app.getHttpServer())
      //       .post(`/actions/${newAction.id}/events`)
      //       .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      //       .send(firstEvent);

      //     // Add second event with same date
      //     const secondEvent: CreateActionEventDto = {
      //       title: 'Second Event',
      //       description: 'Second event on same date',
      //       newStatus: ActionStatus.MemberAction,
      //       date: eventDate,
      //       showInTimeline: true,
      //       sendNotifsTo: NotificationType.All,
      //     };

      //     const res = await request(ctx.app.getHttpServer())
      //       .post(`/actions/${newAction.id}/events`)
      //       .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      //       .send(secondEvent);

      //     expect(res.status).toBe(201);
      //     expect(res.body.status).toBe(ActionStatus.MemberAction);
      //     expect(res.body.events.length).toBe(2);

      //     // Cleanup
      //     await actionRepo.delete(newAction.id);
      //   });

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
            newStatus: ActionStatus.OfficeAction,
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
          .get(`/actions/slug/${newAction.id}`)
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

  describe('Automatic State Transitions', () => {
    it('should automatically transition from GatheringCommitments to CommitmentsReached when threshold is met', async () => {
      // Create action with commitment threshold
      const newAction = actionRepo.create({
        name: 'Auto Transition Test - Commitments',
        category: 'Test',
        body: 'Test action for automatic commitment transitions',
        commitmentThreshold: 2, // Need 2 users to reach threshold
        participatingGroups: [ctx.defaultGroup],
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
        .get(`/actions/slug/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.GatheringCommitments);
      expect(res.body.events.length).toBe(1);

      // First user joins - should not trigger transition yet
      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.GatheringCommitments);
      expect(res.body.usersJoined).toBe(1);
      expect(res.body.events.length).toBe(1); // No automatic transition yet

      // Second user joins - should trigger automatic transition
      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`);

      res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.OfficeAction);
      expect(res.body.usersJoined).toBe(2);
      expect(res.body.events.length).toBe(2); // Automatic transition event created

      // Check the automatic event details
      const automaticEvent = res.body.events.find(
        (e: ActionEventDto) => e.title === 'Commitment threshold reached',
      );
      expect(automaticEvent).toBeDefined();
      expect(automaticEvent.description).toContain('2 people have committed');
      expect(automaticEvent.newStatus).toBe(ActionStatus.OfficeAction);
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
        participatingGroups: [ctx.defaultGroup],
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
        .get(`/actions/slug/${newAction.id}`)
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
        .get(`/actions/slug/${newAction.id}`)
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
        .get(`/actions/slug/${newAction.id}`)
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
        participatingGroups: [ctx.defaultGroup],
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
        .get(`/actions/slug/${newAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.body.status).toBe(ActionStatus.MemberAction);
      expect(res.body.usersJoined).toBe(0);
      expect(res.body.usersCompleted).toBe(0);
      expect(res.body.events.length).toBe(1); // Only the initial event

      // Cleanup
      await actionRepo.delete(newAction.id);
    });
  });

  describe('Additional endpoints', () => {
    it('allows a user to decline an action with a moral reason', async () => {
      const { action } = await createPublishedAction('Decline Scenario');

      const decline = await request(ctx.app.getHttpServer())
        .post(`/actions/decline/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ reason: 'Cannot participate', moral: true })
        .expect(201);

      expect(decline.body.type).toBe(ActionActivityType.USER_DECLINED);
      expect(decline.body.actionId).toBe(action.id);

      await actionRepo.delete(action.id);
    });

    it('allows a user to opt out of completing an action', async () => {
      const { action } = await createPublishedAction('Optout Scenario');

      const optout = await request(ctx.app.getHttpServer())
        .post(`/actions/optout/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ reason: 'Out of time', outOfTime: true })
        .expect(201);

      expect(optout.body.type).toBe(ActionActivityType.USER_WONT_COMPLETE);
      await actionRepo.delete(action.id);
    });

    it('records a completion activity for a user', async () => {
      const { action } = await createPublishedAction('Completion Scenario');

      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const complete = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(complete.body.type).toBe(ActionActivityType.USER_COMPLETED);

      const feed = await request(ctx.app.getHttpServer())
        .get('/actions/activities/feed')
        .query({ limit: 5 })
        .expect(200);

      expect(
        feed.body.some((activity) => activity.id === complete.body.id),
      ).toBe(true);

      await actionRepo.delete(action.id);
    });

    it('rejects invalid before cursor when fetching the activity feed', async () => {
      await request(ctx.app.getHttpServer())
        .get('/actions/activities/feed')
        .query({ before: 'not-a-date' })
        .expect(400);
    });

    it('exposes per-action activities and individual activity details', async () => {
      const { action } = await createPublishedAction('Activities Scenario');

      const join = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = join.body.id;

      const activities = await request(ctx.app.getHttpServer())
        .get(`/actions/${action.id}/activities`)
        .expect(200);

      expect(activities.body.length).toBeGreaterThan(0);

      const single = await request(ctx.app.getHttpServer())
        .get(`/actions/activities/${activityId}`)
        .expect(200);

      expect(single.body.id).toBe(activityId);

      const event = await eventRepo.findOne({
        where: { action: { id: action.id } },
      });
      expect(event).toBeDefined();

      const eventRes = await request(ctx.app.getHttpServer())
        .get(`/actions/events/${event!.id}`)
        .expect(200);

      expect(eventRes.body.id).toBe(event!.id);

      await actionRepo.delete(action.id);
    });

    it('shows draft actions only to admins', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/all')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const hasDraft = res.body.some(
        (action: Action) => action.status === ActionStatus.Draft,
      );
      expect(hasDraft).toBe(true);
    });

    it('returns friend activity for accepted relationships', async () => {
      const { action } = await createPublishedAction(
        'Friend Activity Scenario',
      );
      const friend = await userService.create({
        name: 'Friend User',
        email: `friend-${Date.now()}@example.com`,
        password: 'Password123!',
        groups: [ctx.defaultGroup],
      });

      await userService.makeFriendsAutomated(ctx.testUserId, friend.id);

      const friendToken = ctx.jwtService.sign({
        sub: friend.id,
        email: friend.email,
        name: friend.name,
      });

      await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action.id}`)
        .set('Authorization', `Bearer ${friendToken}`)
        .expect(201);

      const friendActivity = await request(ctx.app.getHttpServer())
        .get('/actions/friendActivity')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(friendActivity.body.length).toBeGreaterThan(0);
      expect(friendActivity.body[0].user.id).toBe(friend.id);

      await actionRepo.delete(action.id);
    });

    it('supports liking, unliking, and commenting on activities', async () => {
      const { action } = await createPublishedAction(
        'Activity Reactions Scenario',
      );

      const join = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = join.body.id;

      const like = await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(like.body.likes.length).toBe(1);

      const comment = await request(ctx.app.getHttpServer())
        .post(`/actions/addActivityComment/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Great job', attachments: [] },
          parentObjectId: activityId,
          parentObjectType: CommentParentObject.Activity,
        })
        .expect(201);

      expect(comment.body.parentObjectId).toBe(activityId);

      const update = await request(ctx.app.getHttpServer())
        .post(`/actions/updateActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Updated note', attachments: [] },
        })
        .expect(201);

      expect(update.body.editableContent.body).toBe('Updated note');

      const unlike = await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(unlike.body.likes.length).toBe(0);

      await actionRepo.delete(action.id);
    });

    it('allows admins to preview notification counts', async () => {
      const baseUsers = await Promise.all(
        ['alice', 'bob', 'carol'].map((name, index) =>
          userService.create({
            name: `Notif ${name}`,
            email: `notif-${name}-${Date.now()}@example.com`,
            password: 'Password123!',
            phoneNumber: index === 0 ? undefined : `+14155550${100 + index}`,
            phoneNumberValidated: true,
            contractDateSigned: new Date(),
            emailNotifsEnabled: true,
            textNotifsEnabled: true,
            turnedOffAllNotifs: false,
            groups: [ctx.defaultGroup],
          }),
        ),
      );
      const n_users = baseUsers.length + 1; // +1 for default sample user

      const tokens = baseUsers.map((user) =>
        ctx.jwtService.sign({
          sub: user.id,
          email: user.email,
          name: user.name,
        }),
      );

      const { action: memberAction } = await createPublishedAction(
        'Notif Member Scenario',
        {
          status: ActionStatus.MemberAction,
        },
      );

      for (const token of tokens.slice(0, 2)) {
        await request(ctx.app.getHttpServer())
          .post(`/actions/join/${memberAction.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(201);
      }

      const memberRes = await request(ctx.app.getHttpServer())
        .get(`/actions/preEventNotifData/${memberAction.id}`)
        .query({
          type: ActionStatus.MemberAction,
          sendNotifsTo: NotificationType.Joined,
        })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(memberRes.body.emails.length).toBe(1);
      expect(memberRes.body.texts.length).toBe(1);
      expect(memberRes.body.pushes.length).toBe(0);

      const { action: gatherAction } = await createPublishedAction(
        'Notif Gathering Scenario',
        {
          status: ActionStatus.GatheringCommitments,
        },
      );

      const gatherRes = await request(ctx.app.getHttpServer())
        .get(`/actions/preEventNotifData/${gatherAction.id}`)
        .query({
          type: ActionStatus.GatheringCommitments,
          sendNotifsTo: NotificationType.All,
        })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(gatherRes.body.texts.length + gatherRes.body.emails.length).toBe(
        n_users,
      );
      expect(gatherRes.body.pushes.length).toBe(0);

      const { action: commitmentlessAction } = await createPublishedAction(
        'Notif Commitmentless Scenario',
        {
          status: ActionStatus.MemberAction,
          actionOverrides: { commitmentless: true },
        },
      );

      const commitmentlessRes = await request(ctx.app.getHttpServer())
        .get(`/actions/preEventNotifData/${commitmentlessAction.id}`)
        .query({
          type: ActionStatus.MemberAction,
          sendNotifsTo: NotificationType.All,
        })
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(commitmentlessRes.body.emails.length).toBe(2);
      expect(commitmentlessRes.body.texts.length).toBe(2);
      expect(commitmentlessRes.body.pushes.length).toBe(0);

      await actionRepo.delete(memberAction.id);
      await actionRepo.delete(gatherAction.id);
      await actionRepo.delete(commitmentlessAction.id);
    });
  });

  afterAll(async () => {
    await actionRepo.query('DELETE FROM action');
    await ctx.app.close();
  });
});
