import { Injectable } from "@nestjs/common";
import { SplitPlacementService } from "src/suite-splits/split-placement.service";
import type { User } from "src/user/entities/user.entity";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import {
  ruleCohort,
  splitCohort,
  type DecidingCohort,
} from "./deciding-cohort";
import type { ParsedAction } from "./entities/action.entity";

@Injectable()
export class DecidingCohortService {
  constructor(
    private readonly cohortResolverService: CohortResolverService,
    private readonly splitPlacement: SplitPlacementService,
  ) {}

  /**
   * The cohort deciding `users` on the action: its split's groups, placing
   * those not placed yet, or its cohort rule. `undefined` when its split
   * failed to go live, which decides nobody.
   */
  async cohortFor(params: {
    action: ParsedAction;
    users: User[];
    session: CohortResolutionSession;
  }): Promise<DecidingCohort | undefined> {
    const { action, users, session } = params;
    const suiteId = await this.splitPlacement.splitSuiteId(action.id);
    if (suiteId === undefined) {
      return ruleCohort({
        memberIds: await this.cohortResolverService.resolveCohortMemberIds(
          action.cohortExpression,
          session,
        ),
        optional: action.optional,
      });
    }
    const groups = await this.splitPlacement.place({
      suiteId,
      userIds: users.map((user) => user.id),
    });
    return groups && splitCohort({ actionId: action.id, groups });
  }
}
