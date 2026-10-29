import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { NotifsService } from "src/notifs/notifs.service";
import { displayOnlySchemaOf } from "src/tasks/display-only-snapshot";
import { loadedTagUsers } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { EntityManager, type Repository } from "typeorm";
import { TagService } from "../user/tag.service";
import { UserService } from "../user/user.service";
import { ActionParticipantsService } from "./action-participants.service";
import {
  readRecognitionConfig,
  usesRecognition,
  type RecognitionPreviewCounts,
} from "./action-update-recognition";
import { ActionUpdateRecognitionPreviewService } from "./action-update-recognition-preview.service";
import { ActionUpdateRecognitionService } from "./action-update-recognition.service";
import { checkActionShowsWhenEntriesArrive } from "./action-update-visibility";
import { ActionUpdatesService } from "./action-updates.service";
import { CohortDecisionService } from "./cohort-decision.service";
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from "./entities/action-update.entity";
import { Action, loadedActionEvents } from "./entities/action.entity";

@Injectable()
export class ActionUpdateNotifyService {
  private readonly logger = new Logger(ActionUpdateNotifyService.name);

  constructor(
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    private readonly actionUpdates: ActionUpdatesService,
    private readonly userService: UserService,
    private readonly tagService: TagService,
    private readonly notifsService: NotifsService,
    private readonly recognitionService: ActionUpdateRecognitionService,
    private readonly cohortDecisionService: CohortDecisionService,
    private readonly participants: ActionParticipantsService,
    private readonly recognitionPreview: ActionUpdateRecognitionPreviewService,
  ) {}

  /**
   * Sends the notification an update was created with, after its body exists.
   * Once-only: the claim on `notifiedAt` is what makes a double-click, or two
   * admins on the same update, send one notification rather than two.
   */
  async notifyActionUpdate(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.actionUpdates.findOneActionUpdate(id);
    const schema = displayOnlySchemaOf({
      owner: "ActionUpdate",
      ownerId: actionUpdate.id,
      snapshot: actionUpdate.schemaSnapshot,
    });

    if (actionUpdate.notifyType === ActionUpdateNotifyType.None) {
      throw new BadRequestException(
        "This update has no notification audience set.",
      );
    }
    if (schema.blocks.length === 0) {
      throw new BadRequestException(
        "Write the update body before sending the notification.",
      );
    }
    if (actionUpdate.notifiedAt) {
      throw new ConflictException(
        "This update has already been notified about.",
      );
    }
    await this.assertActionShowsWhenEntriesArrive(actionUpdate);

    // Resolve the audience before claiming: a failure here (a deleted tag, say)
    // has sent nothing, and leaving the claim unset keeps the retry open.
    const recipients = await this.findActionUpdateNotifRecipients(actionUpdate);
    const recognition = usesRecognition(actionUpdate.notificationMode);
    if (recognition) {
      const config = readRecognitionConfig(actionUpdate);
      if (!config.ok) throw new BadRequestException(config.error);
    } else if (!actionUpdate.shortNotifString.trim()) {
      throw new BadRequestException(
        "Write the notification text before sending.",
      );
    }

    // The claim and the sends commit together. The claim is the only thing
    // standing between a retry and a second notification, so committing it
    // before the rows exist would let a crash partway through leave most of the
    // audience unnotified and unreachable: the retry would see the claim and
    // conflict.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      // An archive of the action waits until the sends commit. Locking the
      // action before the update matches the order deleting an action takes.
      const lockedActions: unknown[] = await em.query(
        'SELECT id FROM action WHERE id = $1 AND "deletedAt" IS NULL FOR SHARE',
        [actionUpdate.actionId],
      );
      if (lockedActions.length === 0) {
        throw new NotFoundException("This update's action has been deleted.");
      }

      const claimed = await em
        .createQueryBuilder()
        .update(ActionUpdate)
        .set({ notifiedAt: new Date() })
        .where("id = :id", { id })
        .andWhere('"notifiedAt" IS NULL')
        .execute();

      if (claimed.affected === 0) {
        throw new ConflictException(
          "This update has already been notified about.",
        );
      }

      // The claim holds the row lock, so this reads the update as of any
      // edit or unpublish that committed first.
      const claimedUpdate = await em.findOneBy(ActionUpdate, { id });
      if (!claimedUpdate) {
        throw new NotFoundException("This update has been deleted.");
      }
      await this.assertActionShowsWhenEntriesArrive(claimedUpdate, em);
      if (recognition) {
        await this.recognitionService.recordAudience({
          em,
          actionUpdateId: id,
          userIds: recipients.map((user) => user.id),
        });
      } else {
        await this.notifsService.createActionUpdateNotifs({
          actionUpdate: claimedUpdate,
          users: recipients,
          em,
        });
      }
    });

    if (recognition) {
      // The send is already claimed and the cron retries preparing it, so a
      // failure here mustn't report the send itself as failed.
      await this.recognitionService
        .prepare(id, new Date())
        .catch((error: unknown) =>
          this.logger.error(`preparing action update ${id} failed`, error),
        );
    }
    return this.actionUpdates.findOneActionUpdate(id);
  }

  private async assertActionShowsWhenEntriesArrive(
    actionUpdate: ActionUpdate,
    em: EntityManager = this.actionUpdateRepository.manager,
  ) {
    const action = await em.findOneOrFail(Action, {
      where: { id: actionUpdate.actionId },
      relations: { events: true },
    });
    const check = checkActionShowsWhenEntriesArrive({
      action: { archived: action.archived, events: loadedActionEvents(action) },
      actionUpdate,
      now: new Date(),
    });
    if (!check.ok) {
      throw new BadRequestException(check.error);
    }
  }

  private async findActionUpdateNotifRecipients(
    actionUpdate: ActionUpdate,
  ): Promise<User[]> {
    return this.findActionUpdateAudience({
      actionId: actionUpdate.actionId,
      notifyType: actionUpdate.notifyType,
      tagId: actionUpdate.tag?.id ?? null,
      decideCohort: true,
    });
  }

  /** Without `decideCohort`, reads only saved cohort decisions and writes nothing. */
  private async findActionUpdateAudience(params: {
    actionId: number;
    notifyType: ActionUpdateNotifyType;
    tagId: string | null;
    decideCohort: boolean;
  }): Promise<User[]> {
    const { actionId, notifyType, tagId } = params;
    switch (notifyType) {
      case ActionUpdateNotifyType.None:
        return [];
      case ActionUpdateNotifyType.ActionCohort: {
        const action = await this.participants.findParticipantAction(actionId);
        if (params.decideCohort) {
          // One send and no retry, so it cannot wait for the pass.
          await this.cohortDecisionService.decideOpenAction(action, new Date());
        }
        const userIds =
          await this.participants.findParticipantIdsForAction(action);
        return this.userService.findByIds(userIds);
      }
      case ActionUpdateNotifyType.Tag: {
        if (!tagId) {
          throw new BadRequestException("Tag is required");
        }
        return loadedTagUsers(await this.tagService.findTagOrFail(tagId));
      }
      case ActionUpdateNotifyType.AllMembers:
        return this.userService.findUsersWithActiveContract();
      default:
        throw new Error(`unknown notifyType: ${notifyType satisfies never}`);
    }
  }

  async previewActionUpdateRecognitionCounts(
    id: number,
    audience: { notifyType: ActionUpdateNotifyType; tagId: string | null },
  ): Promise<RecognitionPreviewCounts> {
    const { actionId } = await this.actionUpdates.findOneActionUpdate(id);
    const recipients = await this.findActionUpdateAudience({
      actionId,
      ...audience,
      decideCohort: false,
    });
    return this.recognitionPreview.counts({
      actionId,
      userIds: recipients.map((user) => user.id),
    });
  }
}
