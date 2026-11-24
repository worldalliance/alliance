import { R } from "@alliance/common/result";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { isEqual } from "es-toolkit";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "src/actions/entities/action.entity";
import { lockUntilCommit } from "src/datasources/advisory-lock";
import { formulaCatalog } from "src/formulas/formula-catalog";
import {
  asNamed,
  currentFormulas,
  FORMULAS_LOCK,
} from "src/formulas/formula-store";
import { currentLists } from "src/member-lists/member-list-store";
import { UserService } from "src/user/user.service";
import { DataSource, In, type EntityManager } from "typeorm";
import { SuitePartitionPin } from "./entities/suite-partition-pin.entity";
import { SuitePartitionVersion } from "./entities/suite-partition-version.entity";
import { SuitePartition } from "./entities/suite-partition.entity";
import {
  checkPartition,
  printPart,
  type PartDraft,
  type PartitionProblem,
  type PartitionWarning,
} from "./partition-check";
import {
  EVERYONE_ELSE,
  impliedOptional,
  workOf,
  type PartitionPart,
} from "./partition-parts";
import { previewPartition, type PartitionPreview } from "./partition-preview";
import { currentPartitionVersion, listMembers } from "./partition-store";

import { NOT_PARTITION, PARTITION_CHANGED } from "./partition-messages";

export type PartitionView = {
  versionId: number;
  parts: (PartitionPart & { text: string | null })[];
  actions: ParsedAction[];
  launched: boolean;
  launchFailedAt: Date | null;
  launchFailure: string | null;
};

export type PartitionSaveResult = {
  problems: PartitionProblem[];
  warnings: PartitionWarning[];
  partition: PartitionView | null;
};

export type PartitionPreviewResult =
  | { problems: PartitionProblem[] }
  | { problems: []; preview: PartitionPreview };

@Injectable()
export class SuitePartitionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  /**
   * Makes a suite that hasn't been scheduled use parts, starting with only
   * "Everyone else", which is assigned nothing. Refused while one of its
   * actions has its own cohort rule or prerequisites, which a partition replaces.
   */
  async convert(params: { suiteId: number; userId: number }): Promise<void> {
    const { suiteId, userId } = params;
    await this.dataSource.transaction(async (manager) => {
      const actions = await suiteActions(manager, suiteId, { lock: true });
      if (await manager.exists(SuitePartition, { where: { suiteId } })) {
        throw new ConflictException("This suite is already partitioned.");
      }
      assertNotLaunched(actions);
      const ruled = actions.filter(
        (action) =>
          action.cohortExpression !== null ||
          action.prerequisiteActionIds.length > 0,
      );
      if (ruled.length > 0) {
        throw new BadRequestException(
          `A partition replaces each action's own participants and prerequisites. Clear them first on: ${ruled.map((action) => action.name).join(", ")}.`,
        );
      }
      await manager.insert(SuitePartition, { suiteId, createdById: userId });
      const everyoneElse: PartitionPart = {
        id: crypto.randomUUID(),
        name: EVERYONE_ELSE,
        condition: null,
        fallback: null,
        noRequiredWorkTick: null,
        cells: [],
      };
      await manager.insert(SuitePartitionVersion, {
        suiteId,
        parts: [everyoneElse],
        savedById: userId,
      });
      await writeImpliedOptional(manager, {
        suiteId,
        actions,
        parts: [everyoneElse],
      });
    });
  }

  async get(suiteId: number): Promise<PartitionView> {
    const manager = this.dataSource.manager;
    const [actions, partition, version] = await Promise.all([
      suiteActions(manager, suiteId),
      manager.findOne(SuitePartition, { where: { suiteId } }),
      currentPartitionVersion(manager, suiteId),
    ]);
    if (partition === null || version === undefined) {
      throw new NotFoundException(NOT_PARTITION);
    }
    const scope = {
      catalog: await formulaCatalog(manager),
      named: (await currentFormulas(manager)).map(asNamed),
    };
    // Cells of an action that left the suite are dropped, so the next save
    // drops them too, and a tick lapses once that changes the part's work.
    const actionIds = actions.map((action) => action.id);
    return {
      versionId: version.id,
      parts: version.parts.map((part) => ({
        ...part,
        cells: part.cells.filter((cell) => actionIds.includes(cell.actionId)),
        noRequiredWorkTick:
          part.noRequiredWorkTick === workOf(part, actionIds)
            ? part.noRequiredWorkTick
            : null,
        text: part.condition === null ? null : printPart(part.condition, scope),
      })),
      actions,
      launched: await manager.exists(SuitePartitionPin, { where: { suiteId } }),
      launchFailedAt: partition.launchFailedAt,
      launchFailure: partition.launchFailure,
    };
  }

  /**
   * Saves the parts and grid and returns the partition as stored, or returns why
   * the check refused them and writes nothing. Also sets each action's own
   * optional flag from the grid.
   * Throws `ConflictException` when the partition changed since `baseVersionId`.
   */
  async save(params: {
    suiteId: number;
    baseVersionId: number;
    drafts: PartDraft[];
    savedById: number;
  }): Promise<PartitionSaveResult> {
    const { suiteId, baseVersionId, drafts, savedById } = params;
    const saved = await this.dataSource.transaction(async (manager) => {
      // Formula saves check partitions, and this check reads formulas.
      await lockUntilCommit(manager, FORMULAS_LOCK);
      const actions = await suiteActions(manager, suiteId, { lock: true });
      const current = await currentPartitionVersion(manager, suiteId);
      if (current === undefined) throw new NotFoundException(NOT_PARTITION);
      if (current.id !== baseVersionId)
        throw new ConflictException(PARTITION_CHANGED);
      assertNotLaunched(actions);
      const actionIds = actions.map((action) => action.id);
      assertCellsInSuite(drafts, actionIds);
      const scope = {
        catalog: await formulaCatalog(manager),
        named: (await currentFormulas(manager)).map(asNamed),
      };
      const checked = checkPartition({ drafts, scope, actionIds });
      if (!checked.ok) return checked;
      const { parts } = checked.value;
      if (!isEqual(parts, current.parts)) {
        await manager.insert(SuitePartitionVersion, {
          suiteId,
          parts,
          savedById,
        });
      }
      await writeImpliedOptional(manager, { suiteId, actions, parts });
      return R.success({ ...checked.value, scope, actionIds });
    });
    if (!saved.ok)
      return { problems: saved.error, warnings: [], partition: null };
    // Counted after the commit, so the lock isn't held over the roster load.
    const { parts, warnings, scope, actionIds } = saved.value;
    const preview = previewPartition({
      parts,
      scope,
      actionIds,
      ...(await this.population(this.dataSource.manager)),
    });
    return {
      problems: [],
      warnings: [...warnings, ...emptyToday(parts, preview)],
      partition: await this.get(suiteId),
    };
  }

  /** Counts where members would land today, for parts not yet saved too. */
  async preview(params: {
    suiteId: number;
    drafts: PartDraft[];
  }): Promise<PartitionPreviewResult> {
    const { suiteId, drafts } = params;
    const manager = this.dataSource.manager;
    const actions = await suiteActions(manager, suiteId);
    if (!(await manager.exists(SuitePartition, { where: { suiteId } }))) {
      throw new NotFoundException(NOT_PARTITION);
    }
    const actionIds = actions.map((action) => action.id);
    assertCellsInSuite(drafts, actionIds);
    const scope = {
      catalog: await formulaCatalog(manager),
      named: (await currentFormulas(manager)).map(asNamed),
    };
    const checked = checkPartition({ drafts, scope, actionIds });
    if (!checked.ok) return { problems: checked.error };
    return {
      problems: [],
      preview: previewPartition({
        parts: checked.value.parts,
        scope,
        actionIds,
        ...(await this.population(manager)),
      }),
    };
  }

  /** Members holding a contract now, with the current membership of every list. */
  private async population(manager: EntityManager): Promise<{
    userIds: number[];
    members: Map<string, Set<number>>;
  }> {
    const now = new Date();
    const [users, lists] = await Promise.all([
      this.userService.findActiveUsersForRoster(),
      currentLists(manager),
    ]);
    return {
      userIds: users
        .filter((user) => user.hasActiveContractAt(now))
        .map((user) => user.id),
      members: await listMembers(manager, {
        listVersionIds: new Map(
          lists.map(({ id, versionId }) => [id, versionId]),
        ),
      }),
    };
  }
}

async function suiteActions(
  manager: EntityManager,
  suiteId: number,
  options: { lock?: boolean } = {},
): Promise<ParsedAction[]> {
  const suite = await manager.findOne(ActionSuite, {
    where: { id: suiteId },
    ...(options.lock ? { lock: { mode: "pessimistic_write" } } : {}),
  });
  if (suite === null) throw new NotFoundException("Suite not found");
  const actions = await manager.find(Action, {
    where: { suite: { id: suiteId } },
    relations: { events: true },
    order: { priority: "DESC", id: "ASC" },
  });
  return actions.map(parseAction);
}

function assertNotLaunched(actions: readonly ParsedAction[]): void {
  if (actions.some((action) => action.memberActionPhase.event !== null)) {
    throw new ConflictException(
      "This suite is scheduled to launch, so its partition can't change here.",
    );
  }
}

function assertCellsInSuite(
  drafts: readonly PartDraft[],
  actionIds: readonly number[],
): void {
  for (const draft of drafts) {
    const ids = draft.cells.map((cell) => cell.actionId);
    if (new Set(ids).size < ids.length) {
      throw new BadRequestException("An action appears twice in a part.");
    }
    if (ids.some((id) => !actionIds.includes(id))) {
      throw new ConflictException(
        "An action moved out of this suite since you opened it. Reload to see its actions.",
      );
    }
  }
}

async function writeImpliedOptional(
  manager: EntityManager,
  params: {
    suiteId: number;
    actions: readonly ParsedAction[];
    parts: readonly PartitionPart[];
  },
): Promise<void> {
  const { suiteId, actions, parts } = params;
  for (const optional of [true, false]) {
    const ids = actions
      .filter(
        (action) =>
          impliedOptional(parts, action.id) === optional &&
          action.optional !== optional,
      )
      .map((action) => action.id);
    if (ids.length === 0) continue;
    // Postgres rechecks the suite after waiting on a row lock, so an action
    // moved out of the suite meanwhile keeps the flag its mover set.
    await manager
      .createQueryBuilder()
      .update(Action)
      .set({ optional })
      .where({ id: In(ids) })
      .andWhere('"suiteId" = :suiteId', { suiteId })
      .execute();
  }
}

function emptyToday(
  parts: readonly PartitionPart[],
  preview: PartitionPreview,
): PartitionWarning[] {
  return parts.flatMap((part) =>
    preview.parts.find((each) => each.partId === part.id)?.count === 0
      ? [
          {
            partId: part.id,
            message: `No member is in "${part.name}" today.`,
          },
        ]
      : [],
  );
}
