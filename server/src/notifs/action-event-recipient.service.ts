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

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly userService: UserService,
  ) {}

  private isContractActiveAtDate(
    contractEvents: ContractEvent[] | null,
    date: Date,
  ): boolean {
    if (contractEvents === null || contractEvents === undefined) {
      throw new Error('user contract events not loaded');
    }

    const eventsBefore = contractEvents
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .filter((event) => event.date <= date);

    if (!eventsBefore.length) {
      return false;
    }

    const lastEvent = eventsBefore[eventsBefore.length - 1];
    return lastEvent.type === ContractEventType.SIGNED;
  }

  public userShouldCompleteEvent(
    user: User,
    eventDate: Date,
    targetTagIds: Set<number>,
    everyoneShouldComplete: boolean,
    useManualCohort: boolean,
    manualCohortUsers?: User[],
  ): boolean {
    if (useManualCohort) {
      return manualCohortUsers?.some((m) => m.id === user.id) ?? false;
    }
    return (
      (this.isContractActiveAtDate(user.contractEvents, eventDate) ||
        everyoneShouldComplete) &&
      user.tags.some((tag) => targetTagIds.has(tag.id))
    );
  }

  public async getBaseUsersForEvent(
    eventStatus: ActionStatus,
    action: Action,
    eventDate: Date,
  ): Promise<User[]> {
    const targetTagIds = new Set(action.participatingTags.map((tag) => tag.id));

    const filterToEligible = (users: User[]) =>
      users.filter(
        (user) =>
          this.userShouldCompleteEvent(
            user,
            eventDate,
            targetTagIds,
            action.everyoneShouldComplete,
            action.useManualCohort,
            action.manualCohortUsers,
          ) === true && !this.userService.isUserAway(user, eventDate),
      );

    if (eventStatus === ActionStatus.MemberAction && !action.commitmentless) {
      const activities = await this.actionActivityRepository.find({
        where: {
          actionId: action.id,
          type: ActionActivityType.USER_JOINED,
        },
        relations: [
          'user',
          'user.tags',
          'user.awayRanges',
          'user.contractEvents',
        ],
      });
      return filterToEligible(activities.map((activity) => activity.user));
    }

    if (
      eventStatus === ActionStatus.GatheringCommitments ||
      eventStatus === ActionStatus.MemberAction
    ) {
      return filterToEligible(await this.userService.findActiveUsersWithTags());
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
      ['tags', 'awayRanges', 'contractEvents'],
    );
    const idToUser = new Map(usersWithTags.map((user) => [user.id, user]));

    const filterToEligible = (users: User[]) =>
      users.filter((user) =>
        this.userShouldCompleteEvent(
          idToUser.get(user.id)!,
          event.date,
          targetTagIds,
          event.action.everyoneShouldComplete,
          event.action.useManualCohort,
          event.action.manualCohortUsers,
        ),
      );

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

    return filterToEligible(users).filter(
      (user) => !userToHasCompletedAllActions.get(user.id),
    );
  }

  async getFilteredUsersForEvent(
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    type: ActionEventNotifType,
    suite?: ActionSuite,
  ): Promise<User[]> {
    const users = await this.getBaseUsersForEvent(
      event.newStatus,
      event.action,
      event.date,
    );
    return type === ActionEventNotifType.Announcement
      ? users
      : await this.filterForShouldRemind(users, event, suite);
  }

  async getReminderGroupCohort(group: ReminderGroup): Promise<User[]> {
    let users: User[];
    switch (group.cohortType) {
      case ReminderCohortType.Custom:
        if (!group.users) {
          throw new Error('Custom cohort type requires users');
        }
        users = group.users;
        break;
      case ReminderCohortType.AllUncompleted:
        users = await this.getFilteredUsersForEvent(
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
