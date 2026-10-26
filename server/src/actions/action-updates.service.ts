import { emptyDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { run } from "@alliance/common/run";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { max } from "date-fns";
import {
  assertLive,
  softDeleteCascade,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { NotifsService } from "src/notifs/notifs.service";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { Tag } from "src/user/entities/tag.entity";
import { EntityManager, type Repository } from "typeorm";
import {
  actionUpdateEntrySendTime,
  publishedActionUpdateWhere,
} from "./action-update-visibility";
import { ActionVisibilityService } from "./action-visibility.service";
import {
  CreateActionUpdateDto,
  UpdateActionUpdateDto,
} from "./dto/action-update.dto";
import { ActionEvent } from "./entities/action-event.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  lockActionUpdateRow,
} from "./entities/action-update.entity";
import { Action } from "./entities/action.entity";
import { SchemaWriteService } from "./schema-write.service";

@Injectable()
export class ActionUpdatesService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly formSnapshotService: FormSnapshotService,
    private readonly notifsService: NotifsService,
    private readonly schemaWrite: SchemaWriteService,
    private readonly actionVisibility: ActionVisibilityService,
  ) {}

  async createActionUpdate(
    id: number,
    createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdate> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id },
    });
    const emptySnapshot = await this.formSnapshotService.findOrCreate(
      emptyDisplayOnlySchema(),
    );

    let tag: Tag | undefined = undefined;
    if (createActionUpdateDto.tagId) {
      tag = await this.tagRepository.findOneOrFail({
        where: { id: createActionUpdateDto.tagId },
      });
    }

    let associatedEvent: ActionEvent | undefined = undefined;
    if (createActionUpdateDto.associatedEventId) {
      associatedEvent = await this.actionEventRepository.findOneOrFail({
        where: { id: createActionUpdateDto.associatedEventId },
      });
    }

    const actionUpdate = await writeUnderLive(
      this.actionUpdateRepository.manager,
      {
        parents: [
          { target: Action, id: action.id, notFound: "Action not found" },
          ...(tag ? [{ target: Tag, id: tag.id }] : []),
          ...(associatedEvent
            ? [{ target: ActionEvent, id: associatedEvent.id }]
            : []),
        ],
        write: (em) =>
          em.save(
            em.create(ActionUpdate, {
              ...createActionUpdateDto,
              notificationMode: ActionUpdateNotificationMode.Normal,
              schemaSnapshotId: emptySnapshot.id,
              visibleAt: null,
              action,
              tag,
              associatedEvent,
            }),
          ),
      },
    );

    await this.formSnapshotService.recordHistorical({
      owner: SnapshotHistoryOwner.ActionUpdate,
      ownerId: actionUpdate.id,
      snapshotId: emptySnapshot.id,
    });

    // `notifyType` is only the plan here — the update is created empty, so
    // dispatching now would notify members about a body nobody has written yet.
    // It stays unpublished (`visibleAt` null) until the body is written, and
    // `notifyActionUpdate` sends it from the editor after that.
    return this.findOneActionUpdate(actionUpdate.id);
  }

  private async lockActionUpdate(
    id: number,
    em: EntityManager,
  ): Promise<ActionUpdate> {
    await lockActionUpdateRow(em, id);
    return this.findOneActionUpdate(id, em);
  }

  async findOneActionUpdate(
    id: number,
    em?: EntityManager,
  ): Promise<ActionUpdate> {
    const manager = em ?? this.actionUpdateRepository.manager;
    return manager.findOneOrFail(ActionUpdate, {
      where: { id },
      relations: {
        schemaSnapshot: true,
        action: true,
        tag: true,
        associatedEvent: true,
      },
    });
  }

  async updateActionUpdate(
    id: number,
    dto: UpdateActionUpdateDto,
  ): Promise<ActionUpdate> {
    const {
      schema,
      expectedSchemaSnapshotId,
      tagId,
      associatedEventId,
      ...rest
    } = dto;

    // Guards non-HTTP callers too, where the DTO's `@ValidateIf` never runs.
    const schemaWrite = run(() => {
      if (schema === undefined) return null;
      if (expectedSchemaSnapshotId === undefined) {
        throw new BadRequestException(
          "expectedSchemaSnapshotId is required when writing schema",
        );
      }
      return { schema, expectedSchemaSnapshotId };
    });

    // The freeze takes its own pool connections, so it runs before the
    // transaction rather than while holding one.
    if (
      rest.shortNotifString !== undefined &&
      rest.shortNotifString !==
        (await this.actionUpdateRepository.findOneByOrFail({ id }))
          .shortNotifString
    ) {
      await this.notifsService.freezeActionUpdateCopy(id);
    }

    // Same locking rationale as `updateGeneralUpdate`: `save` writes back every
    // column that differs from the entity read here, so an unlocked
    // read-modify-write would revert a concurrent schema save.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      // The action first: deleting it locks the action before any of its
      // cascades reach the update or event, whichever order those fire in.
      const { actionId } = await em.findOneByOrFail(ActionUpdate, { id });
      await assertLive(em, {
        rows: [
          { target: Action, id: actionId },
          ...(tagId == null ? [] : [{ target: Tag, id: tagId }]),
          ...(associatedEventId == null
            ? []
            : [{ target: ActionEvent, id: associatedEventId }]),
        ],
        gone: () => new NotFoundException("Action, tag or event not found"),
      });
      const actionUpdate = await this.lockActionUpdate(id, em);
      // Before the schema write, so publishing sees the `date` this request sets.
      Object.assign(actionUpdate, rest);
      const now = new Date();
      if (
        rest.date !== undefined &&
        actionUpdate.visibleAt !== null &&
        actionUpdate.visibleAt > now
      ) {
        actionUpdate.visibleAt = max([now, actionUpdate.date]);
      }

      if (schemaWrite) {
        const written = await this.schemaWrite.writeSchemaOrThrow({
          owner: SnapshotHistoryOwner.ActionUpdate,
          id,
          ...schemaWrite,
          em,
        });
        actionUpdate.schemaSnapshotId = written.snapshotId;
        // The loaded relation still holds the previous snapshot, and TypeORM
        // lets a relation object win over the FK column — leaving it set would
        // make the `save` below write the old id straight back over the one
        // just written.
        actionUpdate.schemaSnapshot = undefined;

        // Writing a body is what publishes the update. Emptying one again
        // deliberately does not retract it: members may already have seen or
        // been notified about it, so unpublishing is an explicit act, not a
        // side effect of clearing the editor.
        if (actionUpdate.visibleAt === null && written.schema.blocks.length) {
          actionUpdate.visibleAt = max([now, actionUpdate.date]);
        }
      }

      if (tagId !== undefined) {
        actionUpdate.tag =
          tagId === null ? null : await em.findOneByOrFail(Tag, { id: tagId });
      }

      if (associatedEventId !== undefined) {
        actionUpdate.associatedEvent =
          associatedEventId === null
            ? null
            : await em.findOneByOrFail(ActionEvent, { id: associatedEventId });
      }

      await em.save(actionUpdate);
      if (rest.date !== undefined) {
        await this.notifsService.retimeActionUpdateEntries({
          em,
          actionUpdateId: id,
          sendTime: actionUpdateEntrySendTime(actionUpdate),
        });
      }
    });

    return this.findOneActionUpdate(id);
  }

  /**
   * Hides a published update again until its displayed date, for one whose
   * date was moved later after it published. Moving `visibleAt` up to `date`
   * lets the `visibleAt <= now` gate republish it when that date arrives.
   */
  async unpublishActionUpdateUntilDate(id: number): Promise<ActionUpdate> {
    // Before the transaction, as in `updateActionUpdate`.
    await this.notifsService.freezeActionUpdateCopy(id);
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      const actionUpdate = await this.lockActionUpdate(id, em);
      const now = new Date();

      if (actionUpdate.visibleAt === null) {
        throw new BadRequestException(
          "This update has not been published yet.",
        );
      }
      if (actionUpdate.date <= now) {
        throw new BadRequestException(
          "The displayed date has already passed, so hiding the update until then would leave it visible.",
        );
      }

      await em.update(ActionUpdate, id, { visibleAt: actionUpdate.date });
      await this.notifsService.retimeActionUpdateEntries({
        em,
        actionUpdateId: id,
        sendTime: actionUpdate.date,
      });
    });

    return this.findOneActionUpdate(id);
  }

  /**
   * Undoes `unpublishActionUpdateUntilDate` before the date it waits for. The
   * entries it moved to that date stay there.
   */
  async publishActionUpdateNow(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.findOneActionUpdate(id);
    const now = new Date();

    if (actionUpdate.visibleAt === null || actionUpdate.visibleAt <= now) {
      throw new BadRequestException(
        "This update is not waiting on a future date.",
      );
    }

    await this.actionUpdateRepository.update(id, { visibleAt: now });

    return this.findOneActionUpdate(id);
  }

  async deleteActionUpdate(id: number) {
    const actionUpdate = await this.actionUpdateRepository.findOneOrFail({
      where: { id },
    });
    await softDeleteCascade(this.actionUpdateRepository.manager, {
      target: ActionUpdate,
      ids: [actionUpdate.id],
    });
    return actionUpdate;
  }

  async getActionUpdates(
    limit?: number,
    userId?: number,
  ): Promise<ActionUpdate[]> {
    const updates = await this.actionUpdateRepository.find({
      where: publishedActionUpdateWhere(new Date()),
      order: { date: "DESC" },
      relations: { action: true, schemaSnapshot: true },
      select: {
        action: {
          name: true,
        },
      },
    });
    const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
      actionIds: updates.map((update) => update.actionId),
      userId,
    });
    const visible = updates.filter((update) => visibleIds.has(update.actionId));
    return limit != null ? visible.slice(0, limit) : visible;
  }
}
