import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { computeIsAwayDuringWindow } from "src/utils/action-user";
import { In, Repository } from "typeorm";
import {
  findLatestTerminalActivities,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import {
  Action,
  loadedActionEvents,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";

@Injectable()
export class ActionParticipantsService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
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
      const event = loadedActionEvents(action).find(
        (e) => e.newStatus === ActionStatus.MemberAction,
      );
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
}
