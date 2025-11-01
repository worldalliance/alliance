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

@Injectable()
export class ActionEventRecipientService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly userService: UserService,
  ) {}

  public userShouldCompleteEvent(
    user: User,
    eventDate: Date,
    targetGroupIds: Set<number>,
    everyoneShouldComplete: boolean,
  ): boolean {
    return (
      ((!!user.contractDateSigned &&
        user.contractDateSigned <= eventDate &&
        !user.contractDateSuspended) ||
        everyoneShouldComplete) &&
      user.groups.some((group) => targetGroupIds.has(group.id))
    );
  }

  public async getBaseUsersForEvent(
    eventStatus: ActionStatus,
    action: Action,
    eventDate: Date,
  ): Promise<User[]> {
    const targetGroupIds = new Set(
      action.participatingGroups.map((group) => group.id),
    );

    const filterToEligible = (users: User[]) =>
      users.filter(
        (user) =>
          this.userShouldCompleteEvent(
            user,
            eventDate,
            targetGroupIds,
            action.everyoneShouldComplete,
          ) === true,
      );

    if (eventStatus === ActionStatus.MemberAction && !action.commitmentless) {
      const activities = await this.actionActivityRepository.find({
        where: {
          actionId: action.id,
          type: ActionActivityType.USER_JOINED,
        },
        relations: ['user', 'user.groups'],
      });
      return filterToEligible(activities.map((activity) => activity.user));
    }

    if (
      eventStatus === ActionStatus.GatheringCommitments ||
      eventStatus === ActionStatus.MemberAction
    ) {
      return filterToEligible(
        await this.userService.findActiveUsersWithGroups(),
      );
    }

    return [];
  }

  async filterForShouldRemind(
    users: User[],
    event: Pick<ActionEvent, 'newStatus' | 'action' | 'date'>,
    actionSuite?: ActionSuite,
  ): Promise<User[]> {
    const targetGroupIds = new Set(
      event.action.participatingGroups.map((group) => group.id),
    );
    const usersWithGroups = await this.userService.findByIds(
      users.map((user) => user.id),
      ['groups'],
    );
    const idToUser = new Map(usersWithGroups.map((user) => [user.id, user]));

    const filterToEligible = (users: User[]) =>
      users.filter((user) =>
        this.userShouldCompleteEvent(
          idToUser.get(user.id)!,
          event.date,
          targetGroupIds,
          event.action.everyoneShouldComplete,
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
      (user) => !(userToHasCompletedAllActions.get(user.id) ?? true),
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
      case ReminderCohortType.Group:
        if (!group.userGroup) {
          throw new Error('Group cohort type requires user group');
        }
        const userGroup = await this.userService.findGroupOrFail(
          group.userGroup.id,
        );
        users = userGroup.users;
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
