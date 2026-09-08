import { ActionActivityType } from "@alliance/common/actionActivity";
import {
  flattenPageItems,
  forEachCondition,
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { ForumService } from "src/forum/forum.service";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgAdvisoryLock } from "src/notifs/lock-utils";
import {
  CustomValidator,
  CustomValidatorType,
} from "src/tasks/entities/customvalidator.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import {
  DataSource,
  In,
  IsNull,
  QueryFailedError,
  type Repository,
} from "typeorm";
import { ActionsService } from "./actions.service";
import { ForumAutocompletePlan } from "./dto/action.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent } from "./entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";

const [PROCESS_ONE_LOCK_KEY1, PROCESS_ONE_LOCK_KEY2] =
  LOCK_KEYS.forumActionCompleter;
const AUTOCOMPLETE_TARGET_OFFSET_MS = 5 * 60 * 1000;
const AUTOCOMPLETE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class ForumActionCompleterWorker {
  private readonly logger = new Logger(ForumActionCompleterWorker.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(CustomValidator)
    private readonly customValidatorRepository: Repository<CustomValidator>,
    private readonly forumService: ForumService,
    private readonly actionsService: ActionsService,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly eventLogService: EventLogService,
  ) {}

  @Cron("*/5 * * * *")
  async autocompleteForumActions() {
    const ran = await withPgAdvisoryLock(
      this.dataSource,
      PROCESS_ONE_LOCK_KEY1,
      PROCESS_ONE_LOCK_KEY2,
      async () => {
        const now = new Date();
        const targetDeadlineMs = now.getTime() + AUTOCOMPLETE_TARGET_OFFSET_MS;
        const windowStartMs = targetDeadlineMs - AUTOCOMPLETE_WINDOW_MS;
        const windowEndMs = targetDeadlineMs + AUTOCOMPLETE_WINDOW_MS;

        const actions = await this.actionRepository
          .find({
            where: {
              isForumParticipationAction: true,
              computedAutocompleteAt: IsNull(),
            },
            relations: { events: true },
          })
          .then((rows) => rows.map(parseAction));

        for (const action of actions) {
          const { event: memberActionEvent, deadlineEvent } =
            action.memberActionPhase;

          // Only act while the action is currently mid-member-action: it has
          // started and its closing event hasn't happened yet.
          if (
            !memberActionEvent ||
            memberActionEvent.date > now ||
            !deadlineEvent ||
            deadlineEvent.date <= now
          ) {
            continue;
          }

          const deadlineMs = deadlineEvent.date.getTime();
          if (deadlineMs < windowStartMs || deadlineMs > windowEndMs) {
            continue;
          }

          await this.processAction({
            action,
            memberActionEvent,
            runAt: now,
          });
        }
      },
    );

    if (ran === null) {
      this.logger.log("autocompleteForumActions skipped bc of lock");
    }
  }

  async processAction(params: {
    action: ParsedAction;
    memberActionEvent: ActionEvent;
    runAt: Date;
    dryRun?: boolean;
  }): Promise<User[]> {
    const { action, memberActionEvent, runAt, dryRun = false } = params;
    const shouldWrite = !dryRun;

    if (!action.taskFormId) {
      if (shouldWrite) {
        this.logger.warn(
          `Action ${action.id} is missing task form for forum autocomplete`,
        );
        await this.markComputed(action.id, runAt);
      }
      return [];
    }

    const form = await this.formRepository.findOne({
      where: { id: action.taskFormId },
      relations: { formSnapshot: true },
    });
    if (!form) {
      if (shouldWrite) {
        this.logger.warn(
          `Action ${action.id} task form ${action.taskFormId} not found`,
        );
        await this.markComputed(action.id, runAt);
      }
      return [];
    }

    let postId: number;
    let replyMatchType: CustomValidatorType;

    if (action.forumParticipationPostId != null) {
      // Manual override takes precedence over any forum validator on the form.
      postId = action.forumParticipationPostId;
      replyMatchType = action.forumParticipationIncludeChildren
        ? CustomValidatorType.RepliedToForumPostOrChild
        : CustomValidatorType.RepliedToForumPost;
    } else {
      const forumValidator = await this.findForumValidator(form);
      if (!forumValidator) {
        if (shouldWrite) {
          this.logger.warn(
            `Action ${action.id} task form ${form.id} has no forum validator`,
          );
          await this.markComputed(action.id, runAt);
        }
        return [];
      }

      if (!forumValidator.idArgument) {
        if (shouldWrite) {
          this.logger.warn(
            `Action ${action.id} forum validator ${forumValidator.id} has no id argument`,
          );
          await this.markComputed(action.id, runAt);
        }
        return [];
      }

      const parsedPostId = Number(forumValidator.idArgument);
      if (!Number.isFinite(parsedPostId)) {
        if (shouldWrite) {
          this.logger.warn(
            `Action ${action.id} forum validator ${forumValidator.id} has invalid post id ${forumValidator.idArgument}`,
          );
          await this.markComputed(action.id, runAt);
        }
        return [];
      }

      postId = parsedPostId;
      replyMatchType = forumValidator.type;
    }

    const replyAuthorIds = await this.getReplyAuthorIds(postId, replyMatchType);

    if (replyAuthorIds.size === 0) {
      if (shouldWrite) {
        await this.markComputed(action.id, runAt);
      }
      return [];
    }

    const baseUsers =
      await this.actionEventRecipientService.findBaseUsersForEvent({
        action,
        eventId: memberActionEvent.id,
      });
    const baseUserIds = new Set(baseUsers.map((user) => user.id));
    const eligibleResponderIds = Array.from(replyAuthorIds).filter((id) =>
      baseUserIds.has(id),
    );

    if (eligibleResponderIds.length === 0) {
      if (shouldWrite) {
        await this.markComputed(action.id, runAt);
      }
      return [];
    }

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        userId: In(eligibleResponderIds),
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_WONT_COMPLETE,
        ]),
      },
    });

    const completedUserIds = new Set(
      completionActivities.map((activity) => activity.userId),
    );

    const formResponses = await this.formResponseRepository.find({
      where: {
        formId: form.id,
        user: { id: In(eligibleResponderIds) },
      },
      relations: { user: true },
    });

    const formResponseUserIds = new Set(
      formResponses
        .map((response) => response.user?.id)
        .filter((id): id is number => typeof id === "number"),
    );

    const toComplete = eligibleResponderIds.filter(
      (userId) =>
        !completedUserIds.has(userId) && !formResponseUserIds.has(userId),
    );

    const toCompleteSet = new Set(toComplete);
    const plannedUsers = baseUsers.filter((user) => toCompleteSet.has(user.id));

    if (shouldWrite) {
      for (const userId of toComplete) {
        try {
          await this.actionsService.completeAction(action.id, userId, {
            adminCreated: true,
          });
          await this.eventLogService.sendMessage({
            type: EventType.ForumActionAutocomplete,
            message: `Automatically completing action ${action.id} for user ${userId} based on forum participation`,
            userId: userId,
            blob: null,
          });
        } catch (error) {
          if (error instanceof QueryFailedError) {
            this.logger.warn(
              `Skipping duplicate completion for action ${action.id} user ${userId}: ${error.message}`,
            );
            continue;
          }
          throw error;
        }
      }

      await this.markComputed(action.id, runAt);
    }
    return plannedUsers;
  }

  private collectValidatorIds(schema: FormSchema): number[] {
    const validatorIds = new Set<number>();

    forEachCondition(schema, (condition) => {
      if (condition.kind === "validator") {
        validatorIds.add(condition.validatorId);
      }
    });

    // Field-level validators hang off the field itself rather than a condition,
    // so they aren't part of the condition walk.
    for (const page of schema.pages ?? []) {
      for (const element of flattenPageItems(page.fields ?? [])) {
        if (isQuestionField(element) && element.customValidatorId) {
          validatorIds.add(element.customValidatorId);
        }
      }
    }

    return Array.from(validatorIds);
  }

  async getAutocompletePlans(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<ForumAutocompletePlan[]> {
    const actions = await this.actionRepository
      .find({
        where: {
          isForumParticipationAction: true,
          computedAutocompleteAt: IsNull(),
        },
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));

    const plans: ForumAutocompletePlan[] = [];

    for (const action of actions) {
      const { event: memberActionEvent, deadlineEvent } =
        action.memberActionPhase;
      if (!memberActionEvent || !deadlineEvent) {
        continue;
      }
      const runAt = new Date(
        deadlineEvent.date.getTime() - AUTOCOMPLETE_TARGET_OFFSET_MS,
      );
      if (
        runAt < rangeStart ||
        runAt > rangeEnd ||
        runAt < memberActionEvent.date
      ) {
        continue;
      }

      const users = await this.processAction({
        action,
        memberActionEvent,
        runAt,
        dryRun: true,
      });

      if (users.length === 0) {
        continue;
      }

      plans.push({ date: runAt, users, action });
    }

    return plans.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private async findForumValidator(
    form: Form,
  ): Promise<CustomValidator | null> {
    const schema = form.formSnapshot.schema as unknown as FormSchema;
    const validatorIds = this.collectValidatorIds(schema);
    if (validatorIds.length === 0) {
      return null;
    }

    const validators = await this.customValidatorRepository.find({
      where: { id: In(validatorIds) },
    });

    return (
      validators.find(
        (validator) =>
          validator.type === CustomValidatorType.RepliedToForumPost ||
          validator.type === CustomValidatorType.RepliedToForumPostOrChild,
      ) ?? null
    );
  }

  private async getReplyAuthorIds(
    postId: number,
    type: CustomValidatorType,
  ): Promise<Set<number>> {
    if (type === CustomValidatorType.RepliedToForumPost) {
      const replies = await this.forumService.findCommentsForPost(postId);
      return new Set(replies.map((reply) => reply.authorId));
    }

    if (type === CustomValidatorType.RepliedToForumPostOrChild) {
      const replies = await this.forumService.findCommentsForPostRaw(postId);
      return new Set(replies.map((reply) => reply.authorId));
    }

    return new Set();
  }

  private async markComputed(actionId: number, computedAt: Date) {
    await this.actionRepository.update(actionId, {
      computedAutocompleteAt: computedAt,
    });
  }
}
