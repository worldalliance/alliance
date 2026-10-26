import {
  ActionActivityType,
  MEMBER_ACTION_DEADLINE_PASSED,
  WITHDRAWAL_OPTION_LABELS,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { writeUnderLive } from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { PosthogService } from "src/posthog/posthog.service";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { isTerminalActivity } from "./action-activity-status";
import { ActionsService } from "./actions.service";
import {
  ActionActivityDto,
  CreateActionActivityDto,
} from "./dto/action-activity.dto";
import {
  ActionActivity,
  ActivitySource,
  ALLOW_DUPLICATE,
} from "./entities/action-activity.entity";
import { Action, type ParsedAction } from "./entities/action.entity";
import { assertNotInStaffPreview } from "./staff-preview";
import { CompletionBlock } from "./user-action-status";

/**
 * Withdrawal reasons longer than this are truncated in the opt-out event-log
 * message to keep the Slack copy readable; the full reason is still stored on
 * the activity row and in the event's blob.
 */
const OPT_OUT_REASON_PREVIEW_LENGTH = 300;

const COMPLETION_UNAVAILABLE = "This action is not available to you";

const COMPLETION_BLOCK_MESSAGE: Record<CompletionBlock, string> = {
  [CompletionBlock.PreventCompletion]: COMPLETION_UNAVAILABLE,
  [CompletionBlock.NotInCohort]: COMPLETION_UNAVAILABLE,
  [CompletionBlock.DeadlinePassed]: MEMBER_ACTION_DEADLINE_PASSED,
  [CompletionBlock.OnboardingContractUnsigned]: COMPLETION_UNAVAILABLE,
};

@Injectable()
export class ActionActivityService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionsService: ActionsService,
    private readonly userService: UserService,
    private readonly eventLogService: EventLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly posthogService: PosthogService,
  ) {}

  async dismissAction(
    userId: number,
    actionId: number,
  ): Promise<ActionActivity> {
    return await this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_DISMISSED,
    });
  }

  async createActionActivity(options: {
    actionId: number;
    userId: number;
    type: ActionActivityType;
    taskFormResponse?: FormResponse;
    declineReason?: string;
    isOutOfTime?: boolean;
    isMoral?: boolean;
    adminCreated?: boolean;
    now?: Date;
  }): Promise<ActionActivity> {
    const {
      actionId,
      userId,
      type,
      taskFormResponse,
      declineReason,
      isOutOfTime,
      isMoral,
      adminCreated,
      now = new Date(),
    } = options;
    const action = await this.actionsService.findOneOrFail({
      id: actionId,
      userId,
    });

    if (!adminCreated) {
      assertNotInStaffPreview(action);
    }

    if (
      type === ActionActivityType.USER_WONT_COMPLETE &&
      action.isContractSigningAction &&
      !adminCreated
    ) {
      throw new BadRequestException(
        "Contract signing actions cannot be withdrawn from",
      );
    }

    if (type === ActionActivityType.USER_COMPLETED && !adminCreated) {
      await this.ensureCompletionAllowed({ action, userId, now });
    }

    const user = await this.userService.findOneOrFail(userId);

    if (!ALLOW_DUPLICATE[type]) {
      const existingActivity = await this.actionActivityRepository.findOne({
        where: { actionId, userId, type },
      });
      if (existingActivity) {
        throw new BadRequestException("Activity already exists");
      }
    }

    const activity = this.actionActivityRepository.create({
      type: type,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      taskFormResponse,
      declineReason: declineReason ?? null,
      outOfTime: isOutOfTime,
      isMoral,
      source: adminCreated
        ? ActivitySource.ADMIN_OVERRIDE
        : ActivitySource.USER,
    });
    const savedActivity = await writeUnderLive(
      this.actionActivityRepository.manager,
      {
        parents: [
          {
            target: Action,
            id: actionId,
            notFound: "That action is no longer here",
          },
          { target: User, id: userId },
          ...(taskFormResponse
            ? [
                {
                  target: FormResponse,
                  id: taskFormResponse.id,
                  notFound: "That form response is no longer here",
                },
              ]
            : []),
        ],
        write: (manager) => manager.save(activity),
      },
    );

    if (type === ActionActivityType.USER_WONT_COMPLETE) {
      const option = withdrawalOptionFromFlags({
        outOfTime: isOutOfTime,
        isMoral,
      });
      const trimmedReason = declineReason?.trim();
      // Spread to code points so truncation can't split a surrogate pair
      // (e.g. an emoji) at the boundary.
      const reasonChars = trimmedReason ? [...trimmedReason] : [];
      const reason =
        reasonChars.length > OPT_OUT_REASON_PREVIEW_LENGTH
          ? `${reasonChars.slice(0, OPT_OUT_REASON_PREVIEW_LENGTH).join("")}...`
          : trimmedReason;
      const label = adminCreated
        ? "admin-created"
        : WITHDRAWAL_OPTION_LABELS[option];
      const detail = reason ? `${label}: ${reason}` : label;
      this.eventLogService.sendMessage({
        type: EventType.ActionOptOut,
        message: `${user.name} opted out of action ${action.name} (${detail})`,
        userId,
        blob: {
          actionId,
          declineReason,
          outOfTime: isOutOfTime,
          isMoral,
          adminCreated: adminCreated ?? false,
        },
      });
    }

    this.eventEmitter.emit("action.activity", {
      actionId,
      activity: new ActionActivityDto(savedActivity),
    });

    await this.actionsService.reloadUsersJoinedForAction(actionId);
    if (isTerminalActivity(savedActivity)) {
      await this.actionsService.reloadUsersCompletedForAction(actionId);
    }
    if (type === ActionActivityType.USER_COMPLETED) {
      if (!adminCreated) {
        this.posthogService.capture({
          event: AnalyticsEvent.ActionCompleted,
          distinctId: String(userId),
          properties: { actionId, actionName: action.name },
        });
      }
    }

    return savedActivity;
  }

  async completeAction(
    actionId: number,
    userId: number,
    options: {
      taskFormResponse?: FormResponse;
      adminCreated?: boolean;
      now?: Date;
    } = {},
  ): Promise<ActionActivity> {
    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_COMPLETED,
      taskFormResponse: options.taskFormResponse,
      adminCreated: options.adminCreated,
      now: options.now,
    });
  }

  async ensureCompletionAllowed(params: {
    action: ParsedAction;
    userId: number;
    now: Date;
  }) {
    const { action, userId, now } = params;
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
      awayRanges: true,
    });
    const block = await this.actionsService.findCompletionBlock({
      action,
      user,
      now,
    });
    if (block !== null) {
      throw new ForbiddenException(COMPLETION_BLOCK_MESSAGE[block]);
    }
  }

  async adminCreateActivity(
    activityDto: CreateActionActivityDto,
  ): Promise<ActionActivity> {
    return this.createActionActivity({
      actionId: activityDto.actionId,
      userId: activityDto.userId,
      type: activityDto.type,
      adminCreated: true,
    });
  }
}
