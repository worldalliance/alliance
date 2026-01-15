import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import { Action } from '../actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ReminderCohortType,
  ReminderGroup,
} from 'src/actions/entities/reminder-group.entity';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { computeIsAwayInRange } from 'src/utils/user';

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly userService: UserService,
  ) {}

  private isContractActiveAtDate(
    contractEvents: ContractEvent[] | null,
    date: Date,
  ): boolean {
    if (contractEvents === null || contractEvents === undefined) {
      throw new Error('user contract events not loaded');
    }

    const lastEventBefore = contractEvents
      .filter((event) => event.date <= date)
      .reduce(
        (a: ContractEvent | null, b) =>
          a === null || a.date.getTime() < b.date.getTime() ? b : a,
        null,
      );

    return lastEventBefore?.type === ContractEventType.SIGNED;
  }

  public computeShouldParticipate(params: {
    eventDate: Date;
    everyoneShouldComplete: boolean;
    manualCohortUserIds?: Set<number>;
    targetTagIds: Set<number>;
    useManualCohort: boolean;
    user: User;
    userDismissed: boolean;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): boolean {
    const {
      eventDate,
      everyoneShouldComplete,
      manualCohortUserIds,
      targetTagIds,
      useManualCohort,
      user,
      userDismissed,
      includeSuspended = false,
      includeDismissed = false,
    } = params;

    if (!includeDismissed && userDismissed) {
      return false;
    }
    if (useManualCohort) {
      return manualCohortUserIds?.has(user.id) ?? false;
    }

    if (!user.tags.some((tag) => targetTagIds.has(tag.id))) {
      return false;
    }
    if (includeSuspended) {
      return true;
    }
    return (
      this.isContractActiveAtDate(user.contractEvents, eventDate) ||
      everyoneShouldComplete
    );
  }

  getNextEvent(params: {
    events: ActionEvent[];
    currentEventId: number;
  }): ActionEvent | null {
    const { events, currentEventId } = params;
    const sortedEvents = events.toSorted(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const currentEventIndex = sortedEvents.findIndex(
      (event) => event.id === currentEventId,
    );
    if (currentEventIndex === -1) {
      return null;
    }
    return sortedEvents[currentEventIndex + 1] ?? null;
  }

  public async findBaseUsersForEvent(params: {
    eventStatus: ActionStatus;
    action: Action;
    eventId: number;
    includeSuspended?: boolean;
    includeDismissed?: boolean;
  }): Promise<User[]> {
    const { eventStatus, action, eventId, includeSuspended, includeDismissed } =
      params;
    const targetTagIds = new Set(action.participatingTags.map((tag) => tag.id));
    const events =
      action.events ??
      (
        await this.actionRepository.findOneOrFail({
          where: { id: action.id },
          relations: { events: true },
        })
      ).events;
    const event = events.find((event) => event.id === eventId);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const usersDismissed = new Set(
      (
        await this.actionActivityRepository.find({
          where: {
            action: { id: action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
      ).map((a) => a.userId),
    );
    const manualCohortUserIdsSet = action.manualCohortUserIds
      ? new Set(action.manualCohortUserIds)
      : undefined;
    const filterToEligible = (user: User) =>
      this.computeShouldParticipate({
        eventDate: event.date,
        everyoneShouldComplete: action.everyoneShouldComplete,
        manualCohortUserIds: manualCohortUserIdsSet,
        targetTagIds,
        useManualCohort: action.useManualCohort,
        user,
        userDismissed: usersDismissed.has(user.id),
        includeSuspended,
        includeDismissed,
      }) &&
      !computeIsAwayInRange({
        user,
        startDate: event.date,
        endDate: this.getNextEvent({
          events,
          currentEventId: eventId,
        })?.date,
      });

    if (eventStatus === ActionStatus.MemberAction && !action.commitmentless) {
      const activities = await this.actionActivityRepository.find({
        where: {
          actionId: action.id,
          type: ActionActivityType.USER_JOINED,
        },
        relations: {
          user: {
            tags: true,
            awayRanges: true,
            contractEvents: true,
          },
        },
      });
      return activities
        .map((activity) => activity.user)
        .filter(filterToEligible);
    }

    if (
      eventStatus === ActionStatus.GatheringCommitments ||
      eventStatus === ActionStatus.MemberAction
    ) {
      return (await this.userService.findActiveUsersWithTags()).filter(
        filterToEligible,
      );
    }

    return [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    actionSuite?: ActionSuite,
  ): Promise<User[]> {
    const targetTagIds = new Set(
      event.action.participatingTags.map((tag) => tag.id),
    );
    const usersWithTags = await this.userService.findByIds(
      users.map((user) => user.id),
      { tags: true, awayRanges: true, contractEvents: true },
    );
    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

    const usersDismissed = new Set(
      (
        await this.actionActivityRepository.find({
          where: {
            action: { id: event.action.id },
            type: ActionActivityType.USER_DISMISSED,
          },
        })
      ).map((a) => a.userId),
    );
    const manualCohortUserIdsSet = event.action.manualCohortUserIds
      ? new Set(event.action.manualCohortUserIds)
      : undefined;
    const filterToEligible = (user: User) =>
      this.computeShouldParticipate({
        eventDate: event.date,
        everyoneShouldComplete: event.action.everyoneShouldComplete,
        manualCohortUserIds: manualCohortUserIdsSet,
        targetTagIds,
        useManualCohort: event.action.useManualCohort,
        user: idToUser.get(user.id)!,
        userDismissed: usersDismissed.has(user.id),
      });

    const actions = actionSuite ? actionSuite.actions : [event.action];

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(users.map((user) => user.id)),
        actionId: In(actions.map((action) => action.id)),
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_DECLINED,
          ActionActivityType.USER_WONT_COMPLETE,
        ]),
      },
    });

    const userToHasCompletedAllActions = new Map<number, boolean>();
    for (const user of users) {
      userToHasCompletedAllActions.set(
        user.id,
        actions.every((action) =>
          completionActivities.some(
            (activity) =>
              activity.userId === user.id && activity.actionId === action.id,
          ),
        ),
      );
    }

    return users
      .filter(filterToEligible)
      .filter((user) => !userToHasCompletedAllActions.get(user.id));
  }

  async findFilteredUsersForEvent(
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date' | 'id'>,
    type: ActionEventNotifType,
    suite?: ActionSuite,
  ): Promise<User[]> {
    const users = await this.findBaseUsersForEvent({
      action: event.action,
      eventId: event.id,
      eventStatus: event.newStatus,
    });
    return type === ActionEventNotifType.Announcement
      ? users
      : await this.filterForShouldRemind(users, event, suite);
  }

  async findReminderGroupCohort(group: ReminderGroup): Promise<User[]> {
    let users: User[];
    switch (group.cohortType) {
      case ReminderCohortType.Custom:
        if (!group.users) {
          throw new Error('Custom cohort type requires users');
        }
        users = group.users;
        break;
      case ReminderCohortType.AllUncompleted:
        users = await this.findFilteredUsersForEvent(
          group.memberActionEvent,
          ActionEventNotifType.PersonalReminder,
          group.actionSuite,
        );
        break;
      case ReminderCohortType.Tag:
        if (!group.userTag) {
          throw new Error('Group cohort type requires user tag');
        }
        const userTag = await this.userService.findTagOrFail(group.userTag.id);
        users = userTag.users;
        break;
      default:
        throw new Error(
          `Invalid cohort type: ${group.cohortType satisfies never}`,
        );
    }
    return this.filterForShouldRemind(
      users,
      group.memberActionEvent,
      group.actionSuite,
    );
  }
}
