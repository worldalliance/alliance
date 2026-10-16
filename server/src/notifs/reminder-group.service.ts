import { memberActionPhase } from "@alliance/common/actionEvent";
import { collectCohortDependencies } from "@alliance/common/cohort-expression";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CreateReminderGroupDto,
  ReminderAnchorCandidate,
} from "src/actions/dto/action.dto";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import {
  ActionSuite,
  loadedActionSuiteActions,
} from "src/actions/entities/action-suite.entity";
import { Action, parseAction } from "src/actions/entities/action.entity";
import { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import {
  cohortNotifiesRecipientPersonally,
  loadedReminderGroupMemberActionEvent,
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import {
  type LiveRow,
  softDeleteWhere,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { Tag } from "src/user/entities/tag.entity";
import { UserService } from "src/user/user.service";
import { In, type Repository } from "typeorm";
import {
  ActionEvent,
  ActionStatus,
  loadedActionEventAction,
} from "../actions/entities/action-event.entity";
import { User } from "../user/entities/user.entity";
import { assertReminderGroupSendable } from "./assert-reminder-group-sendable";
import { reminderGroupParents } from "./reminder-group-parents";

type ReminderGroupDtoFields = Omit<
  ReminderGroup,
  | "id"
  | "memberActionEvent"
  | "actionSuite"
  | "notifications"
  | "deadlineEvent"
  | "allSent"
  | "deletedAt"
>;

const REMINDER_GROUP_PARENT_GONE = "That event, suite, tag or member is gone";

@Injectable()
export class ReminderGroupService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(FollowUpForm)
    private readonly followUpFormRepository: Repository<FollowUpForm>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
    private readonly userService: UserService,
  ) {}

  private async attachDeadlineEvent(
    group: ReminderGroup,
  ): Promise<ReminderGroup> {
    if (group.deadlineEvent) {
      return group;
    }
    const events = await this.eventRepository.find({
      where: {
        action: {
          id: loadedActionEventAction(
            loadedReminderGroupMemberActionEvent(group),
          ).id,
        },
      },
    });
    const { deadlineEvent } = memberActionPhase(events);
    if (!deadlineEvent) {
      return group;
    }
    return { ...group, deadlineEvent };
  }

  /**
   * Dependency actions of the event's action — and, when that action belongs
   * to a suite, of every action in the suite — referenced by their cohort
   * expressions via form-response or completed/missed conditions, that
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
    return this.findAnchorCandidatesForAction(loadedActionEventAction(event));
  }

  private async findAnchorCandidatesForAction(
    action: Action,
  ): Promise<ReminderAnchorCandidate[]> {
    const { suite } = await this.actionRepository.findOneOrFail({
      where: { id: action.id },
      relations: { suite: { actions: true } },
    });
    // Parse the jsonb cohortExpressions right at the fetch.
    const scopeActions = (
      suite ? loadedActionSuiteActions(suite) : [action]
    ).map(parseAction);

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
        "timingAnchorEventId is only valid for from_deadline and within_relative_range timing modes",
      );
    }
    const candidates = await this.findAnchorCandidatesForAction(
      loadedActionEventAction(memberActionEvent),
    );
    if (
      !candidates.some(
        (candidate) => candidate.deadlineEventId === dto.timingAnchorEventId,
      )
    ) {
      throw new BadRequestException(
        "Timing anchor event must be the deadline of a cohort dependency of the action or its suite",
      );
    }
    return this.eventRepository.findOneOrFail({
      where: { id: dto.timingAnchorEventId },
    });
  }

  /**
   * The fields `dto` sets on a group of `memberActionEvent`. Preview, create
   * and update all build through here and `attachSendableDeadlineEvent`, so a
   * preview shows what saving does.
   */
  async reminderGroupFieldsFromDto(
    dto: CreateReminderGroupDto,
    memberActionEvent: ActionEvent,
  ): Promise<ReminderGroupDtoFields> {
    assertExcludePreviouslyNotifiedAllowed(dto);
    if (memberActionEvent.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException("Event is not a member action event");
    }

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
      memberActionEvent,
    );

    const { timingAnchorEventId: _timingAnchorEventId, ...dtoRest } = dto;
    return {
      ...dtoRest,
      sendAtAbsolute: dtoRest.sendAtAbsolute ?? null,
      sendAtSecondsFromDeadline: dtoRest.sendAtSecondsFromDeadline ?? null,
      send_range_start: dtoRest.send_range_start ?? null,
      send_range_end: dtoRest.send_range_end ?? null,
      relative_range_start_seconds_from_deadline:
        dtoRest.relative_range_start_seconds_from_deadline ?? null,
      relative_range_end_seconds_from_deadline:
        dtoRest.relative_range_end_seconds_from_deadline ?? null,
      userTag,
      users,
      timingAnchorEvent,
    };
  }

  async attachSendableDeadlineEvent(
    group: ReminderGroup,
  ): Promise<ReminderGroup> {
    const withDeadline = await this.attachDeadlineEvent(group);
    assertReminderGroupSendable(withDeadline);
    return withDeadline;
  }

  async createReminderGroup(
    eventId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    const fields = await this.reminderGroupFieldsFromDto(dto, event);

    let actionSuite: ActionSuite | undefined = undefined;
    if (dto.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: dto.suiteId },
      });
    }

    return this.saveUnderLiveParents(
      this.reminderGroupRepository.create({
        ...fields,
        memberActionEvent: event,
        actionSuite,
      }),
    );
  }

  private async saveUnderLiveParents(
    group: ReminderGroup,
    saved?: LiveRow & { notFound: string },
  ): Promise<ReminderGroup> {
    const withDeadline = await this.attachSendableDeadlineEvent(group);
    return writeUnderLive(this.reminderGroupRepository.manager, {
      parents: reminderGroupParents(withDeadline),
      notFound: REMINDER_GROUP_PARENT_GONE,
      saved,
      write: (em) => em.save(ReminderGroup, withDeadline),
    });
  }

  async updateReminderGroup(
    groupId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: { memberActionEvent: { action: true }, actionSuite: true },
    });
    Object.assign(
      group,
      await this.reminderGroupFieldsFromDto(
        dto,
        loadedReminderGroupMemberActionEvent(group),
      ),
    );

    return this.saveUnderLiveParents(group, {
      target: ReminderGroup,
      id: groupId,
      notFound: "Reminder group not found",
    });
  }

  async deleteReminderGroup(groupId: number): Promise<void> {
    await softDeleteWhere(this.reminderGroupRepository.manager, {
      target: ReminderGroup,
      where: { id: groupId },
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
        actionSuite: true,
      },
    });
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
  dto: Pick<CreateReminderGroupDto, "cohortType" | "excludePreviouslyNotified">,
): void {
  if (
    dto.excludePreviouslyNotified &&
    !cohortNotifiesRecipientPersonally(dto.cohortType)
  ) {
    throw new BadRequestException(
      "excludePreviouslyNotified is not supported for group-leads cohorts",
    );
  }
}
