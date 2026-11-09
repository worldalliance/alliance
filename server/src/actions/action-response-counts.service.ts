import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import {
  sqlIsLatestWithdrawal,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import { ActionActivity } from "./entities/action-activity.entity";

export type ActionResponseCounts = {
  usersWontComplete: number;
  usersDismissed: number;
};

export const NO_RESPONSES: ActionResponseCounts = {
  usersWontComplete: 0,
  usersDismissed: 0,
};

@Injectable()
export class ActionResponseCountsService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly activityRepository: Repository<ActionActivity>,
  ) {}

  /** Actions with no such responses are absent from the map. */
  async countByAction(): Promise<Map<number, ActionResponseCounts>> {
    const rows = await this.activityRepository
      .createQueryBuilder("activity")
      .select('activity."actionId"', "actionId")
      .addSelect(
        `COUNT(*) FILTER (WHERE ${sqlIsLatestWithdrawal("activity")})`,
        "usersWontComplete",
      )
      .addSelect(
        `COUNT(DISTINCT activity."userId") FILTER (WHERE activity.type = :dismissed AND NOT EXISTS (
          SELECT 1 FROM action_activity terminal
          WHERE terminal."userId" = activity."userId" AND terminal."actionId" = activity."actionId"
            AND terminal.type IN (:...terminalTypes) AND terminal."deletedAt" IS NULL
        ))`,
        "usersDismissed",
      )
      .setParameters({
        dismissed: ActionActivityType.USER_DISMISSED,
        terminalTypes: TERMINAL_ACTIVITY_TYPES,
      })
      .groupBy('activity."actionId"')
      .getRawMany<{
        actionId: number;
        usersWontComplete: string;
        usersDismissed: string;
      }>();
    return new Map(
      rows.map((row) => [
        row.actionId,
        {
          usersWontComplete: Number(row.usersWontComplete),
          usersDismissed: Number(row.usersDismissed),
        },
      ]),
    );
  }
}
