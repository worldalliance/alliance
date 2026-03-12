import { ActionsService } from '../src/actions/actions.service';
import {
  ActionEvent,
  ActionStatus,
} from '../src/actions/entities/action-event.entity';
import { ActionSuite } from '../src/actions/entities/action-suite.entity';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from '../src/actions/entities/action.entity';
import {
  ActionActivity,
  ActionActivityType,
} from '../src/actions/entities/action-activity.entity';
import { ContractEventType } from '../src/user/entities/contract-event.entity';
import { ContractService } from '../src/contract/contract.service';
import { User } from '../src/user/entities/user.entity';
import { UserService } from '../src/user/user.service';
import type { Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestContext } from './e2e-test-utils';

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

describe('findUsersToSuspend (e2e)', () => {
  let ctx: TestContext;
  let actionsService: ActionsService;
  let contractService: ContractService;
  let userService: UserService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let activityRepo: Repository<ActionActivity>;
  let userRepo: Repository<User>;

  let completingUser: User;
  let failingUser: User;
  const now = new Date('2023-04-01T00:00:00Z');

  const createCompletedSuiteAction = async (
    suiteName: string,
    actionName: string,
    baseDate: Date,
  ) => {
    const suite = await suiteRepo.save(
      suiteRepo.create({
        name: suiteName,
      }),
    );

    const action = await actionRepo.save(
      actionRepo.create({
        name: actionName,
        category: 'Suspension Test',
        body: 'Body',
        taskContents: 'Tasks',
        shortDescription: 'Short description',
        commitmentless: true,
        suite,
        everyoneShouldComplete: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        type: ActionTaskType.Activity,
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: `${actionName} office`,
        description: 'Office phase',
        newStatus: ActionStatus.OfficeAction,
        date: baseDate,
        action,
      }),
      eventRepo.create({
        title: `${actionName} member`,
        description: 'Member phase',
        newStatus: ActionStatus.MemberAction,
        date: addDays(baseDate, 1),
        action,
      }),
      eventRepo.create({
        title: `${actionName} done`,
        description: 'Completed',
        newStatus: ActionStatus.Completed,
        date: addDays(baseDate, 2),
        action,
      }),
    ]);

    return action;
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionsService = ctx.app.get(ActionsService);
    contractService = ctx.app.get(ContractService);
    userService = ctx.app.get(UserService);

    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    userRepo = ctx.dataSource.getRepository(User);

    const contractSignedAt = new Date('2023-01-01T00:00:00Z');

    completingUser = await userService.create({
      email: 'suspension-complete@example.com',
      password: 'Password123!',
      name: 'Completing User',
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: contractSignedAt,
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });

    failingUser = await userService.create({
      email: 'suspension-failing@example.com',
      password: 'Password123!',
      name: 'Failing User',
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          contractId: ctx.defaultContractId,
          date: contractSignedAt,
          automatic: false,
        },
      ],
    });

    const actions = await Promise.all([
      createCompletedSuiteAction(
        'Suite One',
        'Action One',
        new Date('2023-01-10T00:00:00Z'),
      ),
      createCompletedSuiteAction(
        'Suite Two',
        'Action Two',
        new Date('2023-02-10T00:00:00Z'),
      ),
      createCompletedSuiteAction(
        'Suite Three',
        'Action Three',
        new Date('2023-03-10T00:00:00Z'),
      ),
    ]);

    await activityRepo.save(
      actions.map((action) =>
        activityRepo.create({
          actionId: action.id,
          userId: completingUser.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      ),
    );
  });

  afterAll(async () => {
    await userRepo.query('DELETE FROM "user"');
    await ctx.app.close();
  });

  it('returns suspension plans from the admin endpoint', async () => {
    const rangeStart = new Date('2023-04-01T00:00:00Z');
    const rangeEnd = new Date('2023-04-02T00:00:00Z');

    const res = await request(ctx.app.getHttpServer())
      .get('/actions/suspendPlans')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .query({
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const [plan] = res.body;
    expect(new Date(plan.date).toISOString()).toBe(rangeStart.toISOString());

    const userIds = plan.users.map((user: { id: number }) => user.id);
    expect(userIds).toContain(failingUser.id);
    expect(userIds).not.toContain(completingUser.id);
  });

  it('does not count a suite as past while still in its member action window', async () => {
    // Create a 4th suite whose member action has started but deadline is still
    // in the future relative to `now`. Even though the user has already failed
    // two earlier suites, this in-progress suite should not count, so the user
    // should not yet be eligible for suspension.
    const inProgressSuite = await suiteRepo.save(
      suiteRepo.create({ name: 'Suite In-Progress' }),
    );
    const inProgressAction = await actionRepo.save(
      actionRepo.create({
        name: 'Action In-Progress',
        category: 'Suspension Test',
        body: 'Body',
        taskContents: 'Tasks',
        shortDescription: 'Short description',
        commitmentless: true,
        suite: inProgressSuite,
        everyoneShouldComplete: false,
        visibilityMode: VisibilityMode.Public,
        priority: 0,
        preventCompletion: false,
        type: ActionTaskType.Activity,
      }),
    );

    // MemberAction started 1 day before `now`, deadline 5 days after `now`
    await eventRepo.save(
      eventRepo.create({
        title: 'In-Progress member',
        description: 'Member phase',
        newStatus: ActionStatus.MemberAction,
        date: addDays(now, -1),
        action: inProgressAction,
      }),
    );
    await eventRepo.save(
      eventRepo.create({
        title: 'In-Progress done',
        description: 'Completed',
        newStatus: ActionStatus.Completed,
        date: addDays(now, 5),
        action: inProgressAction,
      }),
    );

    // Query at `now` — the in-progress suite deadline hasn't passed,
    // so only the first 3 (fully past) suites should count.
    // failingUser has failed all 3 past suites => still suspended.
    const result = await actionsService.findUsersToSuspend(now);
    expect(result.usersToSuspend.map((u) => u.id)).toEqual([failingUser.id]);

    // Now query at a time where only 2 suites are past and the 3rd suite's
    // deadline hasn't passed yet. Remove suite three's completed event deadline
    // by pushing it into the future so only 2 suites are fully past.
    // Instead, simulate by checking at a date before suite three's deadline:
    // Suite Three: MemberAction at 2023-03-11, Completed at 2023-03-12
    // Check at 2023-03-11T12:00:00Z — between member start and deadline
    const midSuiteThree = new Date('2023-03-11T12:00:00Z');
    const midResult = await actionsService.findUsersToSuspend(midSuiteThree);
    // Only 2 suites are fully past at this point, not enough for suspension
    expect(midResult.usersToSuspend).toHaveLength(0);

    // Clean up the in-progress suite
    await eventRepo.delete({ action: { id: inProgressAction.id } });
    await actionRepo.delete(inProgressAction.id);
    await suiteRepo.delete(inProgressSuite.id);
  });

  it('suspends users who fail three suites and does not re-suspend once inactive or re-signed', async () => {
    const initialRun = await actionsService.findUsersToSuspend(now);

    expect(initialRun.usersToSuspend.map((u) => u.id)).toEqual([
      failingUser.id,
    ]);
    expect(initialRun.suspendReasonKeys.get(failingUser.id)).toContain('s-');
    expect(
      initialRun.usersToSuspend.some((user) => user.id === completingUser.id),
    ).toBe(false);

    await contractService.suspendContract(failingUser.id, true, 'test-auto-key');

    const afterSuspension = await actionsService.findUsersToSuspend(now);
    expect(afterSuspension.usersToSuspend).toHaveLength(0);

    await contractService.signContract({
      userId: failingUser.id,
      signedName: 'Test Name',
      contractId: ctx.defaultContractId,
    });

    const afterResigning = await actionsService.findUsersToSuspend(now);
    expect(afterResigning.usersToSuspend).toHaveLength(0);
  });
});
