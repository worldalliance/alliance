import { Injectable } from "@nestjs/common";
import { PartitionPlacementService } from "src/suite-partitions/partition-placement.service";
import type { User } from "src/user/entities/user.entity";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import {
  partitionCohort,
  ruleCohort,
  type DecidingCohort,
} from "./deciding-cohort";
import type { ParsedAction } from "./entities/action.entity";

@Injectable()
export class DecidingCohortService {
  constructor(
    private readonly cohortResolverService: CohortResolverService,
    private readonly partitionPlacement: PartitionPlacementService,
  ) {}

  /**
   * The cohort deciding `users` on the action: its partition's parts, placing
   * those not placed yet, or its cohort rule. `undefined` when its partition
   * failed to go live, which decides nobody.
   */
  async cohortFor(params: {
    action: ParsedAction;
    users: User[];
    session: CohortResolutionSession;
  }): Promise<DecidingCohort | undefined> {
    const { action, users, session } = params;
    const suiteId = await this.partitionPlacement.partitionSuiteId(action.id);
    if (suiteId === undefined) {
      return ruleCohort({
        memberIds: await this.cohortResolverService.resolveCohortMemberIds(
          action.cohortExpression,
          session,
        ),
        optional: action.optional,
      });
    }
    const parts = await this.partitionPlacement.place({
      suiteId,
      userIds: users.map((user) => user.id),
    });
    return parts && partitionCohort({ actionId: action.id, parts });
  }
}
