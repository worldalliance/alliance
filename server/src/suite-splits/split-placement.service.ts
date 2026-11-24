import { ExceptionEvent } from "@alliance/common/analytics";
import { reads } from "@alliance/common/expression/dependencies";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { chunk } from "es-toolkit";
import { catalogWith } from "src/formulas/formula-catalog";
import { PosthogService } from "src/posthog/posthog.service";
import { Any, DataSource, In, type EntityManager } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { SuiteSplitPin } from "./entities/suite-split-pin.entity";
import { SuiteSplitPlacement } from "./entities/suite-split-placement.entity";
import { SuiteSplitVersion } from "./entities/suite-split-version.entity";
import { SuiteSplit } from "./entities/suite-split.entity";
import { checkStoredGroups, type SplitProblem } from "./split-check";
import type { SplitGroup } from "./split-groups";
import { ResolutionKind, resolveGroup } from "./split-resolve";
import {
  listMembers,
  parseSplitVersion,
  pinnedScope,
  splitVersionAt,
  suiteGoLive,
  versionsAt,
} from "./split-store";

/** Rows per insert, well under Postgres's 65,535 parameters a statement. */
const INSERT_CHUNK_SIZE = 1000;

@Injectable()
export class SplitPlacementService {
  private readonly logger = new Logger(SplitPlacementService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly posthog: PosthogService,
  ) {}

  async splitSuiteId(actionId: number): Promise<number | undefined> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('action."suiteId"', "suiteId")
      .from("action", "action")
      .innerJoin(SuiteSplit, "split", 'split."suiteId" = action."suiteId"')
      .where("action.id = :actionId", { actionId })
      .getRawOne<{ suiteId: number }>();
    return row?.suiteId;
  }

  /**
   * Each member's group in the suite, placing those not placed yet. The
   * first call pins the split as it stood when the suite went live, after
   * validating it; when that fails nothing is pinned, the suite shows "Launch
   * failed", and this returns `undefined`, as it does on every later call. A
   * member whose evaluation errors is left out, unplaced.
   */
  async place(params: {
    suiteId: number;
    userIds: number[];
  }): Promise<Map<number, SplitGroup> | undefined> {
    const { suiteId, userIds } = params;
    const pin = await this.pin(suiteId);
    if (pin === undefined) return undefined;
    if (userIds.length === 0) return new Map();
    const manager = this.dataSource.manager;
    const placed = await manager.find(SuiteSplitPlacement, {
      select: { userId: true },
      where: { suiteId, userId: Any(userIds) },
    });
    const placedIds = new Set(placed.map(({ userId }) => userId));
    const unplaced = userIds.filter((userId) => !placedIds.has(userId));
    if (unplaced.length > 0) {
      await this.placeNew({ manager, pin, userIds: unplaced });
    }
    return this.placements(manager, suiteId, userIds);
  }

  private async pin(suiteId: number): Promise<SuiteSplitPin | undefined> {
    const settled = await this.settledPin(this.dataSource.manager, suiteId);
    if (settled !== "unsettled") return settled;
    const failure = await this.dataSource.transaction(async (manager) => {
      await manager.findOneOrFail(SuiteSplit, {
        where: { suiteId },
        lock: { mode: "pessimistic_write" },
      });
      if ((await this.settledPin(manager, suiteId)) !== "unsettled") {
        return undefined;
      }
      const goLive = await suiteGoLive(manager, suiteId);
      const version = await splitVersionAt(manager, { suiteId, at: goLive });
      if (version === undefined)
        throw new Error(`split ${suiteId} has no version by ${goLive}`);
      const at = await versionsAt(manager, goLive);
      const scope = { catalog: catalogWith(at.lists), named: at.named };
      const problems = checkStoredGroups({ groups: version.groups, scope });
      if (problems.length > 0) {
        const reason = describe(problems, version.groups);
        await manager.update(SuiteSplit, suiteId, {
          launchFailedAt: new Date(),
          launchFailure: reason,
        });
        return reason;
      }
      const read = version.groups.map((group) =>
        group.condition === null
          ? { named: new Set<string>(), lists: new Set<string>() }
          : reads(group.condition, at.named),
      );
      const formulaIds = new Set(read.flatMap((each) => [...each.named]));
      const listIds = new Set(read.flatMap((each) => [...each.lists]));
      await manager.insert(SuiteSplitPin, {
        suiteId,
        splitVersionId: version.id,
        formulaVersionIds: at.named
          .filter((each) => formulaIds.has(each.id))
          .map((each) => each.versionId),
        listVersionIds: at.lists
          .filter((each) => listIds.has(each.id))
          .map((each) => each.versionId),
        pinnedAt: goLive,
      });
      return undefined;
    });
    if (failure !== undefined) {
      // Validation runs at save too, so only a bug reaches this.
      this.posthog.captureException({
        event: ExceptionEvent.SplitLaunchFailed,
        error: new Error(`Suite ${suiteId} didn't go live: ${failure}`),
        properties: { suiteId },
      });
      return undefined;
    }
    const pinned = await this.settledPin(this.dataSource.manager, suiteId);
    if (pinned === "unsettled") throw new Error(`split ${suiteId} not pinned`);
    return pinned;
  }

  /** The suite's pin, `undefined` once its launch failed, or "unsettled". */
  private async settledPin(
    manager: EntityManager,
    suiteId: number,
  ): Promise<SuiteSplitPin | undefined | "unsettled"> {
    const split = await manager.findOneByOrFail(SuiteSplit, { suiteId });
    if (split.launchFailedAt !== null) return undefined;
    const pin = await manager.findOne(SuiteSplitPin, {
      where: { suiteId },
      order: { id: "DESC" },
    });
    return pin ?? "unsettled";
  }

  private async placeNew(params: {
    manager: EntityManager;
    pin: SuiteSplitPin;
    userIds: number[];
  }): Promise<void> {
    const { manager, pin, userIds } = params;
    const [version, pinned] = await Promise.all([
      manager.findOneByOrFail(SuiteSplitVersion, { id: pin.splitVersionId }),
      pinnedScope(manager, pin),
    ]);
    const { groups } = parseSplitVersion(version);
    const members = await listMembers(manager, {
      listVersionIds: pinned.listVersionIds,
      userIds,
    });
    const rows: QueryDeepPartialEntity<SuiteSplitPlacement>[] = [];
    const errors: string[] = [];
    for (const userId of userIds) {
      const resolution = resolveGroup({
        groups,
        scope: pinned.scope,
        isOnList: (listId) => members.get(listId)?.has(userId) ?? false,
      });
      switch (resolution.kind) {
        case ResolutionKind.Placed:
          rows.push({
            suiteId: pin.suiteId,
            userId,
            groupId: resolution.groupId,
            pinId: pin.id,
            trace: resolution.trace,
          });
          break;
        case ResolutionKind.CouldNotDecide:
          errors.push(resolution.message);
          break;
        default:
          throw new Error(`unknown resolution: ${resolution satisfies never}`);
      }
    }
    if (errors.length > 0) {
      // Messages come from evaluating the split's own formulas, not member data.
      this.logger.error(
        `couldn't decide the group of ${errors.length} member(s) of suite ${pin.suiteId}: ${[...new Set(errors)].join(" ")}`,
      );
    }
    // A concurrent placement wins; a member's group is fixed once.
    for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(SuiteSplitPlacement)
        .values(batch)
        .orIgnore()
        .execute();
    }
  }

  private async placements(
    manager: EntityManager,
    suiteId: number,
    userIds: number[],
  ): Promise<Map<number, SplitGroup>> {
    const placements = await manager.find(SuiteSplitPlacement, {
      where: { suiteId, userId: Any(userIds) },
    });
    const pinIds = [...new Set(placements.map(({ pinId }) => pinId))];
    const pins =
      pinIds.length === 0
        ? []
        : await manager.find(SuiteSplitPin, {
            where: { id: In(pinIds) },
            relations: { splitVersion: true },
          });
    const groupsOf = new Map(
      pins.map((pin) => {
        if (pin.splitVersion === undefined)
          throw new Error("pin relations not loaded");
        return [pin.id, parseSplitVersion(pin.splitVersion).groups];
      }),
    );
    return new Map(
      placements.map((placement) => {
        const group = groupsOf
          .get(placement.pinId)
          ?.find((each) => each.id === placement.groupId);
        if (group === undefined) {
          throw new Error(`placement ${placement.id} names no group`);
        }
        return [placement.userId, group];
      }),
    );
  }
}

function describe(
  problems: readonly SplitProblem[],
  groups: readonly SplitGroup[],
): string {
  return problems
    .map((problem) => {
      const name =
        groups.find((group) => group.id === problem.groupId)?.name ??
        "The split";
      const message =
        "message" in problem
          ? problem.message
          : problem.diagnostics.map((each) => each.message).join(" ");
      return `"${name}": ${message}`;
    })
    .join(" ");
}
