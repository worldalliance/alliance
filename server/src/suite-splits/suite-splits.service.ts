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
import { SuiteSplitPin } from "./entities/suite-split-pin.entity";
import { SuiteSplitVersion } from "./entities/suite-split-version.entity";
import { SuiteSplit } from "./entities/suite-split.entity";
import {
  checkSplit,
  printGroup,
  type GroupDraft,
  type SplitProblem,
  type SplitWarning,
} from "./split-check";
import {
  EVERYONE_ELSE,
  impliedOptional,
  workOf,
  type SplitGroup,
} from "./split-groups";
import { previewSplit, type SplitPreview } from "./split-preview";
import { currentSplitVersion, listMembers } from "./split-store";

import { NOT_SPLIT, SPLIT_CHANGED } from "./split-messages";

export type SplitView = {
  versionId: number;
  groups: (SplitGroup & { text: string | null })[];
  actions: ParsedAction[];
  launched: boolean;
  launchFailedAt: Date | null;
  launchFailure: string | null;
};

export type SplitSaveResult = {
  problems: SplitProblem[];
  warnings: SplitWarning[];
  split: SplitView | null;
};

export type SplitPreviewResult =
  | { problems: SplitProblem[] }
  | { problems: []; preview: SplitPreview };

@Injectable()
export class SuiteSplitsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  /**
   * Makes a suite that hasn't been scheduled use groups, starting with only
   * "Everyone else", which is assigned nothing. Refused while one of its
   * actions has its own cohort rule or prerequisites, which a split replaces.
   */
  async convert(params: { suiteId: number; userId: number }): Promise<void> {
    const { suiteId, userId } = params;
    await this.dataSource.transaction(async (manager) => {
      const actions = await suiteActions(manager, suiteId, { lock: true });
      if (await manager.exists(SuiteSplit, { where: { suiteId } })) {
        throw new ConflictException("This suite already uses groups.");
      }
      assertNotLaunched(actions);
      const ruled = actions.filter(
        (action) =>
          action.cohortExpression !== null ||
          action.prerequisiteActionIds.length > 0,
      );
      if (ruled.length > 0) {
        throw new BadRequestException(
          `Groups replace each action's own participants and prerequisites. Clear them first on: ${ruled.map((action) => action.name).join(", ")}.`,
        );
      }
      await manager.insert(SuiteSplit, { suiteId, createdById: userId });
      const everyoneElse: SplitGroup = {
        id: crypto.randomUUID(),
        name: EVERYONE_ELSE,
        condition: null,
        fallback: null,
        noRequiredWorkTick: null,
        cells: [],
      };
      await manager.insert(SuiteSplitVersion, {
        suiteId,
        groups: [everyoneElse],
        savedById: userId,
      });
      await writeImpliedOptional(manager, {
        suiteId,
        actions,
        groups: [everyoneElse],
      });
    });
  }

  async get(suiteId: number): Promise<SplitView> {
    const manager = this.dataSource.manager;
    const [actions, split, version] = await Promise.all([
      suiteActions(manager, suiteId),
      manager.findOne(SuiteSplit, { where: { suiteId } }),
      currentSplitVersion(manager, suiteId),
    ]);
    if (split === null || version === undefined) {
      throw new NotFoundException(NOT_SPLIT);
    }
    const scope = {
      catalog: await formulaCatalog(manager),
      named: (await currentFormulas(manager)).map(asNamed),
    };
    // Cells of an action that left the suite are dropped, so the next save
    // drops them too, and a tick lapses once that changes the group's work.
    const actionIds = actions.map((action) => action.id);
    return {
      versionId: version.id,
      groups: version.groups.map((group) => ({
        ...group,
        cells: group.cells.filter((cell) => actionIds.includes(cell.actionId)),
        noRequiredWorkTick:
          group.noRequiredWorkTick === workOf(group, actionIds)
            ? group.noRequiredWorkTick
            : null,
        text:
          group.condition === null ? null : printGroup(group.condition, scope),
      })),
      actions,
      launched: await manager.exists(SuiteSplitPin, { where: { suiteId } }),
      launchFailedAt: split.launchFailedAt,
      launchFailure: split.launchFailure,
    };
  }

  /**
   * Saves the groups and grid and returns the split as stored, or returns why
   * the check refused them and writes nothing. Also sets each action's own
   * optional flag from the grid.
   * Throws `ConflictException` when the split changed since `baseVersionId`.
   */
  async save(params: {
    suiteId: number;
    baseVersionId: number;
    drafts: GroupDraft[];
    savedById: number;
  }): Promise<SplitSaveResult> {
    const { suiteId, baseVersionId, drafts, savedById } = params;
    const saved = await this.dataSource.transaction(async (manager) => {
      // Formula saves check splits, and this check reads formulas.
      await lockUntilCommit(manager, FORMULAS_LOCK);
      const actions = await suiteActions(manager, suiteId, { lock: true });
      const current = await currentSplitVersion(manager, suiteId);
      if (current === undefined) throw new NotFoundException(NOT_SPLIT);
      if (current.id !== baseVersionId)
        throw new ConflictException(SPLIT_CHANGED);
      assertNotLaunched(actions);
      const actionIds = actions.map((action) => action.id);
      assertCellsInSuite(drafts, actionIds);
      const scope = {
        catalog: await formulaCatalog(manager),
        named: (await currentFormulas(manager)).map(asNamed),
      };
      const checked = checkSplit({ drafts, scope, actionIds });
      if (!checked.ok) return checked;
      const { groups } = checked.value;
      if (!isEqual(groups, current.groups)) {
        await manager.insert(SuiteSplitVersion, {
          suiteId,
          groups,
          savedById,
        });
      }
      await writeImpliedOptional(manager, { suiteId, actions, groups });
      return R.success({ ...checked.value, scope, actionIds });
    });
    if (!saved.ok) return { problems: saved.error, warnings: [], split: null };
    // Counted after the commit, so the lock isn't held over the roster load.
    const { groups, warnings, scope, actionIds } = saved.value;
    const preview = previewSplit({
      groups,
      scope,
      actionIds,
      ...(await this.population(this.dataSource.manager)),
    });
    return {
      problems: [],
      warnings: [...warnings, ...emptyToday(groups, preview)],
      split: await this.get(suiteId),
    };
  }

  /** Counts where members would land today, for groups not yet saved too. */
  async preview(params: {
    suiteId: number;
    drafts: GroupDraft[];
  }): Promise<SplitPreviewResult> {
    const { suiteId, drafts } = params;
    const manager = this.dataSource.manager;
    const actions = await suiteActions(manager, suiteId);
    if (!(await manager.exists(SuiteSplit, { where: { suiteId } }))) {
      throw new NotFoundException(NOT_SPLIT);
    }
    const actionIds = actions.map((action) => action.id);
    assertCellsInSuite(drafts, actionIds);
    const scope = {
      catalog: await formulaCatalog(manager),
      named: (await currentFormulas(manager)).map(asNamed),
    };
    const checked = checkSplit({ drafts, scope, actionIds });
    if (!checked.ok) return { problems: checked.error };
    return {
      problems: [],
      preview: previewSplit({
        groups: checked.value.groups,
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
      "This suite is scheduled to launch, so its groups can't change here.",
    );
  }
}

function assertCellsInSuite(
  drafts: readonly GroupDraft[],
  actionIds: readonly number[],
): void {
  for (const draft of drafts) {
    const ids = draft.cells.map((cell) => cell.actionId);
    if (new Set(ids).size < ids.length) {
      throw new BadRequestException("An action appears twice in a group.");
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
    groups: readonly SplitGroup[];
  },
): Promise<void> {
  const { suiteId, actions, groups } = params;
  for (const optional of [true, false]) {
    const ids = actions
      .filter(
        (action) =>
          impliedOptional(groups, action.id) === optional &&
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
  groups: readonly SplitGroup[],
  preview: SplitPreview,
): SplitWarning[] {
  return groups.flatMap((group) =>
    preview.groups.find((each) => each.groupId === group.id)?.count === 0
      ? [
          {
            groupId: group.id,
            message: `No member is in "${group.name}" today.`,
          },
        ]
      : [],
  );
}
