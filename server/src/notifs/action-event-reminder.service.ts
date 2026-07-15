import { Temporal } from '@js-temporal/polyfill';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { collectCohortDependencies } from 'src/actions/cohort-expression.evaluator';
import {
  CreateReminderGroupDto,
  PreviewEmailHtmlDto,
  PreviewEmailHtmlResponse,
  PreviewTextDto,
  ReminderAnchorCandidate,
} from 'src/actions/dto/action.dto';
import { NotificationScheduleEntryDto } from 'src/actions/dto/notification-schedule.dto';
import { ActionFormVariant } from 'src/actions/entities/action-form-variant.entity';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import { Action } from 'src/actions/entities/action.entity';
import { FollowUpForm } from 'src/actions/entities/follow-up-form.entity';
import {
  cohortNotifiesRecipientPersonally,
  getGroupSendTimeForUser,
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from 'src/actions/entities/reminder-group.entity';
import { EmailType } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { Tag } from 'src/user/entities/tag.entity';
import { UserService } from 'src/user/user.service';
import { Brackets, In, type Repository } from 'typeorm';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { memberActionPhase } from '../actions/utils/action-event';
import { DEFAULT_TIME_ZONE, User } from '../user/entities/user.entity';
import { ActionEventRecipientService } from './action-event-recipient.service';
import {
  NotificationPlan,
  PreviewNotificationPlanDto,
} from './dto/notification-plan.dto';
import { ActionEventNotifDto } from './entities/action-event-notif.dto';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import { generateCIDForNotif, NotificationChannel } from './notif-utils';
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from './notifs.service';
import { testUser } from './test-users';

export interface MissedDeadlineCandidate {
  actionId: number;
  userId: number;
  deadlineEventId: number;
  deadlineDate: Date;
  resolutionEventId: number;
  resolutionDate: Date;
}

export const NOTIFICATION_LOOKBACK_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

@Injectable()
export class ActionEventReminderService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifRepository: Repository<ActionEventNotif>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(FollowUpForm)
    private readonly followUpFormRepository: Repository<FollowUpForm>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
    private readonly recipientService: ActionEventRecipientService,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  async findPlansForGroup(
    group: ReminderGroup,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const plans: NotificationPlan[] = [];

    const [users, alreadyNotifiedUserIds] = await Promise.all([
      this.recipientService.findReminderGroupCohort(group),
      this.findAlreadyNotifiedUserIds(group),
    ]);
    for (const user of users) {
      const reminderSendTime = getGroupSendTimeForUser(user, group);

      if (!reminderSendTime) continue;

      if (alreadyNotifiedUserIds.has(user.id)) continue;

      if (await this.userService.isUserIdAway(user.id, reminderSendTime))
        continue;

      if (reminderSendTime >= windowStart && reminderSendTime <= windowEnd) {
        plans.push({
          user,
          group,
          scheduledFor: reminderSendTime,
        });
      }
    }

    return plans;
  }

  /**
   * Users who must not receive this group's notification because they were
   * already notified. Without `excludePreviouslyNotified`: those with a sent
   * notif for this group. With it: those whose sent notifs on the same
   * member-action event already covered every task this group could tell
   * them about — a legacy notif (null `notifiedActionIds`) counts as having
   * covered everything, and otherwise the notifs' covered action ids must
   * include the group's whole task scope. Users with *partial* coverage stay
   * in the plans; the worker re-filters per task at send time and skips them
   * if nothing new remains, so this plan-time pass only has to be safe, not
   * exact. Uses the event id denormalized onto the notif so the answer
   * survives the originating group's deletion — and since group-leads nudges
   * are written without the event stamp, they never count as having
   * personally notified their recipient.
   */
  private async findAlreadyNotifiedUserIds(
    group: ReminderGroup,
  ): Promise<Set<number>> {
    if (!group.excludePreviouslyNotified) {
      const rows = await this.actionEventNotifRepository
        .createQueryBuilder('notif')
        .where('notif.sent = true')
        .andWhere('notif."reminderGroupId" = :groupId', { groupId: group.id })
        .select('DISTINCT notif."userId"', 'userId')
        .getRawMany<{ userId: number }>();
      return new Set(rows.map((row) => Number(row.userId)));
    }

    const rows = await this.actionEventNotifRepository
      .createQueryBuilder('notif')
      .where('notif.sent = true')
      .andWhere('notif."memberActionEventId" = :eventId', {
        eventId: group.memberActionEvent.id,
      })
      .select('notif."userId"', 'userId')
      .addSelect('notif."notifiedActionIds"', 'notifiedActionIds')
      .getRawMany<{ userId: number; notifiedActionIds: number[] | null }>();

    const scopeActionIds = groupTaskScopeActionIds(group);

    const coverageByUser = new Map<number, Array<number[] | null>>();
    for (const row of rows) {
      const userId = Number(row.userId);
      const coverage = coverageByUser.get(userId) ?? [];
      coverage.push(row.notifiedActionIds);
      coverageByUser.set(userId, coverage);
    }

    const excluded = new Set<number>();
    for (const [userId, coverage] of coverageByUser) {
      const uncovered = tasksNotYetNotified(
        scopeActionIds.map((id) => ({ id })),
        coverage,
      );
      if (uncovered.length === 0) excluded.add(userId);
    }
    return excluded;
  }

  /**
   * The covered-action-id sets of every sent notif that personally notified
   * this user on this member-action event (a null entry is a legacy notif
   * that counts as having covered everything). Fetched per plan at send time
   * so a sibling send from the same dispatch cycle — invisible to the
   * plan-time snapshot, since plans are dispatched in `scheduledFor` order —
   * is accounted for, without suppressing the catch-up when the sibling plan
   * never actually sent.
   */
  async findSentNotifCoverage(
    userId: number,
    eventId: number,
  ): Promise<Array<number[] | null>> {
    const notifs = await this.actionEventNotifRepository.find({
      where: {
        user: { id: userId },
        memberActionEvent: { id: eventId },
        sent: true,
      },
      select: { id: true, notifiedActionIds: true },
    });
    return notifs.map((notif) => notif.notifiedActionIds);
  }

  async attachDeadlineEvent(group: ReminderGroup): Promise<ReminderGroup> {
    if (group.deadlineEvent || !group.memberActionEvent) {
      return group;
    }
    const events = await this.eventRepository.find({
      where: { action: { id: group.memberActionEvent.action.id } },
    });
    const { deadlineEvent } = memberActionPhase(events);
    if (!deadlineEvent) {
      return group;
    }
    return { ...group, deadlineEvent };
  }

  async evaluateNotifications(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid schedule window');
    }
    if (end.getTime() < start.getTime()) {
      throw new Error('windowEnd must not be before windowStart');
    }

    const plans: NotificationPlan[] = [];

    const groups = await this.findSendableReminderGroups(
      this.reminderGroupRepository,
      windowStart,
      windowEnd,
    );

    for (const group of groups) {
      const groupPlans = await this.findPlansForGroup(
        group,
        windowStart,
        windowEnd,
      );
      plans.push(...groupPlans);
    }

    if (plans.length === 0) {
      return [];
    }

    plans.sort(comparePlansForDispatch);
    return plans;
  }

  async getNotificationSchedule(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationScheduleEntryDto[]> {
    const plans = dropPlansPreemptedInSameCycle(
      await this.evaluateNotifications(windowStart, windowEnd),
    );

    return Promise.all(
      plans.map(async (plan) => {
        const event = plan.group.memberActionEvent!;
        return {
          scheduledFor: plan.scheduledFor,
          actionId: event.action!.id,
          actionName: event.action!.name,
          actionStatus: event.newStatus,
          eventId: event.id,
          type: ActionEventNotifType.Reminder,
          recipients: [], //TODO
        } satisfies NotificationScheduleEntryDto;
      }),
    );
  }

  async findSendableReminderGroups(
    repo: Repository<ReminderGroup>,
    windowStart: Date,
    windowEnd: Date,
  ) {
    const idRows = await repo
      .createQueryBuilder('rg')
      .leftJoin('rg.memberActionEvent', 'event')
      .leftJoin('rg.deadlineEvent', 'deadline')
      .leftJoin('rg.timingAnchorEvent', 'anchor')
      .where('rg."allSent" = false')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            '(rg."timingMode" = :abs AND rg."sendAtAbsolute" BETWEEN :ws AND :we)',
          )
            .orWhere(
              '(rg."timingMode" = :launch AND event."date" BETWEEN :ws AND :we)',
            )
            .orWhere(
              '(rg."timingMode" = :range AND rg."send_range_start" <= :we AND rg."send_range_end" >= :ws)',
            )
            .orWhere(
              `(
                  rg."timingMode" = :relativerange
                  AND COALESCE(anchor."date", deadline."date") IS NOT NULL
                  AND (COALESCE(anchor."date", deadline."date") - (rg."relative_range_start_seconds_from_deadline" * interval '1 second')) <= :we
                  AND (COALESCE(anchor."date", deadline."date") - (rg."relative_range_end_seconds_from_deadline" * interval '1 second')) >= :ws
                )`,
            )
            .orWhere(
              `(
                 rg."timingMode" = :from
                 AND COALESCE(anchor."date", deadline."date") IS NOT NULL
                 AND (COALESCE(anchor."date", deadline."date") - (rg."sendAtSecondsFromDeadline" * interval '1 second'))
                   BETWEEN :ws AND :we
               )`,
            );
        }),
      )
      .setParameters({
        abs: ReminderGroupTimingMode.Absolute,
        range: ReminderGroupTimingMode.WithinRange,
        from: ReminderGroupTimingMode.FromDeadline,
        relativerange: ReminderGroupTimingMode.WithinRelativeRange,
        launch: ReminderGroupTimingMode.EventLaunch,
        ws: windowStart,
        we: windowEnd,
      })
      .select('rg.id', 'id')
      .distinct(true)
      .getRawMany<{ id: number }>();

    const ids = idRows.map((r) => r.id);

    if (ids.length === 0) {
      return [];
    }

    return repo
      .createQueryBuilder('rg')
      .leftJoinAndSelect('rg.memberActionEvent', 'event')
      .leftJoinAndSelect('event.action', 'eventAction')
      .leftJoinAndSelect('eventAction.events', 'eventActionEvents')
      .leftJoinAndSelect('rg.deadlineEvent', 'deadline')
      .leftJoinAndSelect('rg.timingAnchorEvent', 'anchor')
      .leftJoinAndSelect('rg.users', 'users')
      .leftJoinAndSelect('users.tags', 'userTags')
      .leftJoinAndSelect('users.contractEvents', 'contractEvents')
      .leftJoinAndSelect('rg.userTag', 'userTag')
      .leftJoinAndSelect('rg.actionSuite', 'actionSuite')
      .leftJoinAndSelect('actionSuite.actions', 'actionSuiteActions')
      .where('rg.id IN (:...ids)', { ids })
      .getMany();
  }

  async getPersonalizedSendTime(
    user: User,
    day: Temporal.PlainDate,
  ): Promise<Temporal.ZonedDateTime> {
    const defaultSendTime: Temporal.PlainTime =
      Temporal.PlainTime.from('19:00:00');

    const timeOfDay: Temporal.PlainTime =
      user.preferredReminderTime ?? defaultSendTime;
    const timezone: Temporal.TimeZoneLike = user.timeZone ?? DEFAULT_TIME_ZONE;

    const zoned = day.toZonedDateTime({
      plainTime: timeOfDay,
      timeZone: timezone,
    });

    return zoned;
  }

  async findNotificationPlansForGroup(
    groupId: number,
  ): Promise<PreviewNotificationPlanDto[]> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: {
        memberActionEvent: {
          action: { events: true },
        },
        deadlineEvent: true,
        timingAnchorEvent: true,
        users: { contractEvents: true },
        userTag: true,
        actionSuite: { actions: true },
      },
    });

    const plans = await this.findPlansForGroup(
      group,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    );
    return plans.map((plan) => {
      const channels: NotificationChannel[] = [];
      if (userActionNotifsEnabled_push(plan.user))
        channels.push(NotificationChannel.Push);
      if (userActionNotifsEnabled_text(plan.user))
        channels.push(NotificationChannel.Text);
      if (userActionNotifsEnabled_email(plan.user))
        channels.push(NotificationChannel.Email);
      return new PreviewNotificationPlanDto(plan, channels);
    });
  }

  async getSentNotifsForGroup(groupId: number): Promise<ActionEventNotifDto[]> {
    const notifs = await this.actionEventNotifRepository.find({
      where: { reminderGroup: { id: groupId }, sent: true },
      relations: { user: true, mms: true, mail: true, pushes: true },
    });
    return notifs.map((notif) => new ActionEventNotifDto(notif));
  }

  /**
   * Dependency actions of the event's action — and, when that action belongs
   * to a suite, of every action in the suite — referenced by their cohort
   * expressions via form-response or completed/in-progress conditions, that
   * have a member-action deadline. Offered as reminder timing anchors so a
   * group can fire when a dependency's deadline passes and catch users who
   * joined a cohort late. Actions in the suite itself are never candidates
   * (anchoring to them is just the suite's own deadline). Sorted by deadline
   * date so the first candidate is the next deadline.
   */
  async findReminderAnchorCandidates(
    eventId: number,
  ): Promise<ReminderAnchorCandidate[]> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    return this.findAnchorCandidatesForAction(event.action);
  }

  private async findAnchorCandidatesForAction(
    action: Action,
  ): Promise<ReminderAnchorCandidate[]> {
    const { suite } = await this.actionRepository.findOneOrFail({
      where: { id: action.id },
      relations: { suite: { actions: true } },
    });
    const scopeActions = suite?.actions?.length ? suite.actions : [action];

    const actionIds = new Set<number>();
    const formIds = new Set<number>();
    for (const scopeAction of scopeActions) {
      const dependencies = collectCohortDependencies(
        scopeAction.cohortExpression,
      );
      for (const id of dependencies.actionIds) actionIds.add(id);
      for (const id of dependencies.formIds) formIds.add(id);
    }

    const [taskFormActions, followUpForms, formVariants] = await Promise.all([
      formIds.size > 0
        ? this.actionRepository.find({
            where: { taskFormId: In([...formIds]) },
            select: { id: true },
          })
        : [],
      formIds.size > 0
        ? this.followUpFormRepository.find({
            where: { formId: In([...formIds]) },
            select: { actionId: true },
          })
        : [],
      formIds.size > 0
        ? this.actionFormVariantRepository.find({
            where: { formId: In([...formIds]) },
            select: { actionId: true },
          })
        : [],
    ]);
    for (const taskFormAction of taskFormActions)
      actionIds.add(taskFormAction.id);
    for (const followUpForm of followUpForms)
      actionIds.add(followUpForm.actionId);
    for (const variant of formVariants) actionIds.add(variant.actionId);
    for (const scopeAction of scopeActions) actionIds.delete(scopeAction.id);

    if (actionIds.size === 0) return [];
    const dependencyActions = await this.actionRepository.find({
      where: { id: In([...actionIds]) },
      relations: { events: true },
    });

    return dependencyActions
      .flatMap((dependencyAction) => {
        const deadlineEvent = dependencyAction.memberActionPhase.deadlineEvent;
        if (!deadlineEvent) return [];
        return [
          {
            actionId: dependencyAction.id,
            actionName: dependencyAction.name,
            deadlineEventId: deadlineEvent.id,
            deadlineEventDate: deadlineEvent.date,
          },
        ];
      })
      .sort(
        (a, b) => a.deadlineEventDate.getTime() - b.deadlineEventDate.getTime(),
      );
  }

  /**
   * Load the timing anchor event referenced by the dto, or `null` when the
   * dto doesn't set one — `null`, not `undefined`, so assigning the result
   * onto a group clears a previously set anchor (TypeORM skips `undefined`
   * properties on save). Anchors only make sense for the deadline-relative
   * timing modes, and must be one of the member event's anchor candidates (a
   * dependency action's deadline) — reject anything else so a stale or
   * unrelated anchor can't sit on the group.
   */
  async resolveTimingAnchorEvent(
    dto: CreateReminderGroupDto,
    memberActionEvent: ActionEvent,
  ): Promise<ActionEvent | null> {
    if (dto.timingAnchorEventId == null) {
      return null;
    }
    if (
      dto.timingMode !== ReminderGroupTimingMode.FromDeadline &&
      dto.timingMode !== ReminderGroupTimingMode.WithinRelativeRange
    ) {
      throw new BadRequestException(
        'timingAnchorEventId is only valid for from_deadline and within_relative_range timing modes',
      );
    }
    const candidates = await this.findAnchorCandidatesForAction(
      memberActionEvent.action,
    );
    if (
      !candidates.some(
        (candidate) => candidate.deadlineEventId === dto.timingAnchorEventId,
      )
    ) {
      throw new BadRequestException(
        'Timing anchor event must be the deadline of a cohort dependency of the action or its suite',
      );
    }
    return this.eventRepository.findOneOrFail({
      where: { id: dto.timingAnchorEventId },
    });
  }

  async createReminderGroup(
    eventId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    assertExcludePreviouslyNotifiedAllowed(dto);
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    if (event.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException('Event is not a member action event');
    }

    let userTag: Tag | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Tag && dto.userTagId) {
      userTag = await this.userService.findTagOrFail(dto.userTagId);
    }

    let users: User[] | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Custom && dto.userIds) {
      users = await this.userService.findByIds(dto.userIds);
    }

    let actionSuite: ActionSuite | undefined = undefined;
    if (dto.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: dto.suiteId },
      });
    }

    const timingAnchorEvent = await this.resolveTimingAnchorEvent(dto, event);

    const { timingAnchorEventId: _timingAnchorEventId, ...dtoRest } = dto;
    const group = await this.reminderGroupRepository.create({
      ...dtoRest,
      memberActionEvent: event,
      actionSuite,
      userTag,
      users,
      timingAnchorEvent,
    });

    const withDeadline = await this.attachDeadlineEvent(group);

    return this.reminderGroupRepository.save(withDeadline);
  }

  async updateReminderGroup(
    groupId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    assertExcludePreviouslyNotifiedAllowed(dto);
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: { memberActionEvent: { action: true } },
    });

    let userTag: Tag | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Tag && dto.userTagId) {
      userTag = await this.userService.findTagOrFail(dto.userTagId);
    }

    let users: User[] | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Custom && dto.userIds) {
      users = await this.userService.findByIds(dto.userIds);
    }

    const timingAnchorEvent = await this.resolveTimingAnchorEvent(
      dto,
      group.memberActionEvent,
    );

    const { timingAnchorEventId: _timingAnchorEventId, ...dtoRest } = dto;
    Object.assign(group, dtoRest);
    group.userTag = userTag;
    group.users = users;
    // null (never undefined) when the dto omits the anchor, so the save
    // clears a previously set anchor instead of silently keeping it.
    group.timingAnchorEvent = timingAnchorEvent;

    const withDeadline = await this.attachDeadlineEvent(group);

    return this.reminderGroupRepository.save(withDeadline);
  }

  async deleteReminderGroup(groupId: number): Promise<void> {
    await this.reminderGroupRepository.delete({
      id: groupId,
    });
  }

  async getReminderGroupsForEvent(id: number): Promise<ReminderGroup[]> {
    return this.reminderGroupRepository.find({
      where: { memberActionEvent: { id } },
      relations: {
        memberActionEvent: true,
        userTag: true,
        users: true,
        timingAnchorEvent: true,
      },
    });
  }

  async findUncompletedMembersInCommunities(
    group: ReminderGroup,
    leader: User,
  ): Promise<User[]> {
    const baseUsers = await this.recipientService.findFilteredUsersForEvent(
      group.memberActionEvent,
      group.deadlineEvent ?? null,
      ActionEventNotifType.PersonalReminder,
      group.actionSuite,
      group.excludeOptionalActions,
    );

    const usersWithCommunities = await this.userService.findByIds(
      baseUsers.map((user) => user.id),
      { communities: true },
    );

    const leaderCommunityIds = new Set(
      leader.leaderOfIds ?? leader.leaderOf?.map((community) => community.id),
    );

    const inCommunities = usersWithCommunities.filter((user) =>
      user.communities.some((community) =>
        leaderCommunityIds.has(community.id),
      ),
    );
    return inCommunities.filter((user) => user.id !== leader.id);
  }

  async loadEventsForPreview(
    eventId: number,
  ): Promise<{ deadlineEvent: ActionEvent | undefined; event: ActionEvent }> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    const events = await this.eventRepository.find({
      where: { action: { id: event.action.id } },
    });
    return {
      event,
      deadlineEvent: memberActionPhase(events).deadlineEvent ?? undefined,
    };
  }

  async getKeywordContextForPreview(
    eventId: number,
    dto: PreviewEmailHtmlDto | PreviewTextDto,
    sendTime?: Date,
  ) {
    const { event, deadlineEvent } = await this.loadEventsForPreview(eventId);

    return {
      action: event.action,
      deadlineEvent,
      user: testUser,
      cid: await generateCIDForNotif(),
      uncompletedTasksCount: dto.taskCount,
      uncompletedTasksTime: dto.taskCount * 5 + ' minutes',
      uncompletedTasksNames: ['Task 1', 'Task 2', 'Task 3'].slice(
        0,
        dto.taskCount,
      ),
      dateNow: sendTime,
      uncompletedMembersInGroupCount: dto.uncompletedMembersInGroupCount,
    };
  }

  async previewEmailHtml(
    eventId: number,
    dto: PreviewEmailHtmlDto,
    sendTime?: Date,
  ): Promise<PreviewEmailHtmlResponse> {
    const context = await this.getKeywordContextForPreview(
      eventId,
      dto,
      sendTime,
    );

    const replacedMessage = processKeywordReplacements(
      dto.emailMessage,
      context,
    );
    const replacedSubject = processKeywordReplacements(
      dto.emailSubject,
      context,
    );

    const html = await this.mailService.renderHtml(
      EmailType.CustomActionReminder,
      {
        customMessage: replacedMessage.replace(/\n/g, '<br>'),
      },
    );

    return {
      subject: replacedSubject,
      html,
    };
  }

  async previewTextMessage(
    eventId: number,
    dto: PreviewTextDto,
    sendTime?: Date,
  ): Promise<string> {
    const context = await this.getKeywordContextForPreview(
      eventId,
      dto,
      sendTime,
    );

    return processKeywordReplacements(dto.textMessage, context);
  }
}

/**
 * `excludePreviouslyNotified` only makes sense for cohorts whose notifs are
 * about the recipient's own tasks: exclusion matches on notifs that
 * *personally* notified the user about the event, and group-leads nudges
 * neither write that stamp nor should be suppressed by it (a leader who was
 * notified about their own task still needs nudges about other members').
 */
export function assertExcludePreviouslyNotifiedAllowed(
  dto: Pick<CreateReminderGroupDto, 'cohortType' | 'excludePreviouslyNotified'>,
): void {
  if (
    dto.excludePreviouslyNotified &&
    !cohortNotifiesRecipientPersonally(dto.cohortType)
  ) {
    throw new BadRequestException(
      'excludePreviouslyNotified is not supported for group-leads cohorts',
    );
  }
}

/**
 * The actions an `excludePreviouslyNotified` decision is about: the suite's
 * actions for suite-count groups, else the member event's own action. A user
 * whose prior notifs cover this whole scope has nothing new to hear from the
 * group — even if their (possibly global) message task list would not be
 * empty. Falls back to the single action when the suite's actions aren't
 * loaded (e.g. the preview's tentative group), which can only over-exclude
 * relative to the suite scope, never notify someone twice.
 */
export function groupTaskScopeActionIds(group: ReminderGroup): number[] {
  const suiteActions =
    group.useSuiteTaskCount && group.actionSuite?.actions?.length
      ? group.actionSuite.actions
      : null;
  return suiteActions
    ? suiteActions.map((action) => action.id)
    : [group.memberActionEvent.action.id];
}

/**
 * The tasks a user hasn't been personally notified about yet, given the
 * covered-action-id sets of their prior sent notifs on the event
 * (`findSentNotifCoverage`). A `null` coverage entry is a legacy notif from
 * before per-task tracking existed and counts as having covered everything.
 */
export function tasksNotYetNotified<T extends { id: number }>(
  tasks: T[],
  coverage: Array<number[] | null>,
): T[] {
  if (coverage.some((actionIds) => actionIds === null)) {
    return [];
  }
  const covered = new Set(coverage.flatMap((actionIds) => actionIds ?? []));
  return tasks.filter((task) => !covered.has(task.id));
}

/**
 * Dispatch order for due plans: by send time, and on equal send times
 * non-catch-up plans first, so a catch-up's send-time coverage check sees the
 * sibling's notif and skips the user instead of racing it (the plan array's
 * incoming order comes from an unordered DB read). Group id last so preview
 * and dispatch order identically.
 */
export function comparePlansForDispatch(
  a: NotificationPlan,
  b: NotificationPlan,
): number {
  return (
    a.scheduledFor.getTime() - b.scheduledFor.getTime() ||
    Number(a.group.excludePreviouslyNotified) -
      Number(b.group.excludePreviouslyNotified) ||
    a.group.id - b.group.id
  );
}

/**
 * Preview-only estimate of `excludePreviouslyNotified` suppression within one
 * dispatch cycle: assumes every earlier plan for the same user + member-action
 * event will actually send, covering every task the user could be told about,
 * and hides the catch-up accordingly. Real sends don't use this — a plan can
 * skip or fail, so the worker re-derives the not-yet-notified task set per
 * plan at send time (`findSentNotifCoverage` + `tasksNotYetNotified`) instead.
 *
 * Expects `plans` sorted by `scheduledFor` ascending; keeps the earliest plan
 * per user + member-action event.
 */
export function dropPlansPreemptedInSameCycle(
  plans: NotificationPlan[],
): NotificationPlan[] {
  const notifiedThisCycle = new Set<string>();
  const kept: NotificationPlan[] = [];
  for (const plan of plans) {
    const key = `${plan.user.id}:${plan.group.memberActionEvent.id}`;
    if (plan.group.excludePreviouslyNotified && notifiedThisCycle.has(key)) {
      continue;
    }
    if (cohortNotifiesRecipientPersonally(plan.group.cohortType)) {
      notifiedThisCycle.add(key);
    }
    kept.push(plan);
  }
  return kept;
}
