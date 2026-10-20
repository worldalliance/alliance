import { forCount } from "@alliance/common/plural";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { softDeleteCascade, writeUnderLive } from "src/datasources/soft-delete";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { notifMessage } from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { DataSource, In } from "typeorm";
import {
  getAmbassadorGoalHalfwayNotificationMessage,
  getAmbassadorGoalHalfwayNotificationTime,
} from "./ambassador-invite-goal-notification.utils";
import {
  type AmbassadorInviteGoalWithAmbassador,
  AmbassadorInviteStatsService,
  EMPTY_AMBASSADOR_INVITE_STATS,
} from "./ambassador-invite-stats.service";
import {
  AmbassadorInviteDashboard,
  AmbassadorInviteStats,
  CreateAmbassadorInviteGoalDto,
  UpdateAmbassadorInviteGoalDto,
} from "./dto/ambassador-invite.dto";
import { AmbassadorInviteGoal } from "./entities/ambassador-invite-goal.entity";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

const AMBASSADOR_INVITES_URL = "/invites";
const AMBASSADOR_GOAL_NOTIFICATION_LOOKBACK_MS = milliseconds({ hours: 1 });

function ambassadorGoalHalfwayGroupingKey(goalId: number) {
  return `ambassador-invite-goal:${goalId}:halfway`;
}

function ambassadorGoalEndedGroupingKey(goalId: number) {
  return `ambassador-invite-goal:${goalId}:ended`;
}

@Injectable()
export class AmbassadorInviteGoalService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AmbassadorInviteGoal)
    private readonly ambassadorInviteGoalRepository: TypedRepository<AmbassadorInviteGoal>,
    private readonly userService: UserService,
    private readonly notifsService: NotifsService,
    private readonly ambassadorInviteStatsService: AmbassadorInviteStatsService,
  ) {}

  async createAmbassadorInviteGoal(
    body: CreateAmbassadorInviteGoalDto,
    userId: number,
  ): Promise<AmbassadorInviteGoal> {
    const user = await this.userService.findOneOrFail(userId);
    const startAt = new Date(body.startAt);
    const dueAt = new Date(body.dueAt);

    if (!user.ambassador) {
      throw new ForbiddenException("Only ambassadors can set invite goals");
    }
    this.validateAmbassadorInviteGoalDates(startAt, dueAt);
    await this.assertAmbassadorInviteGoalDoesNotOverlap({
      userId,
      startAt,
      dueAt,
    });

    const goal = this.ambassadorInviteGoalRepository.create({
      ambassador: user,
      targetSuccessfulRecruits: body.targetSuccessfulRecruits,
      startAt,
      dueAt,
    });
    return writeUnderLive(this.dataSource.manager, {
      parents: [{ target: User, id: userId }],
      write: (manager) => manager.save(goal),
    });
  }

  async updateAmbassadorInviteGoal(
    goalId: number,
    body: UpdateAmbassadorInviteGoalDto,
    userId: number,
  ): Promise<AmbassadorInviteGoal> {
    const userP = this.userService.findOneOrFail(userId);
    const goalP = this.ambassadorInviteGoalRepository.findOneOrFail({
      where: { id: goalId, ambassador: { id: userId } },
      relations: { ambassador: true },
    });

    const user = await userP;
    if (!user.ambassador) {
      throw new ForbiddenException("Only ambassadors can edit invite goals");
    }

    const goal = await goalP;
    const startAt = body.startAt ? new Date(body.startAt) : goal.startAt;
    const dueAt = body.dueAt ? new Date(body.dueAt) : goal.dueAt;

    this.validateAmbassadorInviteGoalDates(startAt, dueAt);
    await this.assertAmbassadorInviteGoalDoesNotOverlap({
      userId,
      startAt,
      dueAt,
      excludeGoalId: goal.id,
    });

    goal.startAt = startAt;
    goal.dueAt = dueAt;
    if (body.targetSuccessfulRecruits !== undefined) {
      goal.targetSuccessfulRecruits = body.targetSuccessfulRecruits;
    }

    return writeUnderLive(this.dataSource.manager, {
      saved: {
        target: AmbassadorInviteGoal,
        id: goal.id,
        notFound: "Ambassador invite goal not found",
      },
      write: (manager) => manager.save(goal),
    });
  }

  async deleteAmbassadorInviteGoal(
    goalId: number,
    userId: number,
  ): Promise<void> {
    const user = await this.userService.findOneOrFail(userId);
    if (!user.ambassador) {
      throw new ForbiddenException("Only ambassadors can delete invite goals");
    }

    const goal = await this.ambassadorInviteGoalRepository.findOneOrFail({
      where: { id: goalId, ambassador: { id: userId } },
    });
    await softDeleteCascade(this.ambassadorInviteGoalRepository.manager, {
      target: AmbassadorInviteGoal,
      ids: [goal.id],
    });
  }

  async getAmbassadorInviteDashboard(
    userId: number,
  ): Promise<AmbassadorInviteDashboard> {
    const userP = this.userService.findOneOrFail(userId);
    const goalsP = this.ambassadorInviteGoalRepository.find({
      where: { ambassador: { id: userId } },
      relations: { ambassador: true },
      order: { startAt: "ASC", id: "ASC" },
    });

    const user = await userP;
    if (!user.ambassador) {
      throw new ForbiddenException("Only ambassadors can view invite stats");
    }
    const goals = await goalsP;
    const [stats, statsByGoalId, projection] = await Promise.all([
      this.ambassadorInviteStatsService.getAmbassadorInviteStats(userId),
      this.ambassadorInviteStatsService.getAmbassadorInviteStatsByGoalIds(
        goals,
      ),
      this.ambassadorInviteStatsService.getAmbassadorInviteProjection([userId]),
    ]);
    const goalsWithStats = goals.map((goal) => ({
      goal,
      stats: statsByGoalId.get(goal.id) ?? EMPTY_AMBASSADOR_INVITE_STATS,
    }));

    return { goals: goalsWithStats, projection, stats };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueAmbassadorInviteGoalNotifications(): Promise<void> {
    const now = new Date();
    const lookbackAt = new Date(
      now.getTime() - AMBASSADOR_GOAL_NOTIFICATION_LOOKBACK_MS,
    );
    const [halfwayCandidateRows, endedRows] = await Promise.all([
      this.ambassadorInviteGoalRepository.query(
        `
          SELECT goal."id"
          FROM "ambassador_invite_goal" goal
          WHERE goal."deletedAt" IS NULL
            AND goal."startAt" <= $1::timestamptz
            AND goal."dueAt" > $1::timestamptz
            AND (goal."startAt" + ((goal."dueAt" - goal."startAt") / 2)) <= $1::timestamptz
            AND NOT EXISTS (
              SELECT 1
              FROM "notification" notif
              WHERE notif."userId" = goal."ambassadorId"
                AND notif."groupingKey" = CONCAT(
                  'ambassador-invite-goal:', goal."id", ':halfway'
                )
                AND notif."deletedAt" IS NULL
            )
        `,
        [now],
      ) as Promise<{ id: number }[]>,
      this.ambassadorInviteGoalRepository.query(
        `
          SELECT goal."id"
          FROM "ambassador_invite_goal" goal
          WHERE goal."deletedAt" IS NULL
            AND goal."dueAt" <= $1::timestamptz
            AND goal."dueAt" > $2::timestamptz
        `,
        [now, lookbackAt],
      ) as Promise<{ id: number }[]>,
    ]);

    const goalIds = [
      ...new Set([
        ...halfwayCandidateRows.map((goal) => goal.id),
        ...endedRows.map((goal) => goal.id),
      ]),
    ];
    if (!goalIds.length) {
      return;
    }

    const goals = await this.ambassadorInviteGoalRepository.find({
      where: { id: In(goalIds) },
      relations: { ambassador: true },
    });
    const goalById = new Map(goals.map((goal) => [goal.id, goal]));

    const halfwayGoalsDue = halfwayCandidateRows.flatMap(({ id }) => {
      const goal = goalById.get(id);
      if (!goal) {
        return [];
      }
      const sendTime = getAmbassadorGoalHalfwayNotificationTime(
        goal,
        goal.ambassador,
      );
      return sendTime > lookbackAt && sendTime <= now
        ? [{ goal, sendTime }]
        : [];
    });

    await Promise.all([
      ...halfwayGoalsDue.map(async ({ goal, sendTime }) => {
        await this.sendAmbassadorInviteGoalHalfwayNotif(goal, sendTime);
      }),
      ...endedRows.map(async ({ id }) => {
        const goal = goalById.get(id);
        if (!goal) {
          return;
        }
        await this.sendAmbassadorInviteGoalEndedNotif(goal);
      }),
    ]);
  }

  private async sendAmbassadorInviteGoalHalfwayNotif(
    goal: AmbassadorInviteGoalWithAmbassador,
    sendTime: Date,
  ): Promise<void> {
    await this.sendAmbassadorInviteGoalNotif({
      goal,
      groupingKey: ambassadorGoalHalfwayGroupingKey(goal.id),
      sendTime,
      message: (stats) =>
        getAmbassadorGoalHalfwayNotificationMessage(
          goal,
          stats.goalSuccessfulRecruits,
          sendTime,
        ),
    });
  }

  private async sendAmbassadorInviteGoalEndedNotif(
    goal: AmbassadorInviteGoalWithAmbassador,
  ): Promise<void> {
    await this.sendAmbassadorInviteGoalNotif({
      goal,
      groupingKey: ambassadorGoalEndedGroupingKey(goal.id),
      sendTime: new Date(),
      message: (stats) => this.getAmbassadorInviteGoalEndedMessage(goal, stats),
    });
  }

  private async sendAmbassadorInviteGoalNotif(params: {
    goal: AmbassadorInviteGoalWithAmbassador;
    groupingKey: string;
    sendTime: Date;
    message: (stats: AmbassadorInviteStats) => string;
  }): Promise<void> {
    const { goal, groupingKey, sendTime } = params;
    const alreadySent = await this.notifsService.hasNotifWithGroupingKey(
      goal.ambassador.id,
      groupingKey,
    );
    if (alreadySent) {
      return;
    }

    const stats =
      await this.ambassadorInviteStatsService.getAmbassadorInviteStats(
        goal.ambassador.id,
        goal,
      );
    await this.notifsService.sendNotif({
      user: goal.ambassador,
      category: NotificationCategory.AmbassadorInviteGoal,
      message: notifMessage`${params.message(stats)}`,
      destination: null,
      webAppLocation: AMBASSADOR_INVITES_URL,
      mobileAppLocation: AMBASSADOR_INVITES_URL,
      associatedUsers: [],
      groupingKey,
      sendTime,
      shouldPush: true,
    });
  }

  private getAmbassadorInviteGoalEndedMessage(
    goal: AmbassadorInviteGoal,
    stats: AmbassadorInviteStats,
  ): string {
    const percent = Math.round(
      (stats.goalSuccessfulRecruits / goal.targetSuccessfulRecruits) * 100,
    );

    return `Your recruiting goal ended. You reached ${percent}% of your goal (${this.formatSuccessfulRecruitCount(
      stats.goalSuccessfulRecruits,
      goal.targetSuccessfulRecruits,
    )}).`;
  }

  private formatSuccessfulRecruitCount(successful: number, target: number) {
    return `${successful}/${target} ${forCount(target, "successful recruit")}`;
  }

  private validateAmbassadorInviteGoalDates(startAt: Date, dueAt: Date): void {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException("Goal dates are invalid");
    }
    if (startAt >= dueAt) {
      throw new BadRequestException("Goal start date must be before end date");
    }
  }

  private async assertAmbassadorInviteGoalDoesNotOverlap(params: {
    userId: number;
    startAt: Date;
    dueAt: Date;
    excludeGoalId?: number;
  }): Promise<void> {
    const { userId, startAt, dueAt, excludeGoalId } = params;
    const rows = (await this.ambassadorInviteGoalRepository.query(
      `
        SELECT goal."id"
        FROM "ambassador_invite_goal" goal
        WHERE goal."ambassadorId" = $1
          AND goal."deletedAt" IS NULL
          AND ($4::int IS NULL OR goal."id" <> $4::int)
          AND goal."startAt" < $3::timestamptz
          AND goal."dueAt" > $2::timestamptz
        LIMIT 1
      `,
      [userId, startAt, dueAt, excludeGoalId ?? null],
    )) as { id: number }[];
    const overlap = rows[0];

    if (overlap) {
      throw new BadRequestException(
        "Invite goal dates overlap with an existing goal",
      );
    }
  }
}
