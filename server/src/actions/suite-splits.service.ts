import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isEqual, sumBy } from "es-toolkit";
import { assertLive, softDeleteCascade } from "src/datasources/soft-delete";
import { In, Not, type EntityManager, type Repository } from "typeorm";
import { parseCohortExpressionForSaveOrThrow } from "./cohort-reference-validation";
import type { SaveSuiteSplitDto } from "./dto/suite-split.dto";
import { ActionSuiteSplitArm } from "./entities/action-suite-split-arm.entity";
import {
  ActionSuiteSplit,
  parseSplit,
  SplitVisibilityMode,
  type ParsedSplit,
} from "./entities/action-suite-split.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import { Action } from "./entities/action.entity";
import {
  armEditRejection,
  armIneligibility,
  armRoutingExpressions,
  armScheduleMismatch,
  hasSplitLaunched,
  type CombinedCounts,
} from "./suite-split";

export type SplitWithLaunch = { split: ParsedSplit; launched: boolean };

@Injectable()
export class SuiteSplitsService {
  constructor(
    @InjectRepository(ActionSuiteSplit)
    private readonly splitRepository: Repository<ActionSuiteSplit>,
    @InjectRepository(ActionSuiteSplitArm)
    private readonly armRepository: Repository<ActionSuiteSplitArm>,
  ) {}

  async findForSuite(suiteId: number, now: Date): Promise<SplitWithLaunch[]> {
    const splits = await this.splitRepository.find({
      where: { suiteId },
      relations: { arms: { action: { events: true } } },
      order: { id: "ASC" },
    });
    return splits.map((split) => withLaunch(parseSplit(split), now));
  }

  async findAll(): Promise<ParsedSplit[]> {
    const splits = await this.splitRepository.find({
      relations: { arms: true },
    });
    return splits.map(parseSplit);
  }

  async findForAction(actionId: number): Promise<ParsedSplit | null> {
    const arm = await this.armRepository.findOne({ where: { actionId } });
    if (!arm) return null;
    const split = await this.splitRepository.findOneOrFail({
      where: { id: arm.splitId },
      relations: { arms: true },
    });
    return parseSplit(split);
  }

  async findCombinedSplitsByArm(
    actionIds: number[],
  ): Promise<Map<number, ParsedSplit>> {
    if (actionIds.length === 0) return new Map();
    const arms = await this.armRepository.find({
      where: { actionId: In(actionIds) },
      select: { actionId: true, splitId: true },
    });
    const splits = await this.splitRepository.find({
      where: {
        id: In(arms.map((arm) => arm.splitId)),
        visibilityMode: SplitVisibilityMode.Combined,
      },
      relations: { arms: true },
    });
    const byId = new Map(splits.map((split) => [split.id, parseSplit(split)]));
    return new Map(
      arms.flatMap((arm) => {
        const split = byId.get(arm.splitId);
        return split ? [[arm.actionId, split] as const] : [];
      }),
    );
  }

  /** Each combined split's counts, by the id of each of its arms among `actionIds`. */
  async findCombinedCounts(
    actionIds: number[],
  ): Promise<Map<number, CombinedCounts>> {
    const splits = await this.findCombinedSplitsByArm(actionIds);
    if (splits.size === 0) return new Map();
    const counts = await this.splitRepository.manager.find(Action, {
      where: {
        id: In(
          [...splits.values()].flatMap((split) =>
            split.arms.map((arm) => arm.actionId),
          ),
        ),
      },
      select: { id: true, usersJoined: true, usersCompleted: true },
    });
    const byId = new Map(counts.map((action) => [action.id, action]));
    return new Map(
      [...splits].map(([actionId, split]) => {
        const arms = split.arms.flatMap((arm) => {
          const action = byId.get(arm.actionId);
          return action ? [action] : [];
        });
        return [
          actionId,
          {
            usersJoined: sumBy(arms, (action) => action.usersJoined),
            usersCompleted: sumBy(arms, (action) => action.usersCompleted),
          },
        ];
      }),
    );
  }

  async assertArmEditAllowed(
    actionId: number,
    edit: Parameters<typeof armEditRejection>[0],
  ): Promise<void> {
    if (!(await this.armRepository.exists({ where: { actionId } }))) return;
    const rejection = armEditRejection(edit);
    if (rejection) throw new BadRequestException(rejection);
  }

  async assertNotAnArm(actionId: number): Promise<void> {
    if (await this.armRepository.exists({ where: { actionId } })) {
      throw new BadRequestException(
        "This action is an arm of a split. Take it out of the split first.",
      );
    }
  }

  async save(params: {
    suiteId: number;
    splitId?: number;
    body: SaveSuiteSplitDto;
    now: Date;
  }): Promise<void> {
    const { suiteId, splitId, body, now } = params;
    await this.splitRepository.manager.transaction(async (em) => {
      await assertLive(em, {
        rows: [{ target: ActionSuite, id: suiteId }],
        gone: () => new NotFoundException("Suite not found"),
      });
      const existing =
        splitId === undefined
          ? null
          : await this.loadSplitInSuite(em, { suiteId, splitId, now });
      const filterExpression =
        body.filterExpression == null
          ? null
          : await parseCohortExpressionForSaveOrThrow({
              em,
              value: body.filterExpression,
              stored: existing?.split.filterExpression,
            });
      const arms = await Promise.all(
        body.arms.map(async (arm, position) => ({
          actionId: arm.actionId,
          position,
          optional: arm.optional,
          rule:
            arm.rule == null
              ? null
              : await parseCohortExpressionForSaveOrThrow({
                  em,
                  value: arm.rule,
                  stored: existing?.split.arms.find(
                    (stored) => stored.actionId === arm.actionId,
                  )?.rule,
                }),
        })),
      );

      if (existing?.launched) {
        assertOnlyLaunchSafeChanges({
          stored: existing.split,
          filterExpression,
          arms,
        });
        await em.update(ActionSuiteSplit, existing.split.id, {
          title: body.title,
          visibilityMode: body.visibilityMode,
        });
        for (const arm of existing.split.arms) {
          const optional = arms.find(
            (saved) => saved.actionId === arm.actionId,
          )?.optional;
          await em.update(ActionSuiteSplitArm, arm.id, { optional });
        }
        return;
      }

      const actions = await this.loadArmActions(em, {
        suiteId,
        splitId,
        actionIds: arms.map((arm) => arm.actionId),
        now,
      });
      assertArmsShape(arms);

      const { id: saved } = await em.save(ActionSuiteSplit, {
        ...(existing ? { id: existing.split.id } : {}),
        suiteId,
        title: body.title,
        visibilityMode: body.visibilityMode,
        filterExpression,
      });
      if (existing) {
        await this.releaseArms(em, {
          arms: existing.split.arms.filter(
            (arm) => !arms.some((kept) => kept.actionId === arm.actionId),
          ),
        });
        await softDeleteCascade(em, {
          target: ActionSuiteSplitArm,
          ids: existing.split.arms.map((arm) => arm.id),
        });
      }
      await em.save(
        ActionSuiteSplitArm,
        arms.map((arm) => ({ ...arm, splitId: saved })),
      );
      const routing = armRoutingExpressions({ filterExpression, arms });
      for (const action of actions) {
        await em.update(Action, action.id, {
          optional: false,
          cohortExpression: routing.get(action.id),
        });
      }
    });
  }

  async remove(params: {
    suiteId: number;
    splitId: number;
    now: Date;
  }): Promise<void> {
    await this.splitRepository.manager.transaction(async (em) => {
      const { split, launched } = await this.loadSplitInSuite(em, params);
      if (launched) {
        throw new BadRequestException(
          "This split has launched, so it can't be removed.",
        );
      }
      await this.releaseArms(em, { arms: split.arms });
      await softDeleteCascade(em, {
        target: ActionSuiteSplit,
        ids: [split.id],
      });
    });
  }

  /**
   * Run in the transaction that changed schedules, after the change, so a
   * split whose arms stop sharing one rolls it back.
   */
  async assertSchedulesMatch(
    em: EntityManager,
    actionIds: number[],
  ): Promise<void> {
    const arms = await em.find(ActionSuiteSplitArm, {
      where: { actionId: In(actionIds) },
      select: { splitId: true },
    });
    if (arms.length === 0) return;
    const siblings = await em.find(ActionSuiteSplitArm, {
      where: { splitId: In(arms.map((arm) => arm.splitId)) },
      relations: { action: { events: true } },
    });
    for (const splitId of new Set(siblings.map((arm) => arm.splitId))) {
      const mismatch = armScheduleMismatch(
        siblings
          .filter((arm) => arm.splitId === splitId)
          .flatMap((arm) => (arm.action ? [arm.action] : [])),
      );
      if (mismatch) throw new BadRequestException(mismatch);
    }
  }

  private async loadSplitInSuite(
    em: EntityManager,
    params: { suiteId: number; splitId: number; now: Date },
  ): Promise<SplitWithLaunch> {
    const split = await em.findOne(ActionSuiteSplit, {
      where: { id: params.splitId, suiteId: params.suiteId },
      relations: { arms: { action: { events: true } } },
    });
    if (!split) throw new NotFoundException("Split not found");
    return withLaunch(parseSplit(split), params.now);
  }

  private async loadArmActions(
    em: EntityManager,
    params: {
      suiteId: number;
      splitId?: number;
      actionIds: number[];
      now: Date;
    },
  ): Promise<Action[]> {
    const { suiteId, splitId, actionIds, now } = params;
    if (new Set(actionIds).size !== actionIds.length) {
      throw new BadRequestException("An action can be only one arm.");
    }
    const actions = await em.find(Action, {
      where: { id: In(actionIds) },
      relations: { events: true, suite: true },
    });
    const byId = new Map(actions.map((action) => [action.id, action]));
    const ordered = actionIds.map((id) => {
      const action = byId.get(id);
      if (!action) throw new NotFoundException(`Action ${id} not found`);
      if (action.suite?.id !== suiteId) {
        throw new BadRequestException(`"${action.name}" isn't in this suite.`);
      }
      const ineligible = armIneligibility(action);
      if (ineligible) throw new BadRequestException(ineligible);
      return action;
    });
    const taken = await em.find(ActionSuiteSplitArm, {
      where: {
        actionId: In(actionIds),
        ...(splitId === undefined ? {} : { splitId: Not(splitId) }),
      },
    });
    if (taken.length > 0) {
      const name = byId.get(taken[0].actionId)?.name;
      throw new BadRequestException(`"${name}" is already in another split.`);
    }
    const mismatch = armScheduleMismatch(ordered);
    if (mismatch) throw new BadRequestException(mismatch);
    if (hasSplitLaunched(ordered, now)) {
      throw new BadRequestException(
        "These actions have launched, so they can't be split now.",
      );
    }
    return ordered;
  }

  /** Hands the arm's optional flag back to its action as it leaves the split. */
  private async releaseArms(
    em: EntityManager,
    params: { arms: ActionSuiteSplitArm[] },
  ): Promise<void> {
    for (const arm of params.arms) {
      await em.update(Action, arm.actionId, { optional: arm.optional });
    }
  }
}

function withLaunch(split: ParsedSplit, now: Date): SplitWithLaunch {
  return {
    split,
    launched: hasSplitLaunched(
      split.arms.flatMap((arm) => (arm.action ? [arm.action] : [])),
      now,
    ),
  };
}

function assertArmsShape(arms: { rule: unknown }[]): void {
  const last = arms.at(-1);
  if (last && last.rule !== null) {
    throw new BadRequestException(
      "The last arm catches everyone else, so it takes no rule.",
    );
  }
  if (arms.slice(0, -1).some((arm) => arm.rule === null)) {
    throw new BadRequestException("Every arm but the last needs a rule.");
  }
}

function assertOnlyLaunchSafeChanges(params: {
  stored: ParsedSplit;
  filterExpression: unknown;
  arms: { actionId: number; rule: unknown }[];
}): void {
  const { stored, filterExpression, arms } = params;
  const same =
    isEqual(stored.filterExpression, filterExpression) &&
    stored.arms.length === arms.length &&
    stored.arms.every(
      (arm, index) =>
        arm.actionId === arms[index].actionId &&
        isEqual(arm.rule, arms[index].rule),
    );
  if (!same) {
    throw new BadRequestException(
      "This split has launched, so only its title, visibility and arms' optional flags can change.",
    );
  }
}
