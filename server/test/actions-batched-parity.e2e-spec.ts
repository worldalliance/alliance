import { ActionsService } from '../src/actions/actions.service';
import {
  ActionEvent,
  ActionStatus,
} from '../src/actions/entities/action-event.entity';
import {
  Action,
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
import { createTestApp, TestContext } from './e2e-test-utils';

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

describe('Batched vs single method parity (e2e)', () => {
  let ctx: TestContext;
  let actionsService: ActionsService;
  let _contractService: ContractService;
  let userService: UserService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let _userRepo: Repository<User>;

  let userA: User;
  let userB: User;
  let userC: User;

  const baseDate = new Date('2023-06-01T00:00:00Z');

  /** Helper: create an action with a MemberAction event and optional deadline */
  const createActionWithEvents = async (
    name: string,
    opts: {
      addDeadline?: boolean;
      cohortExpression?: Record<string, unknown>;
    } = {},
  ) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: 'Parity Test',
        body: 'Body',
        taskContents: 'Tasks',
        shortDescription: `${name} short`,
        visibilityMode: VisibilityMode.Public,
        cohortExpression: opts.cohortExpression ?? {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
      }),
    );

    await eventRepo.save(
      eventRepo.create({
        title: `${name} member`,
        description: 'Member phase',
        newStatus: ActionStatus.MemberAction,
        date: baseDate,
        action,
      }),
    );

    if (opts.addDeadline) {
      await eventRepo.save(
        eventRepo.create({
          title: `${name} completed`,
          description: 'Completed',
          newStatus: ActionStatus.Completed,
          date: addDays(baseDate, 7),
          action,
        }),
      );
    }

    return action;
  };

  /** Reload an action with the relations needed by the singular method */
  const reloadAction = (actionId: number) =>
    actionRepo.findOneOrFail({
      where: { id: actionId },
      relations: { events: true, activities: true },
    });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionsService = ctx.app.get(ActionsService);
    _contractService = ctx.app.get(ContractService);
    userService = ctx.app.get(UserService);

    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    _userRepo = ctx.dataSource.getRepository(User);

    const contractSignedAt = new Date('2023-01-01T00:00:00Z');

    userA = await userService.create({
      email: 'parity-a@example.com',
      password: 'Password123!',
      name: 'Parity User A',
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

    userB = await userService.create({
      email: 'parity-b@example.com',
      password: 'Password123!',
      name: 'Parity User B',
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

    userC = await userService.create({
      email: 'parity-c@example.com',
      password: 'Password123!',
      name: 'Parity User C',
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
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('should return identical results for a simple action', async () => {
    const action = await createActionWithEvents('Simple Parity');
    const loaded = await reloadAction(action.id);

    const singleResult = await actionsService.findJoinedUsersForAction(loaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([loaded]);

    expect(batchResult.get(loaded.id)!.sort()).toEqual(singleResult.sort());
  });

  it('should return identical results with a deadline event', async () => {
    const action = await createActionWithEvents('Deadline Parity', {
      addDeadline: true,
    });
    const loaded = await reloadAction(action.id);

    const singleResult = await actionsService.findJoinedUsersForAction(loaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([loaded]);

    expect(batchResult.get(loaded.id)!.sort()).toEqual(singleResult.sort());
  });

  it('should return identical results with completion activities', async () => {
    const action = await createActionWithEvents('Completion Parity');
    const loaded = await reloadAction(action.id);

    await activityRepo.save(
      activityRepo.create({
        actionId: loaded.id,
        userId: userA.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

    const reloaded = await reloadAction(action.id);
    const singleResult =
      await actionsService.findJoinedUsersForAction(reloaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([reloaded]);

    expect(batchResult.get(reloaded.id)!.sort()).toEqual(singleResult.sort());
  });

  it('should return identical results with withdrawal activities', async () => {
    const action = await createActionWithEvents('Withdrawal Parity');
    const loaded = await reloadAction(action.id);

    await activityRepo.save(
      activityRepo.create({
        actionId: loaded.id,
        userId: userB.id,
        type: ActionActivityType.USER_WONT_COMPLETE,
      }),
    );

    const reloaded = await reloadAction(action.id);
    const singleResult =
      await actionsService.findJoinedUsersForAction(reloaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([reloaded]);

    expect(batchResult.get(reloaded.id)!.sort()).toEqual(singleResult.sort());
  });

  it('should return identical results with both completions and withdrawals', async () => {
    const action = await createActionWithEvents('Mixed Parity', {
      addDeadline: true,
    });
    const loaded = await reloadAction(action.id);

    await activityRepo.save([
      activityRepo.create({
        actionId: loaded.id,
        userId: userA.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
      activityRepo.create({
        actionId: loaded.id,
        userId: userB.id,
        type: ActionActivityType.USER_WONT_COMPLETE,
      }),
    ]);

    const reloaded = await reloadAction(action.id);
    const singleResult =
      await actionsService.findJoinedUsersForAction(reloaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([reloaded]);

    expect(batchResult.get(reloaded.id)!.sort()).toEqual(singleResult.sort());
  });

  it('should return identical results for multiple actions batched together', async () => {
    const action1 = await createActionWithEvents('Multi Parity 1', {
      addDeadline: true,
    });
    const action2 = await createActionWithEvents('Multi Parity 2');

    await activityRepo.save([
      activityRepo.create({
        actionId: action1.id,
        userId: userC.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
      activityRepo.create({
        actionId: action2.id,
        userId: userA.id,
        type: ActionActivityType.USER_WONT_COMPLETE,
      }),
    ]);

    const loaded1 = await reloadAction(action1.id);
    const loaded2 = await reloadAction(action2.id);

    const single1 = await actionsService.findJoinedUsersForAction(loaded1);
    const single2 = await actionsService.findJoinedUsersForAction(loaded2);

    const batchResult = await actionsService.findJoinedUsersForActions([
      loaded1,
      loaded2,
    ]);

    expect(batchResult.get(loaded1.id)!.sort()).toEqual(single1.sort());
    expect(batchResult.get(loaded2.id)!.sort()).toEqual(single2.sort());
  });

  it('should return empty for action with no MemberAction event', async () => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: 'No MemberAction Parity',
        category: 'Parity Test',
        body: 'Body',
        taskContents: 'Tasks',
        shortDescription: 'No member event',
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: 'Tag', tagId: ctx.defaultTag.id },
      }),
    );

    // Only create an OfficeAction event, no MemberAction
    await eventRepo.save(
      eventRepo.create({
        title: 'Office only',
        description: 'Office phase',
        newStatus: ActionStatus.OfficeAction,
        date: baseDate,
        action,
      }),
    );

    const loaded = await reloadAction(action.id);
    const singleResult = await actionsService.findJoinedUsersForAction(loaded);
    const batchResult =
      await actionsService.findJoinedUsersForActions([loaded]);

    expect(singleResult).toEqual([]);
    expect(batchResult.get(loaded.id)).toEqual([]);
  });
});
