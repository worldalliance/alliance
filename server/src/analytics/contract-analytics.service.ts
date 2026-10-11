import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInDay } from "date-fns/constants";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  compareContractEventsNewestFirst,
  ContractEvent,
  ContractEventType,
  isContractActiveAt,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { findLeast } from "src/utils/filter";
import { type Repository } from "typeorm";
import { AggregateStats } from "./aggregatestats.dto";
import { ContractStatusPoint } from "./contract-status-history.dto";
import { formatDateKey } from "./date-key";

@Injectable()
export class ContractAnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
  ) {}

  private async contractEventsByUser(): Promise<
    Map<number, Pick<ContractEvent, "id" | "date" | "type">[]>
  > {
    const allEvents = await this.contractEventRepository.find({
      relations: { user: true },
    });

    const userEvents = new Map<
      number,
      Pick<ContractEvent, "id" | "date" | "type">[]
    >();

    for (const event of allEvents) {
      const userId = event.user?.id;
      if (!userId) continue;

      const events = userEvents.get(userId) ?? [];
      events.push({ id: event.id, date: event.date, type: event.type });
      userEvents.set(userId, events);
    }

    return userEvents;
  }

  async getTimeToChurnSamples(): Promise<number[]> {
    const userEvents = await this.contractEventsByUser();
    const now = new Date();

    const churnedUsers = new Map<number, Date>();
    for (const [userId, events] of userEvents) {
      if (isContractActiveAt(events, now)) continue;

      const lastSigned = findLeast(
        events,
        compareContractEventsNewestFirst,
        (event) => event.type === ContractEventType.SIGNED && event.date <= now,
      );
      if (lastSigned) churnedUsers.set(userId, lastSigned.date);
    }

    if (churnedUsers.size === 0) {
      return [];
    }

    const churnedUserIds = Array.from(churnedUsers.keys());
    const lastCompletions = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .select("activity.userId", "userId")
      .addSelect("MAX(activity.createdAt)", "lastCompletedAt")
      .where("activity.type = :type", {
        type: ActionActivityType.USER_COMPLETED,
      })
      .andWhere("activity.userId IN (:...userIds)", {
        userIds: churnedUserIds,
      })
      .groupBy("activity.userId")
      .getRawMany<{ userId: string; lastCompletedAt: string }>();

    const lastCompletionByUserId = new Map<number, Date>();
    for (const row of lastCompletions) {
      const userId = Number(row.userId);
      if (Number.isNaN(userId) || !row.lastCompletedAt) {
        continue;
      }
      const lastCompletedAt = new Date(row.lastCompletedAt);
      if (Number.isNaN(lastCompletedAt.getTime())) {
        continue;
      }
      lastCompletionByUserId.set(userId, lastCompletedAt);
    }

    const samples: number[] = [];

    for (const [userId, signedAt] of churnedUsers) {
      const lastCompletedAt = lastCompletionByUserId.get(userId);
      if (!lastCompletedAt) {
        samples.push(0);
        continue;
      }
      if (lastCompletedAt < signedAt) {
        continue;
      }
      const daysToChurn =
        (lastCompletedAt.getTime() - signedAt.getTime()) / millisecondsInDay;
      if (daysToChurn < 0) {
        continue;
      }
      samples.push(daysToChurn);
    }

    return samples;
  }

  async getAggregateStats(): Promise<AggregateStats> {
    const users = await this.userRepository.find({
      relations: { contractEvents: true },
    });
    const signedUsers = users.filter(
      (user) => user.hasActiveContract === true,
    ).length;

    return {
      signedUsers: signedUsers,
    };
  }

  async getContractStatusHistory(
    startDate: string,
    endDate: string,
  ): Promise<ContractStatusPoint[]> {
    const userEvents = await this.contractEventsByUser();

    // Generate daily data points
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: ContractStatusPoint[] = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateEnd = new Date(currentDate);
      dateEnd.setHours(23, 59, 59, 999);

      let activeCount = 0;
      let churnedCount = 0;
      let totalEverSigned = 0;

      for (const [, events] of userEvents) {
        const hasEverSigned = events.some(
          (e) => e.type === ContractEventType.SIGNED && e.date <= dateEnd,
        );

        if (!hasEverSigned) continue;

        totalEverSigned++;

        if (isContractActiveAt(events, dateEnd)) {
          activeCount++;
        } else {
          churnedCount++;
        }
      }

      results.push({
        date: formatDateKey(currentDate),
        activeCount,
        churnedCount,
        totalEverSigned,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }
}
