import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ForumService } from 'src/forum/forum.service';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import { withPgAdvisoryLock } from 'src/notifs/lock-utils';
import {
    CustomValidator,
    CustomValidatorType,
} from 'src/tasks/entities/customvalidator.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { FormSchema } from 'src/tasks/schema';
import { DataSource, In, IsNull, QueryFailedError, type Repository } from 'typeorm';
import { ActionsService } from './actions.service';
import { ActionSummaryDto, ForumAutocompletePlanDto } from './dto/action.dto';
import {
    ActionActivity,
    ActionActivityType,
} from './entities/action-activity.entity';
import { ActionEvent, ActionStatus } from './entities/action-event.entity';
import { Action } from './entities/action.entity';
import { ProfileDto } from 'src/user/dto/user.dto';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { EventType } from 'src/eventlog/event-log.entity';

const PROCESS_ONE_LOCK_KEY1 = 0xf0a1;
const PROCESS_ONE_LOCK_KEY2 = 0xace1;
const AUTOCOMPLETE_TARGET_OFFSET_MS = 60 * 60 * 1000;
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
    ) { }

    @Cron('*/5 * * * *')
    async autocompleteForumActions() {
        const ran = await withPgAdvisoryLock(
            this.dataSource,
            PROCESS_ONE_LOCK_KEY1,
            PROCESS_ONE_LOCK_KEY2,
            async () => {
                const now = new Date();
                const targetDeadlineMs =
                    now.getTime() + AUTOCOMPLETE_TARGET_OFFSET_MS;
                const windowStartMs = targetDeadlineMs - AUTOCOMPLETE_WINDOW_MS;
                const windowEndMs = targetDeadlineMs + AUTOCOMPLETE_WINDOW_MS;

                const actions = await this.actionRepository.find({
                    where: {
                        isForumParticipationAction: true,
                        computedAutocompleteAt: IsNull(),
                    },
                    relations: { events: true },
                });

                for (const action of actions) {
                    const memberActionPhase = this.getCurrentMemberActionPhase(
                        action.events,
                        now,
                    );
                    if (!memberActionPhase) {
                        continue;
                    }

                    const deadline = memberActionPhase.deadline;
                    if (!deadline) {
                        continue;
                    }

                    const deadlineMs = deadline.getTime();
                    if (deadlineMs < windowStartMs || deadlineMs > windowEndMs) {
                        continue;
                    }

                    await this.processAction({
                        action,
                        memberActionEvent: memberActionPhase.memberActionEvent,
                        runAt: now,
                    });
                }
            },
        );

        if (ran === null) {
            this.logger.log('autocompleteForumActions skipped bc of lock');
        }
    }

    async processAction(params: {
        action: Action;
        memberActionEvent: ActionEvent;
        runAt: Date;
        dryRun?: boolean;
    }): Promise<ProfileDto[]> {
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

        const postId = Number(forumValidator.idArgument);
        if (!Number.isFinite(postId)) {
            if (shouldWrite) {
                this.logger.warn(
                    `Action ${action.id} forum validator ${forumValidator.id} has invalid post id ${forumValidator.idArgument}`,
                );
                await this.markComputed(action.id, runAt);
            }
            return [];
        }

        const replyAuthorIds = await this.getReplyAuthorIds(
            postId,
            forumValidator.type,
        );

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
                eventStatus: ActionStatus.MemberAction,
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
                    ActionActivityType.USER_DECLINED,
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
                .filter((id): id is number => typeof id === 'number'),
        );

        const toComplete = eligibleResponderIds.filter(
            (userId) =>
                !completedUserIds.has(userId) && !formResponseUserIds.has(userId),
        );

        const toCompleteSet = new Set(toComplete);
        const plannedUsers = baseUsers
            .filter((user) => toCompleteSet.has(user.id))
            .map((user) => new ProfileDto(user));

        if (shouldWrite) {
            for (const userId of toComplete) {
                try {
                    await this.actionsService.completeAction(action.id, userId, { adminCreated: true });
                    await this.eventLogService.sendMessage({
                        type: EventType.ForumActionAutocomplete,
                        message: `Automatically completing action ${action.id} for user ${userId} based on forum participation`,
                        userId: userId,
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

        for (const page of schema.pages ?? []) {
            for (const element of page.fields ?? []) {
                if ('customValidatorId' in element && element.customValidatorId) {
                    validatorIds.add(element.customValidatorId);
                }
                if ('requiredIf' in element && element.requiredIf) {
                    const requiredIf = element.requiredIf;
                    if ('validatorId' in requiredIf) {
                        validatorIds.add(requiredIf.validatorId);
                    }
                }
                const conditions = Array.isArray(element.visibleIf)
                    ? element.visibleIf
                    : element.visibleIf
                        ? [element.visibleIf]
                        : [];
                for (const condition of conditions) {
                    if ('validatorId' in condition) {
                        validatorIds.add(condition.validatorId);
                    }
                }
            }
        }

        return Array.from(validatorIds);
    }

    async getAutocompletePlans(
        rangeStart: Date,
        rangeEnd: Date,
    ): Promise<ForumAutocompletePlanDto[]> {
        const actions = await this.actionRepository.find({
            where: {
                isForumParticipationAction: true,
                computedAutocompleteAt: IsNull(),
            },
            relations: { events: true },
        });

        const plans: ForumAutocompletePlanDto[] = [];

        for (const action of actions) {
            const phases = this.getMemberActionPhases(action.events);
            const upcomingPhase = phases
                .map((phase) => ({
                    ...phase,
                    runAt: phase.deadline
                        ? new Date(
                            phase.deadline.getTime() - AUTOCOMPLETE_TARGET_OFFSET_MS,
                        )
                        : null,
                }))
                .filter(
                    (phase) =>
                        phase.runAt &&
                        phase.deadline &&
                        phase.runAt >= rangeStart &&
                        phase.runAt <= rangeEnd &&
                        phase.runAt >= phase.memberActionEvent.date,
                )
                .sort((a, b) => a.runAt!.getTime() - b.runAt!.getTime())[0];

            if (!upcomingPhase || !upcomingPhase.runAt) {
                continue;
            }

            const users = await this.processAction({
                action,
                memberActionEvent: upcomingPhase.memberActionEvent,
                runAt: upcomingPhase.runAt,
                dryRun: true,
            });

            if (users.length === 0) {
                continue;
            }

            const plan = new ForumAutocompletePlanDto();
            plan.date = upcomingPhase.runAt;
            plan.users = users;
            plan.action = new ActionSummaryDto(action);
            plans.push(plan);
        }

        return plans.sort(
            (a, b) => a.date.getTime() - b.date.getTime(),
        );
    }

    private getCurrentMemberActionPhase(
        events: ActionEvent[],
        now: Date,
    ): { memberActionEvent: ActionEvent; deadline: Date | null } | null {
        if (!events || events.length === 0) {
            return null;
        }

        const sortedEvents = events.toSorted(
            (a, b) => a.date.getTime() - b.date.getTime(),
        );
        const pastEvents = sortedEvents.filter((event) => event.date <= now);
        const latestPastEvent = pastEvents[pastEvents.length - 1];
        if (
            !latestPastEvent ||
            latestPastEvent.newStatus !== ActionStatus.MemberAction
        ) {
            return null;
        }

        const memberActionEvent = [...pastEvents]
            .reverse()
            .find((event) => event.newStatus === ActionStatus.MemberAction);
        if (!memberActionEvent) {
            return null;
        }

        const deadlineEvent =
            sortedEvents.find(
                (event) =>
                    event.date > memberActionEvent.date &&
                    event.newStatus !== ActionStatus.MemberAction,
            ) ?? null;

        return {
            memberActionEvent,
            deadline: deadlineEvent?.date ?? null,
        };
    }

    private getMemberActionPhases(
        events: ActionEvent[],
    ): Array<{ memberActionEvent: ActionEvent; deadline: Date | null }> {
        if (!events || events.length === 0) {
            return [];
        }

        const sortedEvents = events.toSorted(
            (a, b) => a.date.getTime() - b.date.getTime(),
        );

        const phases: Array<{
            memberActionEvent: ActionEvent;
            deadline: Date | null;
        }> = [];

        for (let i = 0; i < sortedEvents.length; i += 1) {
            const event = sortedEvents[i];
            if (event.newStatus !== ActionStatus.MemberAction) {
                continue;
            }

            const deadlineEvent =
                sortedEvents.slice(i + 1).find(
                    (candidate) => candidate.newStatus !== ActionStatus.MemberAction,
                ) ?? null;

            phases.push({
                memberActionEvent: event,
                deadline: deadlineEvent?.date ?? null,
            });
        }

        return phases;
    }

    private async findForumValidator(
        form: Form,
    ): Promise<CustomValidator | null> {
        const schema = form.schema as unknown as FormSchema;
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
