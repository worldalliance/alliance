import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInDay } from "date-fns/constants";
import { ShareUrlKind } from "src/share-urls/entities/share-url.entity";
import type {
  Repository as TypedRepository,
  WithRelations,
} from "src/utils/Repository";
import { In, MoreThan, type Repository } from "typeorm";
import {
  AmbassadorInviteGoalWithStats,
  AmbassadorInviteProjection,
  AmbassadorInviteStats,
} from "./dto/invite.dto";
import { AmbassadorInviteGoal } from "./entities/ambassador-invite-goal.entity";
import { ContractEventType } from "./entities/contract-event.entity";
import { OnetimeInvite } from "./entities/onetime-invite.entity";
import { ReferralSource } from "./entities/user.entity";
import { inviteAcceptedSql } from "./invite-claim";

const AMBASSADOR_PROJECTION_DAYS = [14, 30] as const;
const AMBASSADOR_REFERRAL_SOURCE_ELIGIBILITY: Record<ReferralSource, boolean> =
  {
    [ReferralSource.ReferralLink]: true,
    [ReferralSource.OnetimeInvite]: true,
    [ReferralSource.ActionShareLink]: false,
    [ReferralSource.ExternalShareLink]: false,
    [ReferralSource.InviteShareLink]: true,
    [ReferralSource.Campaign]: false,
    [ReferralSource.None]: false,
  };
const AMBASSADOR_REFERRAL_SOURCES = Object.values(ReferralSource).filter(
  (source) => AMBASSADOR_REFERRAL_SOURCE_ELIGIBILITY[source],
);
export const EMPTY_AMBASSADOR_INVITE_STATS: AmbassadorInviteStats = {
  totalInvitesSent: 0,
  totalAcceptedInvites: 0,
  totalSuccessfulRecruits: 0,
  goalSuccessfulRecruits: 0,
};

export type AmbassadorInviteGoalWithAmbassador = WithRelations<
  AmbassadorInviteGoal,
  { ambassador: true }
>;

@Injectable()
export class AmbassadorInviteStatsService {
  constructor(
    @InjectRepository(OnetimeInvite)
    private readonly onetimeInviteRepository: Repository<OnetimeInvite>,
    @InjectRepository(AmbassadorInviteGoal)
    private readonly ambassadorInviteGoalRepository: TypedRepository<AmbassadorInviteGoal>,
  ) {}

  async getAmbassadorInviteProjection(
    userIds: number[],
  ): Promise<AmbassadorInviteProjection> {
    const now = new Date();
    const goals = userIds.length
      ? await this.ambassadorInviteGoalRepository.find({
          where: {
            dueAt: MoreThan(now),
            ambassador: { id: In(userIds) },
          },
          relations: { ambassador: true },
          order: { dueAt: "ASC", id: "ASC" },
        })
      : [];
    const statsByGoalId = await this.getAmbassadorInviteStatsByGoalIds(goals);
    const goalsWithStats: AmbassadorInviteGoalWithStats[] = goals.map(
      (goal) => ({
        goal,
        stats: statsByGoalId.get(goal.id) ?? EMPTY_AMBASSADOR_INVITE_STATS,
      }),
    );

    return {
      generatedAt: now.toISOString(),
      points: AMBASSADOR_PROJECTION_DAYS.map((days) => {
        const date = new Date(now.getTime() + days * millisecondsInDay);
        const projectedSuccessfulRecruits = Math.round(
          goalsWithStats.reduce(
            (total, goalWithStats) =>
              total +
              this.projectGoalSuccessfulRecruits(goalWithStats, date, now),
            0,
          ),
        );

        return {
          date: date.toISOString(),
          projectedSuccessfulRecruits,
        };
      }),
    };
  }

  private projectGoalSuccessfulRecruits(
    goalWithStats: AmbassadorInviteGoalWithStats,
    checkpoint: Date,
    now: Date,
  ): number {
    const { goal, stats } = goalWithStats;
    const remaining = Math.max(
      0,
      goal.targetSuccessfulRecruits - stats.goalSuccessfulRecruits,
    );
    if (remaining === 0 || checkpoint <= goal.startAt || now >= goal.dueAt) {
      return 0;
    }

    const projectionStart = goal.startAt > now ? goal.startAt : now;
    if (checkpoint >= goal.dueAt) {
      return remaining;
    }
    if (checkpoint <= projectionStart) {
      return 0;
    }

    const remainingWindowMs = goal.dueAt.getTime() - projectionStart.getTime();
    if (remainingWindowMs <= 0) {
      return remaining;
    }

    const elapsedMs = checkpoint.getTime() - projectionStart.getTime();
    return remaining * Math.min(1, Math.max(0, elapsedMs / remainingWindowMs));
  }

  async getAmbassadorInviteStatsByUserIds(
    userIds: number[],
  ): Promise<Map<number, AmbassadorInviteStats>> {
    const stats = await this.queryAmbassadorInviteStats(
      userIds.map((userId) => ({ userId, goal: null })),
    );
    return new Map(userIds.map((userId, i) => [userId, stats[i]]));
  }

  async getAmbassadorInviteStatsByGoalIds(
    goals: AmbassadorInviteGoalWithAmbassador[],
  ): Promise<Map<number, AmbassadorInviteStats>> {
    const stats = await this.queryAmbassadorInviteStats(
      goals.map((goal) => ({ userId: goal.ambassador.id, goal })),
    );
    return new Map(goals.map((goal, i) => [goal.id, stats[i]]));
  }

  async getAmbassadorInviteStats(
    userId: number,
    goal?: AmbassadorInviteGoal,
  ): Promise<AmbassadorInviteStats> {
    const [stats] = await this.queryAmbassadorInviteStats([
      { userId, goal: goal ?? null },
    ]);
    return stats;
  }

  /**
   * Stats per entry, in input order. An entry with a goal counts only what
   * falls inside the goal's inclusive window; one without counts all time.
   */
  private async queryAmbassadorInviteStats(
    entries: {
      userId: number;
      goal: Pick<AmbassadorInviteGoal, "startAt" | "dueAt"> | null;
    }[],
  ): Promise<AmbassadorInviteStats[]> {
    if (!entries.length) {
      return [];
    }

    const rows = (await this.onetimeInviteRepository.query(
      `
        WITH selected_windows AS (
          SELECT *
          FROM UNNEST(
            $1::int[],
            $2::timestamptz[],
            $3::timestamptz[]
          ) WITH ORDINALITY AS selected_window("userId", "startAt", "dueAt", "ordinal")
        ),
        invite_stats AS (
          SELECT
            selected_windows."ordinal",
            COUNT(invite."id")::int AS "totalInvitesSent",
            COUNT(invite."id") FILTER (
              WHERE ${inviteAcceptedSql("invite")}
            )::int AS "totalAcceptedInvites"
          FROM selected_windows
          LEFT JOIN "onetime_invite" invite
            ON invite."invitingUserId" = selected_windows."userId"
            AND invite."deletedAt" IS NULL
            AND (selected_windows."startAt" IS NULL OR invite."createdAt" >= selected_windows."startAt")
            AND (selected_windows."dueAt" IS NULL OR invite."createdAt" <= selected_windows."dueAt")
          GROUP BY selected_windows."ordinal"
        ),
        successful_stats AS (
          SELECT
            selected_windows."ordinal",
            COUNT(invited_user."id") FILTER (
              WHERE first_sign."signedAt" IS NOT NULL
                AND (selected_windows."startAt" IS NULL OR first_sign."signedAt" >= selected_windows."startAt")
                AND (selected_windows."dueAt" IS NULL OR first_sign."signedAt" <= selected_windows."dueAt")
            )::int AS "totalSuccessfulRecruits"
          FROM selected_windows
          LEFT JOIN "user" invited_user
            ON invited_user."referredById" = selected_windows."userId"
            AND invited_user."deletedAt" IS NULL
            AND invited_user."referralSource"::text = ANY($4::text[])
          LEFT JOIN LATERAL (
            SELECT MIN(contract_event."date") AS "signedAt"
            FROM "contract_event" contract_event
            WHERE contract_event."userId" = invited_user."id"
              AND contract_event."deletedAt" IS NULL
              AND contract_event."type" = $5
          ) first_sign ON TRUE
          GROUP BY selected_windows."ordinal"
        ),
        share_stats AS (
          SELECT
            selected_windows."ordinal",
            COUNT(share_invite."id")::int AS "duplicateInviteLinks"
          FROM selected_windows
          LEFT JOIN "share_url" share_invite
            ON share_invite."userId" = selected_windows."userId"
            AND share_invite."deletedAt" IS NULL
            AND share_invite."kind" = $6
            AND share_invite."duplicate" = TRUE
            AND (selected_windows."startAt" IS NULL OR share_invite."createdAt" >= selected_windows."startAt")
            AND (selected_windows."dueAt" IS NULL OR share_invite."createdAt" <= selected_windows."dueAt")
          GROUP BY selected_windows."ordinal"
        )
        SELECT
          (
            COALESCE(invite_stats."totalInvitesSent", 0)
            + COALESCE(share_stats."duplicateInviteLinks", 0)
          )::int AS "totalInvitesSent",
          COALESCE(invite_stats."totalAcceptedInvites", 0)::int
            AS "totalAcceptedInvites",
          COALESCE(successful_stats."totalSuccessfulRecruits", 0)::int
            AS "totalSuccessfulRecruits"
        FROM selected_windows
        LEFT JOIN invite_stats
          ON invite_stats."ordinal" = selected_windows."ordinal"
        LEFT JOIN successful_stats
          ON successful_stats."ordinal" = selected_windows."ordinal"
        LEFT JOIN share_stats
          ON share_stats."ordinal" = selected_windows."ordinal"
        ORDER BY selected_windows."ordinal"
      `,
      [
        entries.map((entry) => entry.userId),
        entries.map((entry) => entry.goal?.startAt ?? null),
        entries.map((entry) => entry.goal?.dueAt ?? null),
        AMBASSADOR_REFERRAL_SOURCES,
        ContractEventType.SIGNED,
        ShareUrlKind.Invite,
      ],
    )) as Omit<AmbassadorInviteStats, "goalSuccessfulRecruits">[];

    return entries.map(({ goal }, i) => ({
      ...rows[i],
      goalSuccessfulRecruits: goal ? rows[i].totalSuccessfulRecruits : 0,
    }));
  }
}
