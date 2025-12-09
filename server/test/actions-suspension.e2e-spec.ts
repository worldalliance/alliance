import { ActionsService } from '../src/actions/actions.service';
import { ActionEvent, ActionStatus } from '../src/actions/entities/action-event.entity';
import { ActionSuite } from '../src/actions/entities/action-suite.entity';
import { Action, ActionTaskType } from '../src/actions/entities/action.entity';
import {
  ActionActivity,
  ActionActivityType,
} from '../src/actions/entities/action-activity.entity';
import { ContractEventType } from '../src/user/entities/contract-event.entity';
import { User } from '../src/user/entities/user.entity';
import { UserService } from '../src/user/user.service';
import { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

describe('findUsersToSuspend (e2e)', () => {
  let ctx: TestContext;
  let actionsService: ActionsService;
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
        participatingTags: [ctx.defaultTag],
        suite,
        useManualCohort: false,
        everyoneShouldComplete: false,
        showToNonparticipating: true,
        priority: 0,
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

  it('suspends users who fail three suites and does not re-suspend once inactive or re-signed', async () => {
    const initialRun = await actionsService.findUsersToSuspend(now);

    expect(initialRun.usersToSuspend.map((u) => u.id)).toEqual([
      failingUser.id,
    ]);
    expect(initialRun.suspendReasonKeys.get(failingUser.id)).toContain('s-');
    expect(
      initialRun.usersToSuspend.some((user) => user.id === completingUser.id),
    ).toBe(false);

    await userService.suspendContract(failingUser.id, true, 'test-auto-key');

    const afterSuspension = await actionsService.findUsersToSuspend(now);
    expect(afterSuspension.usersToSuspend).toHaveLength(0);

    await userService.signContract(failingUser.id);

    const afterResigning = await actionsService.findUsersToSuspend(now);
    expect(afterResigning.usersToSuspend).toHaveLength(0);
  });
});
