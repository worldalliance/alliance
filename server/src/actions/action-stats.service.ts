import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { And, Between, IsNull, Not, type Repository } from "typeorm";
import { ActionStatus } from "./entities/action-event.entity";
import { Action, CustomActionStat } from "./entities/action.entity";

@Injectable()
export class ActionStatsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(OnetimeInvite)
    private onetimeInviteRepository: Repository<OnetimeInvite>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async computeAllActionStats() {
    const actions = await this.actionRepository
      .find({
        where: {
          customStatType: And(Not(IsNull()), Not(CustomActionStat.NONE)),
        },
        relations: { events: true },
      })
      .then((actions) =>
        actions.filter((action) => action.status === ActionStatus.MemberAction),
      );

    for (const action of actions) {
      await this.computeCustomActionStats(action);
    }
  }

  async computeCustomActionStats(action: Action) {
    if (!action.customStatType) {
      return null;
    }

    let statValue: number | undefined;
    switch (action.customStatType) {
      case CustomActionStat.USERS_INVITED:
        statValue = await this.computeUsersInvited(action);
        break;
      case CustomActionStat.NONE:
        return null;
      default:
        throw new Error(
          `Unknown custom stat type: ${action.customStatType satisfies never}`,
        );
    }
    await this.actionRepository.update(action.id, {
      customStatValue: statValue,
    });
  }

  private async computeUsersInvited(action: Action) {
    const rangeStart = action.memberActionPhase.event?.date;
    const rangeEnd = action.memberActionPhase.deadlineEvent?.date;
    if (!rangeStart || !rangeEnd) {
      return undefined;
    }
    const usersInvited = await this.onetimeInviteRepository.find({
      where: {
        createdAt: Between(rangeStart, rangeEnd),
        status: OnetimeInviteStatus.LINK_USED,
      },
    });
    return usersInvited.length;
  }
}
