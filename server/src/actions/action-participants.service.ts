import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { User } from "src/user/entities/user.entity";
import { computeIsAwayDuringWindow } from "src/utils/action-user";
import { In, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import {
  findLatestTerminalActivities,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent } from "./entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";

@Injectable()
export class ActionParticipantsService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly userService: UserService,
  ) {}

  async findParticipantIdsForActionById(actionId: number): Promise<number[]> {
    return this.findParticipantIdsForAction(
      await this.findParticipantAction(actionId),
    );
  }

  async findParticipantAction(actionId: number): Promise<ParsedAction> {
    return parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: {
          events: true,
          activities: true,
        },
      }),
    );
  }

  async findParticipantIdsForAction(action: ParsedAction): Promise<number[]> {
    const result = await this.findParticipantIdsForActions([action]);
    return result.get(action.id) ?? [];
  }

  /**
   * The "participants" of an action — source of the persisted
   * `Action.usersJoined` counter (which keeps its legacy wire/DB name for now).
   * The formula:
   *
   *   base recipients (assigned)
   *   − away at any point during the member-action window
   *   − everyone whose latest terminal activity is a withdrawal
   *   + everyone whose latest terminal activity is a completion
   *
   * i.e. "could this user have done it at all?"
   *
   * Batched: fetches the shared data in a handful of bulk queries instead of
   * per-action. Returns a map of actionId -> participant userIds.
   */
  async findParticipantIdsForActions(
    actions: ParsedAction[],
    params: { session?: CohortResolutionSession } = {},
  ): Promise<Map<number, number[]>> {
    const { session = new CohortResolutionSession() } = params;
    // Build entries for actions that have a MemberAction event
    const entries: Array<{ action: ParsedAction; event: ActionEvent }> = [];
    for (const action of actions) {
      const { event } = action.memberActionPhase;
      if (event) {
        entries.push({ action, event });
      }
    }

    if (entries.length === 0) {
      return new Map(actions.map((a) => [a.id, []]));
    }

    const actionIds = entries.map((e) => e.action.id);

    // 1. Batched base users (1 user query, deduplicated cohorts)
    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: entries.map((e) => ({
          action: e.action,
          eventId: e.event.id,
        })),
        session,
      });

    // 2. One query: all completion + withdrawal activities for these actions
    const allActivities = await this.actionActivityRepository.find({
      where: {
        actionId: In(actionIds),
        type: In(TERMINAL_ACTIVITY_TYPES),
      },
    });
    const completionsByAction = new Map<number, number[]>();
    const withdrawalsByAction = new Map<number, Set<number>>();
    for (const act of findLatestTerminalActivities(allActivities)) {
      switch (act.type) {
        case ActionActivityType.USER_COMPLETED:
          if (!completionsByAction.has(act.actionId)) {
            completionsByAction.set(act.actionId, []);
          }
          completionsByAction.get(act.actionId)!.push(act.userId);
          break;
        case ActionActivityType.USER_WONT_COMPLETE:
          if (!withdrawalsByAction.has(act.actionId)) {
            withdrawalsByAction.set(act.actionId, new Set());
          }
          withdrawalsByAction.get(act.actionId)!.add(act.userId);
          break;
        default:
          throw new Error(
            `unknown terminal activity type: ${act.type satisfies never}`,
          );
      }
    }

    // 3. Per-action assembly
    const result = new Map<number, number[]>();
    for (const action of actions) {
      const baseUsers = baseUsersByAction.get(action.id);
      if (!baseUsers) {
        result.set(action.id, []);
        continue;
      }

      const notAwayDuringMemberActionPhase = baseUsers.filter(
        (user) => !computeIsAwayDuringWindow({ action, user }),
      );

      const withdrawals = withdrawalsByAction.get(action.id) ?? new Set();
      const completions = completionsByAction.get(action.id) ?? [];

      const notAwayUsersMinusWithdrawals =
        notAwayDuringMemberActionPhase.filter(
          (user) => !withdrawals.has(user.id),
        );
      const set = new Set([
        ...notAwayUsersMinusWithdrawals.map((user) => user.id),
        ...completions,
      ]);

      result.set(action.id, Array.from(set));
    }

    return result;
  }

  async findUsersCompletedForAction(actionId: number): Promise<number> {
    const completions = await this.prerequisiteProgressService.loadCompletions({
      actionId,
    });
    return completions.length;
  }

  async reloadUsersCompletedForAction(actionId: number): Promise<void> {
    const usersCompleted = await this.findUsersCompletedForAction(actionId);
    await this.actionRepository.update(actionId, { usersCompleted });
  }

  async reloadAllActionUsersJoined(): Promise<void> {
    const actions = await this.actionRepository.find();
    for (const action of actions) {
      await this.reloadUsersJoinedForAction(action.id);
    }
  }

  async reloadUsersJoinedForAction(actionId: number): Promise<void> {
    const usersJoined = (await this.findParticipantIdsForActionById(actionId))
      .length;
    await this.actionRepository.update(actionId, { usersJoined });
  }

  async findIncompleteUsersForAction(actionId: number): Promise<User[]> {
    const action = parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: {
          events: true,
          activities: true,
        },
      }),
    );

    const joinedUserIds = await this.findParticipantIdsForAction(action);

    const completions = await this.prerequisiteProgressService.loadCompletions({
      actionId,
    });
    const completedUserIds = new Set(completions.map((a) => a.userId));

    const incompleteUserIds = joinedUserIds.filter(
      (id) => !completedUserIds.has(id),
    );

    if (incompleteUserIds.length === 0) {
      return [];
    }

    return this.userService.findByIds(incompleteUserIds);
  }
}
