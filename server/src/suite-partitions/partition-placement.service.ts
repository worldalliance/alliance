import { ExceptionEvent } from "@alliance/common/analytics";
import { reads } from "@alliance/common/expression/dependencies";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { chunk } from "es-toolkit";
import { catalogWith } from "src/formulas/formula-catalog";
import { PosthogService } from "src/posthog/posthog.service";
import { Any, DataSource, In, type EntityManager } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { SuitePartitionPin } from "./entities/suite-partition-pin.entity";
import { SuitePartitionPlacement } from "./entities/suite-partition-placement.entity";
import { SuitePartitionVersion } from "./entities/suite-partition-version.entity";
import { SuitePartition } from "./entities/suite-partition.entity";
import { checkStoredParts, type PartitionProblem } from "./partition-check";
import type { PartitionPart } from "./partition-parts";
import { ResolutionKind, resolvePart } from "./partition-resolve";
import {
  listMembers,
  parsePartitionVersion,
  partitionVersionAt,
  pinnedScope,
  suiteGoLive,
  versionsAt,
} from "./partition-store";

/** Rows per insert, well under Postgres's 65,535 parameters a statement. */
const INSERT_CHUNK_SIZE = 1000;

@Injectable()
export class PartitionPlacementService {
  private readonly logger = new Logger(PartitionPlacementService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly posthog: PosthogService,
  ) {}

  async partitionSuiteId(actionId: number): Promise<number | undefined> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('action."suiteId"', "suiteId")
      .from("action", "action")
      .innerJoin(
        SuitePartition,
        "partition",
        'partition."suiteId" = action."suiteId"',
      )
      .where("action.id = :actionId", { actionId })
      .getRawOne<{ suiteId: number }>();
    return row?.suiteId;
  }

  /**
   * Each member's part in the suite, placing those not placed yet. The
   * first call pins the partition as it stood when the suite went live, after
   * validating it; when that fails nothing is pinned, the suite shows "Launch
   * failed", and this returns `undefined`, as it does on every later call. A
   * member whose evaluation errors is left out, unplaced.
   */
  async place(params: {
    suiteId: number;
    userIds: number[];
  }): Promise<Map<number, PartitionPart> | undefined> {
    const { suiteId, userIds } = params;
    const pin = await this.pin(suiteId);
    if (pin === undefined) return undefined;
    if (userIds.length === 0) return new Map();
    const manager = this.dataSource.manager;
    const placed = await manager.find(SuitePartitionPlacement, {
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

  private async pin(suiteId: number): Promise<SuitePartitionPin | undefined> {
    const settled = await this.settledPin(this.dataSource.manager, suiteId);
    if (settled !== "unsettled") return settled;
    const failure = await this.dataSource.transaction(async (manager) => {
      await manager.findOneOrFail(SuitePartition, {
        where: { suiteId },
        lock: { mode: "pessimistic_write" },
      });
      if ((await this.settledPin(manager, suiteId)) !== "unsettled") {
        return undefined;
      }
      const goLive = await suiteGoLive(manager, suiteId);
      const version = await partitionVersionAt(manager, {
        suiteId,
        at: goLive,
      });
      if (version === undefined)
        throw new Error(`partition ${suiteId} has no version by ${goLive}`);
      const at = await versionsAt(manager, goLive);
      const scope = { catalog: catalogWith(at.lists), named: at.named };
      const problems = checkStoredParts({ parts: version.parts, scope });
      if (problems.length > 0) {
        const reason = describe(problems, version.parts);
        await manager.update(SuitePartition, suiteId, {
          launchFailedAt: new Date(),
          launchFailure: reason,
        });
        return reason;
      }
      const read = version.parts.map((part) =>
        part.condition === null
          ? { named: new Set<string>(), lists: new Set<string>() }
          : reads(part.condition, at.named),
      );
      const formulaIds = new Set(read.flatMap((each) => [...each.named]));
      const listIds = new Set(read.flatMap((each) => [...each.lists]));
      await manager.insert(SuitePartitionPin, {
        suiteId,
        partitionVersionId: version.id,
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
        event: ExceptionEvent.PartitionLaunchFailed,
        error: new Error(`Suite ${suiteId} didn't go live: ${failure}`),
        properties: { suiteId },
      });
      return undefined;
    }
    const pinned = await this.settledPin(this.dataSource.manager, suiteId);
    if (pinned === "unsettled")
      throw new Error(`partition ${suiteId} not pinned`);
    return pinned;
  }

  /** The suite's pin, `undefined` once its launch failed, or "unsettled". */
  private async settledPin(
    manager: EntityManager,
    suiteId: number,
  ): Promise<SuitePartitionPin | undefined | "unsettled"> {
    const partition = await manager.findOneByOrFail(SuitePartition, {
      suiteId,
    });
    if (partition.launchFailedAt !== null) return undefined;
    const pin = await manager.findOne(SuitePartitionPin, {
      where: { suiteId },
      order: { id: "DESC" },
    });
    return pin ?? "unsettled";
  }

  private async placeNew(params: {
    manager: EntityManager;
    pin: SuitePartitionPin;
    userIds: number[];
  }): Promise<void> {
    const { manager, pin, userIds } = params;
    const [version, pinned] = await Promise.all([
      manager.findOneByOrFail(SuitePartitionVersion, {
        id: pin.partitionVersionId,
      }),
      pinnedScope(manager, pin),
    ]);
    const { parts } = parsePartitionVersion(version);
    const members = await listMembers(manager, {
      listVersionIds: pinned.listVersionIds,
      userIds,
    });
    const rows: QueryDeepPartialEntity<SuitePartitionPlacement>[] = [];
    const errors: string[] = [];
    for (const userId of userIds) {
      const resolution = resolvePart({
        parts,
        scope: pinned.scope,
        isOnList: (listId) => members.get(listId)?.has(userId) ?? false,
      });
      switch (resolution.kind) {
        case ResolutionKind.Placed:
          rows.push({
            suiteId: pin.suiteId,
            userId,
            partId: resolution.partId,
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
      // Messages come from evaluating the partition's own formulas, not member data.
      this.logger.error(
        `couldn't decide the part of ${errors.length} member(s) of suite ${pin.suiteId}: ${[...new Set(errors)].join(" ")}`,
      );
    }
    // A concurrent placement wins; a member's part is fixed once.
    for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(SuitePartitionPlacement)
        .values(batch)
        .orIgnore()
        .execute();
    }
  }

  private async placements(
    manager: EntityManager,
    suiteId: number,
    userIds: number[],
  ): Promise<Map<number, PartitionPart>> {
    const placements = await manager.find(SuitePartitionPlacement, {
      where: { suiteId, userId: Any(userIds) },
    });
    const pinIds = [...new Set(placements.map(({ pinId }) => pinId))];
    const pins =
      pinIds.length === 0
        ? []
        : await manager.find(SuitePartitionPin, {
            where: { id: In(pinIds) },
            relations: { partitionVersion: true },
          });
    const partsOf = new Map(
      pins.map((pin) => {
        if (pin.partitionVersion === undefined)
          throw new Error("pin relations not loaded");
        return [pin.id, parsePartitionVersion(pin.partitionVersion).parts];
      }),
    );
    return new Map(
      placements.map((placement) => {
        const part = partsOf
          .get(placement.pinId)
          ?.find((each) => each.id === placement.partId);
        if (part === undefined) {
          throw new Error(`placement ${placement.id} names no part`);
        }
        return [placement.userId, part];
      }),
    );
  }
}

function describe(
  problems: readonly PartitionProblem[],
  parts: readonly PartitionPart[],
): string {
  return problems
    .map((problem) => {
      const name =
        parts.find((part) => part.id === problem.partId)?.name ??
        "The partition";
      const message =
        "message" in problem
          ? problem.message
          : problem.diagnostics.map((each) => each.message).join(" ");
      return `"${name}": ${message}`;
    })
    .join(" ");
}
