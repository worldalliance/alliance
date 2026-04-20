import { ActionActivityType } from 'src/actions/entities/action-activity.entity';
import type { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { CommentParentObject } from 'src/forum/entities/comment.entity';
import { UserService } from 'src/user/user.service';
import { ContractService } from 'src/contract/contract.service';
import request from 'supertest';
import type { Repository } from 'typeorm';
import {
  ActionDto,
  ActionEventDto,
  CreateActionDto,
  CreateActionEventDto,
  GlobalFeedItemType,
  UserActionRelation,
} from '../src/actions/dto/action.dto';
import {
  ActionEvent,
  ActionStatus,
} from '../src/actions/entities/action-event.entity';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from '../src/actions/entities/action.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { User } from '../src/user/entities/user.entity';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { ContractEventType } from 'src/user/entities/contract-event.entity';
import type { Community } from '../src/community/entities/community.entity';
import type { Form } from 'src/tasks/entities/form.entity';
import type { FormResponse } from 'src/tasks/entities/formresponse.entity';

describe('Actions (e2e)', () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let userService: UserService;
  let contractService: ContractService;
  let userRepo: Repository<User>;
  let notifRepo: Repository<Notification>;
  let activityRepo: Repository<ActionActivity>;
  let communityRepo: Repository<Community>;
  let formRepo: Repository<Form>;
  let formResponseRepo: Repository<FormResponse>;
  let outsiderToken: string;

  const createPublishedAction = async (
    name: string,
    options: {
      status?: ActionStatus;
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
        visibilityMode: VisibilityMode.Public,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
        ...options.actionOverrides,
      }),
    );

    const event = await eventRepo.save(
      eventRepo.create({
        title: `${name} launch`,
        description: 'Action live',
        newStatus: options.status ?? ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
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
    contractService = ctx.app.get(ContractService);
    userRepo = ctx.dataSource.getRepository(User);
    notifRepo = ctx.dataSource.getRepository(Notification);
    activityRepo = ctx.dataSource.getRepository(
      'ActionActivity',
    ) as Repository<ActionActivity>;
    communityRepo = ctx.dataSource.getRepository(
      'Community',
    ) as Repository<Community>;
    formRepo = ctx.dataSource.getRepository('Form') as Repository<Form>;
    formResponseRepo = ctx.dataSource.getRepository(
      'FormResponse',
    ) as Repository<FormResponse>;

    // Create test action with MemberAction status
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      body: 'Test action for forum tests',
      taskContents: 'Test action for forum tests',
      visibilityMode: VisibilityMode.Public,
      cohortExpression: {
        type: 'Tag',
        tagId: ctx.defaultTag.id,
      },
    });

    testDraftAction = actionRepo.create({
      name: 'Test Draft Action',
      category: 'Test',
      body: 'Test action for forum tests',
      visibilityMode: VisibilityMode.Public,
      cohortExpression: {
        type: 'Tag',
        tagId: ctx.defaultTag.id,
      },
    });

    await actionRepo.save(testAction);
    await actionRepo.save(testDraftAction);

    // Create event to set status for testAction to MemberAction
    const gatheringEvent = eventRepo.create({
      title: 'Action Started',
      description: 'Action is now in gathering commitments phase',
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      action: testAction,
    });
    await eventRepo.save(gatheringEvent);

    // testDraftAction has no events, so it defaults to Draft status

    const defaultUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });
    await contractService.signContract({
      userId: defaultUser.id,
      signedName: 'Test Name',
      contractId: ctx.defaultContractId,
    });

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

    await createPublishedAction(
      'Group Restricted Action',
      {
        status: ActionStatus.MemberAction,
        actionOverrides: {
          visibilityMode: VisibilityMode.Public,
          cohortExpression: {
            type: 'Tag',
            tagId: ctx.defaultTag.id,
          },
        },
      },
    );

    await createPublishedAction('Group Restricted Hidden Action', {
      status: ActionStatus.MemberAction,
      actionOverrides: {
        visibilityMode: VisibilityMode.ParticipatingGroups,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
      },
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
        visibilityMode: VisibilityMode.Public,
        type: ActionTaskType.Activity,
        isContractSigningAction: false,
        everyoneShouldComplete: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: false,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        onboarding: false,
        latestMemberActionEvent: {
          event: null,
          deadline: null,
        },
        followUpForms: [],
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

    it('user is shown their own relation to an action', async () => {
      const action = await actionRepo.findOneBy({
        name: 'Test Action',
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(201);

      const res2 = await request(ctx.app.getHttpServer())
        .get(`/actions/myStatus/${action!.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.relation).toBe(UserActionRelation.Completed);
    });

    it('user can see their action activities', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/myActivity')
        .set('Authorization', `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].type).toBe(ActionActivityType.USER_COMPLETED);
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
      expect(res.body.length).toBe(1);
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

    it('returns canParticipate=true for manual cohort members and false otherwise', async () => {
      const cohortMember = await userService.create({
        email: `cohort-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Cohort Member',
      });

      const nonCohortUser = await userService.create({
        email: `noncohort-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Non Cohort User',
      });

      const manualAction = await actionRepo.save(
        actionRepo.create({
          name: `Manual Cohort Action ${Date.now()}`,
          category: 'Test',
          body: 'Manual cohort body',
          shortDescription: 'Manual cohort short description',
          taskContents: 'Manual cohort task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'Manual',
            userIds: [cohortMember.id],
          },
        }),
      );

      const manualActionEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Manual cohort launch',
          description: 'Manual cohort action live',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: manualAction,
        }),
      );

      const cohortToken = ctx.jwtService.sign(
        {
          sub: cohortMember.id,
          email: cohortMember.email,
          name: cohortMember.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const nonCohortToken = ctx.jwtService.sign(
        {
          sub: nonCohortUser.id,
          email: nonCohortUser.email,
          name: nonCohortUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [cohortRes, nonCohortRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${cohortToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${nonCohortToken}`)
          .expect(200),
      ]);

      const findManualAction = (res: request.Response) =>
        res.body.find((action: ActionDto) => action.id === manualAction.id);

      const cohortAction = findManualAction(cohortRes);
      const nonCohortAction = findManualAction(nonCohortRes);

      expect(cohortAction).toBeDefined();
      expect(cohortAction.canParticipate).toBe(true);
      expect(cohortAction.shouldParticipate).toBe(true);
      expect(nonCohortAction).toBeDefined();
      expect(nonCohortAction.canParticipate).toBe(false);
      expect(nonCohortAction.shouldParticipate).toBe(false);

      await eventRepo.delete(manualActionEvent.id);
      await actionRepo.delete(manualAction.id);
      await userRepo.delete(cohortMember.id);
      await userRepo.delete(nonCohortUser.id);
    });

    it('evaluates CompletedAction cohort expression against real activity data', async () => {
      // Create a prerequisite action that users will "complete"
      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `Prerequisite Action ${Date.now()}`,
          category: 'Test',
          body: 'Prerequisite body',
          taskContents: 'Prerequisite task',
          visibilityMode: VisibilityMode.Public,
        }),
      );

      const completedUser = await userService.create({
        email: `completed-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Completed User',
      });

      const incompleteUser = await userService.create({
        email: `incomplete-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Incomplete User',
      });

      // Create activity records: completedUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: completedUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );
      // incompleteUser has no activity (has not completed the prerequisite)

      // Create action with CompletedAction cohort expression
      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `CompletedAction Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'CompletedAction',
            actionId: prerequisiteAction.id,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const completedToken = ctx.jwtService.sign(
        {
          sub: completedUser.id,
          email: completedUser.email,
          name: completedUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );
      const incompleteToken = ctx.jwtService.sign(
        {
          sub: incompleteUser.id,
          email: incompleteUser.email,
          name: incompleteUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [completedRes, incompleteRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${completedToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${incompleteToken}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(completedRes)?.canParticipate).toBe(true);
      expect(findTarget(completedRes)?.shouldParticipate).toBe(true);
      expect(findTarget(incompleteRes)?.canParticipate).toBe(false);
      expect(findTarget(incompleteRes)?.shouldParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(completedUser.id);
      await userRepo.delete(incompleteUser.id);
    });

    it('evaluates InProgressAction cohort expression against real activity data', async () => {
      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `InProgress Prereq ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          cohortExpression: {
            type: 'Tag',
            tagId: ctx.defaultTag.id,
          },
        }),
      );
      await eventRepo.save(
        eventRepo.create({
          title: 'Prerequisite Launch',
          description: 'Prerequisite',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: prerequisiteAction,
        }),
      );

      const inProgressUser = await userService.create({
        email: `inprogress-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'In Progress User',
        tags: [ctx.defaultTag],
      });

      const doneUser = await userService.create({
        email: `done-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Done User',
        tags: [ctx.defaultTag],
      });

      const neverJoinedUser = await userService.create({
        email: `neverjoined-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Never Joined User',
      });

      // inProgressUser is in the cohort (has defaultTag) but has NOT completed
      // (no activity record needed - being in cohort without completion = in progress)

      // doneUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: doneUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `InProgressAction Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'InProgressAction',
            actionId: prerequisiteAction.id,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [inProgressRes, doneRes, neverJoinedRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(inProgressUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(doneUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(neverJoinedUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // In-progress user should be in cohort
      expect(findTarget(inProgressRes)?.canParticipate).toBe(true);
      expect(findTarget(inProgressRes)?.shouldParticipate).toBe(true);
      // Completed user should NOT be in cohort (no longer in progress)
      expect(findTarget(doneRes)?.canParticipate).toBe(false);
      // Never joined user should NOT be in cohort
      expect(findTarget(neverJoinedRes)?.canParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(inProgressUser.id);
      await userRepo.delete(doneUser.id);
      await userRepo.delete(neverJoinedUser.id);
    });

    it('evaluates GroupLead cohort expression against real community data', async () => {
      const leaderUser = await userService.create({
        email: `leader-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Leader User',
      });

      const nonLeaderUser = await userService.create({
        email: `nonleader-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Non Leader User',
      });

      const community = await communityRepo.save(
        communityRepo.create({
          name: `Cohort Test Community ${Date.now()}`,
          leaders: [leaderUser],
          users: [leaderUser, nonLeaderUser],
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `GroupLead Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'GroupLead',
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [leaderRes, nonLeaderRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(leaderUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(nonLeaderUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(leaderRes)?.canParticipate).toBe(true);
      expect(findTarget(leaderRes)?.shouldParticipate).toBe(true);
      expect(findTarget(nonLeaderRes)?.canParticipate).toBe(false);
      expect(findTarget(nonLeaderRes)?.shouldParticipate).toBe(false);

      // Cleanup
      await communityRepo.delete(community.id);
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await userRepo.delete(leaderUser.id);
      await userRepo.delete(nonLeaderUser.id);
    });

    it('evaluates FormFieldValue cohort expression against real form response data', async () => {
      const respondedUser = await userService.create({
        email: `responded-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Responded User',
      });

      const wrongAnswerUser = await userService.create({
        email: `wronganswer-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Wrong Answer User',
      });

      const noResponseUser = await userService.create({
        email: `noresponse-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'No Response User',
      });

      // Create a form
      const form = await formRepo.save(
        formRepo.create({
          title: 'Cohort Test Form',
          schema: {
            title: 'Cohort Test Form',
            pages: [
              {
                id: 'page-1',
                fields: [
                  {
                    id: 'favorite-color',
                    kind: 'text',
                    label: 'Favorite Color',
                    required: true,
                  },
                ],
              },
            ],
            outputViews: [],
          },
        }),
      );

      // respondedUser answered "blue"
      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: respondedUser,
          answers: { 'favorite-color': 'blue' },
          schemaSnapshot: form.schema,
        }),
      );

      // wrongAnswerUser answered "red"
      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: wrongAnswerUser,
          answers: { 'favorite-color': 'red' },
          schemaSnapshot: form.schema,
        }),
      );

      // Test responseEqualTo filter
      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `FormField Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'FormFieldValue',
            formId: form.id,
            fieldId: 'favorite-color',
            responseEqualTo: 'blue',
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [respondedRes, wrongRes, noResponseRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(respondedUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(wrongAnswerUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(noResponseUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // User who answered "blue" should be in cohort
      expect(findTarget(respondedRes)?.canParticipate).toBe(true);
      expect(findTarget(respondedRes)?.shouldParticipate).toBe(true);
      // User who answered "red" should NOT be in cohort
      expect(findTarget(wrongRes)?.canParticipate).toBe(false);
      // User who never responded should NOT be in cohort
      expect(findTarget(noResponseRes)?.canParticipate).toBe(false);

      // Cleanup
      await formResponseRepo.delete({ formId: form.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await formRepo.delete(form.id);
      await userRepo.delete(respondedUser.id);
      await userRepo.delete(wrongAnswerUser.id);
      await userRepo.delete(noResponseUser.id);
    });

    it('evaluates FormFieldValue with responseAny=true matches any response', async () => {
      const respondedUser = await userService.create({
        email: `anyresp-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Any Response User',
      });

      const noResponseUser = await userService.create({
        email: `noresp2-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'No Response User 2',
      });

      const form = await formRepo.save(
        formRepo.create({
          title: 'Any Response Test',
          schema: {
            title: 'Any Response Test',
            pages: [
              {
                id: 'page-1',
                fields: [
                  {
                    id: 'field-1',
                    kind: 'text',
                    label: 'Field 1',
                    required: true,
                  },
                ],
              },
            ],
            outputViews: [],
          },
        }),
      );

      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: respondedUser,
          answers: { 'field-1': 'anything' },
          schemaSnapshot: form.schema,
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `FormField Any Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: 'FormFieldValue',
            formId: form.id,
            fieldId: 'field-1',
            responseAny: true,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [respondedRes, noResponseRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(respondedUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(noResponseUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(respondedRes)?.canParticipate).toBe(true);
      expect(findTarget(noResponseRes)?.canParticipate).toBe(false);

      // Cleanup
      await formResponseRepo.delete({ formId: form.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await formRepo.delete(form.id);
      await userRepo.delete(respondedUser.id);
      await userRepo.delete(noResponseUser.id);
    });

    it('evaluates AND cohort expression combining multiple conditions', async () => {
      // Create a user who is both a leader AND completed an action
      const bothUser = await userService.create({
        email: `both-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Both Conditions User',
      });

      const leaderOnlyUser = await userService.create({
        email: `leaderonly-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Leader Only User',
      });

      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `AND Prereq ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
        }),
      );

      // bothUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: bothUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      // Both users are leaders
      const community = await communityRepo.save(
        communityRepo.create({
          name: `AND Test Community ${Date.now()}`,
          leaders: [bothUser, leaderOnlyUser],
          users: [bothUser, leaderOnlyUser],
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `AND Cohort ${Date.now()}`,
          category: 'Test',
          body: 'Body',
          taskContents: 'Task',
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          everyoneShouldComplete: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            op: 'AND',
            children: [
              { type: 'GroupLead' },
              { type: 'CompletedAction', actionId: prerequisiteAction.id },
            ],
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: 'Launch',
          description: 'Go',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [bothRes, leaderOnlyRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(bothUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${makeToken(leaderOnlyUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // User who is leader AND completed action should be in cohort
      expect(findTarget(bothRes)?.canParticipate).toBe(true);
      // User who is only a leader should NOT be in cohort
      expect(findTarget(leaderOnlyRes)?.canParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await communityRepo.delete(community.id);
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(bothUser.id);
      await userRepo.delete(leaderOnlyUser.id);
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
        tags: [ctx.defaultTag],
      });

      const lateSigner = await userService.create({
        email: `late-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Late Signer',
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(event.date.getTime() + 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      const eligibleUser = await userService.create({
        email: `eligible-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Eligible User',
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(event.date.getTime() - 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
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
        tags: [ctx.defaultTag],
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
        newStatus: ActionStatus.Resolution,
        date: new Date(),
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
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000), // 1 second ago
        };

        res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(newEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction);
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
        });
        await actionRepo.save(newAction);

        // Add first event (older)
        const firstEvent: CreateActionEventDto = {
          title: 'Launch',
          description: 'Action launched',
          newStatus: ActionStatus.OfficeAction,
          date: new Date(Date.now() - 3600000), // 1 hour ago
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
        });
        await actionRepo.save(newAction);

        // Add past event
        const pastEvent: CreateActionEventDto = {
          title: 'Launch',
          description: 'Action launched',
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 3600000), // 1 hour ago
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
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send(futureEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction); // Should still be the past event's status
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
      //       newStatus: ActionStatus.MemberAction,
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
            newStatus: ActionStatus.MemberAction,
            date: new Date(now - 14400000), // 4 hours ago
          },
          {
            title: 'Office Action Start',
            newStatus: ActionStatus.OfficeAction,
            date: new Date(now - 3600000), // 1 hour ago (most recent past)
          },
          {
            title: 'Planned Phase',
            newStatus: ActionStatus.Planned,
            date: new Date(now - 7200000), // 2 hours ago
          },
        ];

        for (const event of events) {
          const eventDto: CreateActionEventDto = {
            title: event.title,
            description: `Event: ${event.title}`,
            newStatus: event.newStatus,
            date: event.date,
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
        expect(res.body.status).toBe(ActionStatus.OfficeAction); // Most recent past event
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

  describe('Additional endpoints', () => {
    it('allows a user to opt out of completing an action', async () => {
      const { action } = await createPublishedAction('Optout Scenario', {
        status: ActionStatus.MemberAction,
      });

      const optout = await request(ctx.app.getHttpServer())
        .post(`/actions/optout/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ reason: 'Out of time', outOfTime: true, actionId: action.id })
        .expect(201);

      expect(optout.body.type).toBe(ActionActivityType.USER_WONT_COMPLETE);
      await actionRepo.delete(action.id);
    });

    it('records a completion activity for a user', async () => {
      const { action } = await createPublishedAction('Completion Scenario', {
        status: ActionStatus.MemberAction,
      });

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
      const { action } = await createPublishedAction('Activities Scenario', {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      const activities = await request(ctx.app.getHttpServer())
        .get(`/actions/${action.id}/activities`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(activities.body.length).toBeGreaterThan(0);

      const single = await request(ctx.app.getHttpServer())
        .get(`/actions/activities/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
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

    it('shows draft actions to admins', async () => {
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
        { status: ActionStatus.MemberAction },
      );
      const friend = await userService.create({
        name: 'Friend User',
        email: `friend-${Date.now()}@example.com`,
        password: 'Password123!',
        tags: [ctx.defaultTag],
      });

      await userService.makeFriendsAutomated(ctx.testUserId, friend.id);

      const friendToken = ctx.jwtService.sign({
        sub: friend.id,
        email: friend.email,
        name: friend.name,
      });

      await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
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
        { status: ActionStatus.MemberAction },
      );

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

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

    it('notifies activity owners when their updates receive likes', async () => {
      const { action } = await createPublishedAction('Activity Like Notice', {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `activity_like:${activityId}`,
        },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].message).toBe(
        'Test Admin liked your completion of: Activity Like Notice',
      );
      expect(likeNotifs[0].webAppLocation).toBe(
        `/actions/${action.id}/activity/${activityId}`,
      );

      await actionRepo.delete(action.id);
    });

    it('removes the like notification when the sole liker unlikes', async () => {
      const { action } = await createPublishedAction('Activity Sole Unlike', {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `activity_like:${activityId}`,
        },
      });

      expect(likeNotifs).toHaveLength(0);

      await actionRepo.delete(action.id);
    });

    it('decrements the like notification when one of multiple likers unlikes', async () => {
      const { action } = await createPublishedAction(
        'Activity Partial Unlike',
        { status: ActionStatus.MemberAction },
      );

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      const secondLiker = await userService.create({
        email: `second-liker-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Second Liker',
        tags: [ctx.defaultTag],
      });
      const secondLikerToken = ctx.jwtService.sign(
        {
          sub: secondLiker.id,
          email: secondLiker.email,
          name: secondLiker.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set('Authorization', `Bearer ${secondLikerToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set('Authorization', `Bearer ${secondLikerToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `activity_like:${activityId}`,
        },
        relations: { associatedUsers: true },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].groupingCount).toBe(1);
      expect(likeNotifs[0].associatedUsers).toHaveLength(1);
      expect(likeNotifs[0].associatedUsers?.[0].id).toBe(ctx.adminUserId);
      expect(likeNotifs[0].message).toBe(
        'Test Admin liked your completion of: Activity Partial Unlike',
      );

      await userRepo.delete(secondLiker.id);
      await actionRepo.delete(action.id);
    });
  });

  describe('Global feed', () => {
    let activeUser: User | null = null;
    let suspendedUser: User | null = null;

    afterEach(async () => {
      if (activeUser) {
        await userRepo.delete(activeUser.id);
        activeUser = null;
      }
      if (suspendedUser) {
        await userRepo.delete(suspendedUser.id);
        suspendedUser = null;
      }
    });

    it('excludes suspended members from new member feed items', async () => {
      const now = Date.now();

      activeUser = await userService.create({
        email: `active-${now}@example.com`,
        password: 'Password123!',
        name: 'Active Member',
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 60_000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
      });

      suspendedUser = await userService.create({
        email: `suspended-${now}@example.com`,
        password: 'Password123!',
        name: 'Suspended Member',
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 120_000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
          {
            type: ContractEventType.SUSPENDED,
            date: new Date(now - 30_000),
            automatic: false,
          },
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/globalFeed')
        .query({ limit: 20 })
        .expect(200);

      const newMembersItem = res.body.find(
        (item) => item.type === GlobalFeedItemType.NewMembers,
      );

      expect(newMembersItem).toBeDefined();
      const newMemberIds = newMembersItem.newMembers.users.map(
        (user) => user.id,
      );

      expect(newMemberIds).toContain(activeUser.id);
      expect(newMemberIds).not.toContain(suspendedUser.id);
    });
  });

  describe('Action Ordering in /actions/loggedIn', () => {
    let orderingActions: Action[] = [];

    afterEach(async () => {
      for (const action of orderingActions) {
        await actionRepo.delete(action.id);
      }
      orderingActions = [];
    });

    const createOrderingAction = async (
      name: string,
      options: {
        events?: Array<{ status: ActionStatus; date: Date }>;
        priority?: number;
      } = {},
    ) => {
      const action = await actionRepo.save(
        actionRepo.create({
          name,
          category: 'Test',
          body: 'Ordering test action',
          taskContents: 'Ordering test task',
          shortDescription: `${name} short description`,
          visibilityMode: VisibilityMode.Public,
          priority: options.priority ?? 0,
        }),
      );
      orderingActions.push(action);

      if (options.events) {
        for (const evt of options.events) {
          await eventRepo.save(
            eventRepo.create({
              title: `${name} - ${evt.status}`,
              description: 'Event for ordering test',
              newStatus: evt.status,
              date: evt.date,
              action,
            }),
          );
        }
      }

      return action;
    };

    // Helper to get relative order of test actions only (filtering out other actions)
    const getRelativeOrder = (
      allActionIds: number[],
      testActionIds: number[],
    ): number[] => {
      return allActionIds.filter((id) => testActionIds.includes(id));
    };

    it('orders actions with deadlines before actions without deadlines', async () => {
      const now = Date.now();

      // Action with no deadline (only past MemberAction, no event after it)
      const noDeadlineAction = await createOrderingAction('No Deadline', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) },
        ],
      });

      // Action with a deadline (MemberAction + Resolution event after it)
      const hasDeadlineAction = await createOrderingAction('Has Deadline', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 3600000) }, // future deadline
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [noDeadlineAction.id, hasDeadlineAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(hasDeadlineAction.id);
      expect(orderedTestActions).toContain(noDeadlineAction.id);
      // Action with deadline should come before action without deadline
      expect(orderedTestActions.indexOf(hasDeadlineAction.id)).toBeLessThan(
        orderedTestActions.indexOf(noDeadlineAction.id),
      );
    });

    it('orders actions by soonest deadline first', async () => {
      const now = Date.now();

      // Action with later deadline
      const laterDeadlineAction = await createOrderingAction('Later Deadline', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 7200000) }, // deadline 2 hours from now
        ],
      });

      // Action with sooner deadline
      const soonerDeadlineAction = await createOrderingAction(
        'Sooner Deadline',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            }, // past MemberAction
            { status: ActionStatus.Resolution, date: new Date(now + 1800000) }, // deadline 30 min from now
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [laterDeadlineAction.id, soonerDeadlineAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(soonerDeadlineAction.id);
      expect(orderedTestActions).toContain(laterDeadlineAction.id);
      // Sooner deadline should come before later deadline
      expect(orderedTestActions.indexOf(soonerDeadlineAction.id)).toBeLessThan(
        orderedTestActions.indexOf(laterDeadlineAction.id),
      );
    });

    it('orders actions with past member action events before actions without them (when no future events)', async () => {
      const now = Date.now();

      // Action with past OfficeAction only (no MemberAction)
      const noMemberActionAction = await createOrderingAction(
        'No Member Action',
        {
          events: [
            {
              status: ActionStatus.OfficeAction,
              date: new Date(now - 3600000),
            },
          ],
        },
      );

      // Action with past member action event
      const memberActionAction = await createOrderingAction(
        'Past Member Action',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            },
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [noMemberActionAction.id, memberActionAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(memberActionAction.id);
      expect(orderedTestActions).toContain(noMemberActionAction.id);
      // Member action should come before no member action
      expect(orderedTestActions.indexOf(memberActionAction.id)).toBeLessThan(
        orderedTestActions.indexOf(noMemberActionAction.id),
      );
    });

    it('orders actions by most recent past member action event first', async () => {
      const now = Date.now();

      // Action with older member action event
      const olderAction = await createOrderingAction('Older Member Action', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 7200000) }, // 2 hours ago
        ],
      });

      // Action with more recent member action event
      const newerAction = await createOrderingAction('Newer Member Action', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 1800000) }, // 30 min ago
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [olderAction.id, newerAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(newerAction.id);
      expect(orderedTestActions).toContain(olderAction.id);
      // Newer action should come before older action
      expect(orderedTestActions.indexOf(newerAction.id)).toBeLessThan(
        orderedTestActions.indexOf(olderAction.id),
      );
    });

    it('uses priority as final tiebreaker (lower number = higher priority)', async () => {
      const now = Date.now();
      const sameEventDate = new Date(now - 3600000);

      // Lower priority (higher number)
      const lowPriorityAction = await createOrderingAction('Low Priority', {
        events: [{ status: ActionStatus.MemberAction, date: sameEventDate }],
        priority: 10,
      });

      // Higher priority (lower number)
      const highPriorityAction = await createOrderingAction('High Priority', {
        events: [{ status: ActionStatus.MemberAction, date: sameEventDate }],
        priority: 1,
      });

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [lowPriorityAction.id, highPriorityAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(highPriorityAction.id);
      expect(orderedTestActions).toContain(lowPriorityAction.id);
      // High priority should come before low priority
      expect(orderedTestActions.indexOf(highPriorityAction.id)).toBeLessThan(
        orderedTestActions.indexOf(lowPriorityAction.id),
      );
    });

    it('maintains correct ordering with mixed deadlines, past member actions, and priority', async () => {
      const now = Date.now();

      // 1. Action with soonest deadline (should be first)
      const soonestDeadline = await createOrderingAction('Soonest Deadline', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 1800000) }, // deadline 30 min from now
        ],
        priority: 5,
      });

      // 2. Action with later deadline (should be second)
      const laterDeadline = await createOrderingAction('Later Deadline', {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 3600000) }, // deadline 1 hour from now
        ],
        priority: 1,
      });

      // 3. Action with recent past member action but no deadline (should be third)
      const recentPastNoDeadline = await createOrderingAction(
        'Recent Past No Deadline',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 1800000),
            }, // 30 min ago
          ],
          priority: 5,
        },
      );

      // 4. Action with older past member action but no deadline (should be fourth)
      const olderPastNoDeadline = await createOrderingAction(
        'Older Past No Deadline',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 7200000),
            }, // 2 hours ago
          ],
          priority: 1,
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [
        soonestDeadline.id,
        laterDeadline.id,
        recentPastNoDeadline.id,
        olderPastNoDeadline.id,
      ];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions.length).toBe(4);

      const soonestDeadlineIdx = orderedTestActions.indexOf(soonestDeadline.id);
      const laterDeadlineIdx = orderedTestActions.indexOf(laterDeadline.id);
      const recentPastIdx = orderedTestActions.indexOf(recentPastNoDeadline.id);
      const olderPastIdx = orderedTestActions.indexOf(olderPastNoDeadline.id);

      // Actions with deadlines come before actions without deadlines
      expect(soonestDeadlineIdx).toBeLessThan(recentPastIdx);
      expect(laterDeadlineIdx).toBeLessThan(recentPastIdx);

      // Soonest deadline comes before later deadline
      expect(soonestDeadlineIdx).toBeLessThan(laterDeadlineIdx);

      // Recent past member action comes before older past member action
      expect(recentPastIdx).toBeLessThan(olderPastIdx);
    });

    it('correctly sorts by MemberAction date when neither action has a deadline', async () => {
      const now = Date.now();

      // Action with older MemberAction (no deadline - Resolution is in the past)
      const olderMemberAction = await createOrderingAction(
        'Older MemberAction',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 10800000),
            }, // 3h ago
            { status: ActionStatus.Resolution, date: new Date(now - 1800000) }, // 30min ago (past, not a deadline)
          ],
        },
      );

      // Action with more recent MemberAction (no deadline)
      const newerMemberAction = await createOrderingAction(
        'Newer MemberAction',
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            }, // 1h ago
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn?sorted=true')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [olderMemberAction.id, newerMemberAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(newerMemberAction.id);
      expect(orderedTestActions).toContain(olderMemberAction.id);
      // The action with more recent MemberAction should come first
      expect(orderedTestActions.indexOf(newerMemberAction.id)).toBeLessThan(
        orderedTestActions.indexOf(olderMemberAction.id),
      );
    });
  });

  describe('Onboarding action canParticipate', () => {
    let onboardingAction: Action;
    let existingUser: User;
    let newUser: User;
    let existingUserToken: string;
    let newUserToken: string;

    beforeAll(async () => {
      const actionEventDate = new Date(Date.now() - 3600000); // 1 hour ago

      onboardingAction = await actionRepo.save(
        actionRepo.create({
          name: `Onboarding Eligibility Test ${Date.now()}`,
          category: 'Test',
          body: 'Onboarding action body',
          shortDescription: 'Onboarding short desc',
          taskContents: 'Onboarding task',
          visibilityMode: VisibilityMode.Public,
          priority: 0,
          preventCompletion: false,
          type: ActionTaskType.Activity,
          onboarding: true,
          everyoneShouldComplete: true,
          cohortExpression: {
            type: 'Tag',
            tagId: ctx.defaultTag.id,
          },
        }),
      );

      await eventRepo.save(
        eventRepo.create({
          title: 'Onboarding launch',
          description: 'Onboarding action live',
          newStatus: ActionStatus.MemberAction,
          date: actionEventDate,
          action: onboardingAction,
        }),
      );

      // Existing user: signed contract BEFORE the action event
      existingUser = await userService.create({
        email: `existing-onboard-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Existing User',
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(actionEventDate.getTime() - 86400000), // 1 day before action
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      // New user: signed contract AFTER the action event
      newUser = await userService.create({
        email: `new-onboard-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'New User',
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(actionEventDate.getTime() + 1000), // after action event
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      existingUserToken = ctx.jwtService.sign(
        {
          sub: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      newUserToken = ctx.jwtService.sign(
        {
          sub: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );
    });

    afterAll(async () => {
      if (onboardingAction?.id) await actionRepo.delete(onboardingAction.id);
      if (existingUser?.id) await userRepo.delete(existingUser.id);
      if (newUser?.id) await userRepo.delete(newUser.id);
    });

    it('loggedIn endpoint returns canParticipate=false for existing users on onboarding actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn')
        .set('Authorization', `Bearer ${existingUserToken}`)
        .expect(200);

      const action = res.body.find(
        (a: ActionDto) => a.id === onboardingAction.id,
      );
      expect(action).toBeDefined();
      expect(action.canParticipate).toBe(false);
    });

    it('loggedIn endpoint returns canParticipate=true for new users on onboarding actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/actions/loggedIn')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      const action = res.body.find(
        (a: ActionDto) => a.id === onboardingAction.id,
      );
      expect(action).toBeDefined();
      expect(action.canParticipate).toBe(true);
    });

    it('individual action endpoint returns canParticipate=false for existing users on onboarding actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${onboardingAction.id}`)
        .set('Authorization', `Bearer ${existingUserToken}`)
        .expect(200);

      expect(res.body.canParticipate).toBe(false);
    });

    it('individual action endpoint returns canParticipate=true for new users on onboarding actions', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${onboardingAction.id}`)
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(res.body.canParticipate).toBe(true);
    });

    it('non-onboarding action still returns canParticipate=true for existing users', async () => {
      const { action: normalAction } = await createPublishedAction(
        'Normal Action For Onboarding Check',
        {
          status: ActionStatus.MemberAction,
          actionOverrides: { onboarding: false },
        },
      );

      const [loggedInRes, slugRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get('/actions/loggedIn')
          .set('Authorization', `Bearer ${existingUserToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get(`/actions/slug/${normalAction.id}`)
          .set('Authorization', `Bearer ${existingUserToken}`)
          .expect(200),
      ]);

      const fromList = loggedInRes.body.find(
        (a: ActionDto) => a.id === normalAction.id,
      );
      expect(fromList).toBeDefined();
      expect(fromList.canParticipate).toBe(true);
      expect(slugRes.body.canParticipate).toBe(true);

      await actionRepo.delete(normalAction.id);
    });
  });

  afterAll(async () => {
    await actionRepo.query('DELETE FROM action');
    await ctx.app.close();
  });
});
