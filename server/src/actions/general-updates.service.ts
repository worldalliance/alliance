import { emptyDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { run } from "@alliance/common/run";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere, writeUnderLive } from "src/datasources/soft-delete";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { computeIsTaggedOrInManualCohort } from "src/utils/action-user";
import { startDatePriorityComparator } from "src/utils/general-update";
import {
  EntityManager,
  In,
  IsNull,
  LessThan,
  MoreThan,
  Or,
  type Repository,
} from "typeorm";
import { UserService } from "../user/user.service";
import {
  CreateGeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from "./dto/general-update.dto";
import {
  ActionSuite,
  loadedActionSuiteActions,
} from "./entities/action-suite.entity";
import {
  GeneralUpdateActivity,
  GeneralUpdateActivityType,
} from "./entities/general-update-activity.entity";
import {
  GeneralUpdate,
  loadedGeneralUpdateTags,
} from "./entities/general-update.entity";
import { lockLiveTagsAndSuites } from "./general-update-locks";
import { shiftPrioritiesAfterInsertion } from "./priority-order";
import { SchemaWriteService } from "./schema-write.service";

@Injectable()
export class GeneralUpdatesService {
  constructor(
    @InjectRepository(GeneralUpdate)
    private readonly generalUpdateRepository: Repository<GeneralUpdate>,
    @InjectRepository(GeneralUpdateActivity)
    private readonly generalUpdateActivityRepository: Repository<GeneralUpdateActivity>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    private readonly userService: UserService,
    private readonly formSnapshotService: FormSnapshotService,
    private readonly schemaWrite: SchemaWriteService,
  ) {}

  async findAllGeneralUpdates(): Promise<GeneralUpdate[]> {
    const now = new Date();
    return (
      await this.generalUpdateRepository.find({
        where: {
          startDate: LessThan(now),
        },
        relations: { schemaSnapshot: true },
      })
    ).sort(startDatePriorityComparator);
  }

  async findAllGeneralUpdatesAdmin(): Promise<GeneralUpdate[]> {
    return (
      await this.generalUpdateRepository.find({
        relations: { schemaSnapshot: true, tags: true, suites: true },
      })
    ).sort(startDatePriorityComparator);
  }

  async findOneGeneralUpdate(
    id: number,
    em?: EntityManager,
  ): Promise<GeneralUpdate> {
    const manager = em ?? this.generalUpdateRepository.manager;
    return await manager.findOneOrFail(GeneralUpdate, {
      where: { id },
      relations: { schemaSnapshot: true, tags: true, suites: true },
    });
  }

  async createGeneralUpdate(
    dto: CreateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const { tagIds, suiteIds, ...rest } = dto;
    const emptySnapshot = await this.formSnapshotService.findOrCreate(
      emptyDisplayOnlySchema(),
    );
    const generalUpdate = this.generalUpdateRepository.create({
      ...rest,
      schemaSnapshotId: emptySnapshot.id,
    });

    if (tagIds && tagIds.length > 0) {
      generalUpdate.tags = await this.tagRepository.findBy({
        id: In(tagIds),
      });
    }

    if (suiteIds && suiteIds.length > 0) {
      generalUpdate.suites = await this.actionSuiteRepository.findBy({
        id: In(suiteIds),
      });
    }

    const saved = await this.generalUpdateRepository.manager.transaction(
      async (em) => {
        await lockLiveTagsAndSuites(em, generalUpdate);
        return em.save(generalUpdate);
      },
    );

    await this.formSnapshotService.recordHistorical({
      owner: SnapshotHistoryOwner.GeneralUpdate,
      ownerId: saved.id,
      snapshotId: emptySnapshot.id,
    });

    await shiftPrioritiesAfterInsertion(this.generalUpdateRepository.manager);
    if (generalUpdate.suites) {
      await this.syncGeneralUpdateDatesForSuites(
        generalUpdate.suites.map((suite) => suite.id),
      );
    }

    return this.findOneGeneralUpdate(saved.id);
  }

  async updateGeneralUpdate(
    id: number,
    dto: UpdateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const { tagIds, suiteIds, schema, expectedSchemaSnapshotId, ...rest } = dto;

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

    // Keep the entity, relation, and guarded schema writes atomic. The row lock
    // is taken before the read and covers metadata-only writes too: `save`
    // below re-reads the row and writes back every column that differs from the
    // entity loaded here, so an unlocked read-modify-write would revert a
    // concurrent schema save. Locking here rather than in `writeSchemaOrThrow`
    // is what makes that read current. (`findOneOrFail` can't take the lock
    // itself — its `relations` become LEFT JOINs, and Postgres rejects FOR
    // UPDATE on the nullable side of an outer join.)
    const affectedSuiteIds =
      await this.generalUpdateRepository.manager.transaction(async (em) => {
        await em.query(
          "SELECT id FROM general_update WHERE id = $1 FOR UPDATE",
          [id],
        );
        const generalUpdate = await this.findOneGeneralUpdate(id, em);

        if (schemaWrite) {
          const written = await this.schemaWrite.writeSchemaOrThrow({
            owner: SnapshotHistoryOwner.GeneralUpdate,
            id,
            ...schemaWrite,
            em,
          });
          generalUpdate.schemaSnapshotId = written.snapshotId;
          // The loaded relation still holds the previous snapshot, and TypeORM
          // lets a relation object win over the FK column — leaving it set would
          // make the `save` below write the old id straight back over the one
          // just written.
          generalUpdate.schemaSnapshot = undefined;
        }

        Object.assign(generalUpdate, rest);

        if (tagIds !== undefined) {
          generalUpdate.tags =
            tagIds.length > 0 ? await em.findBy(Tag, { id: In(tagIds) }) : [];
        }

        if (suiteIds !== undefined) {
          generalUpdate.suites =
            suiteIds.length > 0
              ? await em.findBy(ActionSuite, { id: In(suiteIds) })
              : [];
        }

        await lockLiveTagsAndSuites(em, generalUpdate);
        await em.save(generalUpdate);

        return generalUpdate.suites?.map((suite) => suite.id) ?? [];
      });

    // Deliberately after the commit: this rewrites every general update in the
    // suite, and holding those rows alongside the one the transaction already
    // locked lets two admins editing the same suite take the same locks in
    // opposite orders and deadlock. The dates are derived from the suite's
    // events, so they don't need to land atomically with the save.
    await this.syncGeneralUpdateDatesForSuites(affectedSuiteIds);

    return this.findOneGeneralUpdate(id);
  }

  async deleteGeneralUpdate(id: number): Promise<void> {
    await softDeleteWhere(this.generalUpdateRepository.manager, {
      target: GeneralUpdate,
      where: { id },
    });
  }

  async syncGeneralUpdateDatesForSuites(
    suiteIds: (number | null | undefined)[],
  ): Promise<void> {
    suiteIds = suiteIds.filter(
      (id): id is number => id != null && id != undefined,
    );
    if (suiteIds.length === 0) {
      return;
    }

    const generalUpdates = await this.generalUpdateRepository.find({
      where: {
        suites: {
          id: In(suiteIds),
        },
      },
      relations: {
        suites: {
          actions: { events: true },
        },
      },
    });

    const isDateChanged = (current: Date | null, next?: Date): boolean =>
      next !== undefined && current?.getTime() !== next.getTime();

    const dateUpdates = generalUpdates.flatMap((generalUpdate) => {
      const suite = generalUpdate.suites![0];
      const action = suite && loadedActionSuiteActions(suite)[0];
      if (!action) {
        return [];
      }
      const startDate = action.memberActionPhase.event?.date;
      const endDate = action.memberActionPhase.deadlineEvent?.date;
      if (
        !isDateChanged(generalUpdate.startDate, startDate) &&
        !isDateChanged(generalUpdate.endDate, endDate)
      ) {
        return [];
      }
      return [{ id: generalUpdate.id, startDate, endDate }];
    });

    // Writes only the two date columns rather than saving the whole entity: a
    // concurrent editor may have replaced `schemaSnapshotId` since the read
    // above, and `save` diffs against the entity loaded here, so it would write
    // the stale id back over theirs.
    await Promise.all(
      dateUpdates.map(({ id, ...dates }) =>
        this.generalUpdateRepository.update(id, dates),
      ),
    );
  }

  async findUnreadGeneralUpdates(params: {
    userId: number;
    now: Date;
    allowExpired: boolean;
  }): Promise<GeneralUpdate[]> {
    const { userId, now, allowExpired } = params;

    const updates = await this.generalUpdateRepository.find({
      where: {
        startDate: LessThan(now),
        ...(!allowExpired && { endDate: Or(IsNull(), MoreThan(now)) }),
      },
      relations: {
        schemaSnapshot: true,
        activities: true,
        tags: true,
      },
    });
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
    });

    return updates
      .filter((update) => {
        if (
          update.activities!.some(
            (activity) =>
              activity.type === GeneralUpdateActivityType.DISMISSED &&
              activity.userId === userId,
          )
        ) {
          return false;
        }
        return computeIsTaggedOrInManualCohort({
          user,
          useManualCohort: update.useManualCohort,
          manualCohortUserIdSet: new Set(update.manualCohortUserIds),
          participatingTagIdSet: new Set(
            loadedGeneralUpdateTags(update).map((tag) => tag.id),
          ),
          onboarding: false,
          memberActionEventDate: update.startDate,
          memberActionEventDeadline: update.endDate,
          includeSuspended: false,
        });
      })
      .sort(startDatePriorityComparator);
  }

  async dismissGeneralUpdate(
    userId: number,
    generalUpdateId: number,
  ): Promise<void> {
    const generalUpdates = await this.findUnreadGeneralUpdates({
      userId,
      now: new Date(),
      allowExpired: true,
    });
    const generalUpdate = generalUpdates.find(
      (update) => update.id === generalUpdateId,
    );
    if (!generalUpdate) {
      throw new NotFoundException(
        "General update not found or already dismissed",
      );
    }

    await writeUnderLive(this.generalUpdateActivityRepository.manager, {
      parents: [
        { target: User, id: userId },
        { target: GeneralUpdate, id: generalUpdateId },
      ],
      write: (em) =>
        em.save(
          em.create(GeneralUpdateActivity, {
            generalUpdate: { id: generalUpdateId },
            user: { id: userId },
            type: GeneralUpdateActivityType.DISMISSED,
            createdAt: new Date(),
          }),
        ),
    });
  }
}
