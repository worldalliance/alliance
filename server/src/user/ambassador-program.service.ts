import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { writeUnderLive } from "src/datasources/soft-delete";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { DataSource, In, type Repository } from "typeorm";
import {
  type AmbassadorInviteGoalWithAmbassador,
  AmbassadorInviteStatsService,
  EMPTY_AMBASSADOR_INVITE_STATS,
} from "./ambassador-invite-stats.service";
import {
  AmbassadorInviteGoalWithStats,
  AmbassadorInviteStats,
  AmbassadorProgramDashboard,
  AmbassadorProgramInviteStats,
  type AmbassadorProgramMemberWithInviteStats,
  type AmbassadorProgramMemberWithUser,
  CreateAmbassadorProgramInteractionDto,
  UpdateAmbassadorProgramMemberDto,
  UpsertAmbassadorProgramMemberDto,
} from "./dto/invite.dto";
import { AmbassadorInviteGoal } from "./entities/ambassador-invite-goal.entity";
import { AmbassadorProgramInteraction } from "./entities/ambassador-program-interaction.entity";
import { AmbassadorProgramMember } from "./entities/ambassador-program-member.entity";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

const AMBASSADOR_MEMBER_NOT_FOUND = "Ambassador program member not found";

@Injectable()
export class AmbassadorProgramService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AmbassadorInviteGoal)
    private readonly ambassadorInviteGoalRepository: TypedRepository<AmbassadorInviteGoal>,
    @InjectRepository(AmbassadorProgramMember)
    private readonly ambassadorProgramMemberRepository: TypedRepository<AmbassadorProgramMember>,
    @InjectRepository(AmbassadorProgramInteraction)
    private readonly ambassadorProgramInteractionRepository: Repository<AmbassadorProgramInteraction>,
    private readonly userService: UserService,
    private readonly ambassadorInviteStatsService: AmbassadorInviteStatsService,
  ) {}

  async getAmbassadorProgramDashboard(): Promise<AmbassadorProgramDashboard> {
    const members = await this.ambassadorProgramMemberRepository.find({
      relations: {
        interactions: true,
        user: { contractEvents: true, tags: true },
      },
      order: {
        activeParticipant: "DESC",
        invited: "DESC",
        updatedAt: "DESC",
        id: "ASC",
      },
    });
    const activeUserIds = members
      .filter((member) => member.activeParticipant)
      .map((member) => member.userId);
    const [projection, totalsByUserId, goals] = await Promise.all([
      this.ambassadorInviteStatsService.getAmbassadorInviteProjection(
        activeUserIds,
      ),
      this.ambassadorInviteStatsService.getAmbassadorInviteStatsByUserIds(
        activeUserIds,
      ),
      activeUserIds.length
        ? this.ambassadorInviteGoalRepository.find({
            where: { ambassador: { id: In(activeUserIds) } },
            relations: { ambassador: true },
            order: { startAt: "ASC", id: "ASC" },
          })
        : Promise.resolve([]),
    ]);
    const statsByGoalId =
      await this.ambassadorInviteStatsService.getAmbassadorInviteStatsByGoalIds(
        goals,
      );
    const inviteStatsByUserId = this.getAmbassadorProgramInviteStatsByUserId({
      userIds: activeUserIds,
      totalsByUserId,
      goals,
      statsByGoalId,
    });

    const membersWithInviteStats: AmbassadorProgramMemberWithInviteStats[] =
      members.map((member) => {
        if (!member.activeParticipant) {
          return member;
        }

        return Object.assign(member, {
          inviteStats: inviteStatsByUserId.get(member.userId),
        });
      });

    return { members: membersWithInviteStats, projection };
  }

  private getAmbassadorProgramInviteStatsByUserId(params: {
    userIds: number[];
    totalsByUserId: Map<number, AmbassadorInviteStats>;
    goals: AmbassadorInviteGoalWithAmbassador[];
    statsByGoalId: Map<number, AmbassadorInviteStats>;
  }): Map<number, AmbassadorProgramInviteStats> {
    const { userIds, totalsByUserId, goals, statsByGoalId } = params;
    const now = new Date();
    const goalsByUserId = new Map<number, AmbassadorInviteGoalWithStats[]>();

    for (const goal of goals) {
      const goalWithStats = {
        goal,
        stats: statsByGoalId.get(goal.id) ?? EMPTY_AMBASSADOR_INVITE_STATS,
      };
      const userGoals = goalsByUserId.get(goal.ambassador.id) ?? [];
      userGoals.push(goalWithStats);
      goalsByUserId.set(goal.ambassador.id, userGoals);
    }

    return new Map(
      userIds.map((userId) => {
        const goalsWithStats = goalsByUserId.get(userId) ?? [];
        const currentGoals = goalsWithStats
          .filter(({ goal }) => goal.startAt <= now && goal.dueAt >= now)
          .sort((a, b) => b.goal.startAt.getTime() - a.goal.startAt.getTime());
        const [currentGoal, ...otherCurrentGoals] = currentGoals;

        return [
          userId,
          {
            totals: totalsByUserId.get(userId) ?? EMPTY_AMBASSADOR_INVITE_STATS,
            currentGoal,
            pastGoals: goalsWithStats
              .filter(({ goal }) => goal.dueAt < now)
              .sort((a, b) => b.goal.dueAt.getTime() - a.goal.dueAt.getTime()),
            upcomingGoals: [
              ...otherCurrentGoals,
              ...goalsWithStats.filter(({ goal }) => goal.startAt > now),
            ].sort(
              (a, b) => a.goal.startAt.getTime() - b.goal.startAt.getTime(),
            ),
          },
        ];
      }),
    );
  }

  private async findAmbassadorProgramMemberOrFail(
    userId: number,
  ): Promise<AmbassadorProgramMemberWithUser> {
    const member = await this.ambassadorProgramMemberRepository.findOne({
      where: { user: { id: userId } },
      relations: {
        interactions: true,
        user: { contractEvents: true, tags: true },
      },
      order: { interactions: { interactionDate: "DESC", id: "DESC" } },
    });

    if (!member) {
      throw new NotFoundException(AMBASSADOR_MEMBER_NOT_FOUND);
    }

    return member;
  }

  async upsertAmbassadorProgramMember(
    body: UpsertAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberWithUser> {
    const userP = this.userService.findOneOrFail(body.userId, {
      contractEvents: true,
      tags: true,
    });
    const existingP = this.ambassadorProgramMemberRepository.findOne({
      where: { user: { id: body.userId } },
      relations: { user: { contractEvents: true, tags: true } },
    });

    const user = await userP;
    const existing = await existingP;

    const member =
      existing ??
      this.ambassadorProgramMemberRepository.create({
        user,
        invited: false,
        activeParticipant: false,
      });

    if (body.invited !== undefined) {
      member.invited = body.invited;
    }
    if (body.activeParticipant !== undefined) {
      member.activeParticipant = body.activeParticipant;
    }

    await writeUnderLive(this.dataSource.manager, {
      parents: [{ target: User, id: body.userId }],
      ...(existing && {
        saved: {
          target: AmbassadorProgramMember,
          id: existing.id,
          notFound: AMBASSADOR_MEMBER_NOT_FOUND,
        },
      }),
      write: (manager) => manager.save(member),
    });
    return this.findAmbassadorProgramMemberOrFail(body.userId);
  }

  async updateAmbassadorProgramMember(
    userId: number,
    body: UpdateAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberWithUser> {
    const member = await this.findAmbassadorProgramMemberOrFail(userId);

    if (body.invited !== undefined) {
      member.invited = body.invited;
    }
    if (body.activeParticipant !== undefined) {
      member.activeParticipant = body.activeParticipant;
    }

    await writeUnderLive(this.dataSource.manager, {
      saved: {
        target: AmbassadorProgramMember,
        id: member.id,
        notFound: AMBASSADOR_MEMBER_NOT_FOUND,
      },
      write: (manager) => manager.save(member),
    });
    return this.findAmbassadorProgramMemberOrFail(userId);
  }

  async createAmbassadorProgramInteraction(
    body: CreateAmbassadorProgramInteractionDto,
    createdByUserId: number,
  ): Promise<AmbassadorProgramMemberWithUser> {
    const [member, createdBy] = await Promise.all([
      this.upsertAmbassadorProgramMember({
        userId: body.userId,
      }),
      this.userService.findOneOrFail(createdByUserId),
    ]);
    const text = body.text.trim();

    if (!text) {
      throw new BadRequestException("Interaction text is required");
    }

    const interaction = this.ambassadorProgramInteractionRepository.create({
      programMember: member,
      createdBy,
      text,
      interactionDate: body.interactionDate,
    });
    await writeUnderLive(this.dataSource.manager, {
      parents: [
        { target: User, id: createdBy.id },
        { target: AmbassadorProgramMember, id: member.id },
      ],
      write: (manager) => manager.save(interaction),
    });

    return this.findAmbassadorProgramMemberOrFail(body.userId);
  }
}
