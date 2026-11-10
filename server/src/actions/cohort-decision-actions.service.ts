import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import {
  computeCohortEnrollment,
  isInCatchUp,
  type CohortEnrollment,
} from "./cohort-decision";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { awaitSplitPrerequisites, splitIdByArm } from "./split-decision";
import { SuiteSplitsService } from "./suite-splits.service";

@Injectable()
export class CohortDecisionActionsService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly suiteSplits: SuiteSplitsService,
  ) {}

  async findResolvableActions(
    now: Date,
  ): Promise<{ action: ParsedAction; enrollment: CohortEnrollment }[]> {
    return (await this.findResolvable(now)).items;
  }

  /**
   * Arms wait on every sibling arm's prerequisites; see
   * `awaitSplitPrerequisites`.
   */
  async findResolvable(now: Date): Promise<{
    items: { action: ParsedAction; enrollment: CohortEnrollment }[];
    splitIds: Map<number, number>;
  }> {
    const [loaded, splits] = await Promise.all([
      this.actionRepository.find({
        where: { publicOnly: false },
        relations: { events: true },
      }),
      this.suiteSplits.findAll(),
    ]);
    const actions = loaded.map(parseAction);
    awaitSplitPrerequisites({ actions, splits });
    return {
      items: actions.map((action) => ({
        action,
        enrollment: computeCohortEnrollment(action, now),
      })),
      splitIds: splitIdByArm(splits),
    };
  }

  /** The actions with every arm of any split among them, loaded as `findResolvable` does. */
  async loadWithSplitArms(actionIds: number[]): Promise<{
    actions: ParsedAction[];
    splitIds: Map<number, number>;
  }> {
    const splits = await this.suiteSplits.findAll();
    const splitIds = splitIdByArm(splits);
    const touched = new Set(actionIds.map((id) => splitIds.get(id)));
    const ids = [
      ...actionIds,
      ...splits
        .filter((split) => touched.has(split.id))
        .flatMap((split) => split.arms.map((arm) => arm.actionId)),
    ];
    const actions = (
      await this.actionRepository.find({
        where: { id: In([...new Set(ids)]), publicOnly: false },
        relations: { events: true },
      })
    ).map(parseAction);
    awaitSplitPrerequisites({ actions, splits });
    return { actions, splitIds };
  }

  async findActionsInCatchUp(
    now: Date,
  ): Promise<{ action: ParsedAction; enrollment: CohortEnrollment }[]> {
    return (await this.findResolvableActions(now)).filter(({ enrollment }) =>
      isInCatchUp(enrollment, now),
    );
  }
}
