import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { assertCanManageCommunity } from "src/community/community-permissions";
import { Community } from "src/community/entities/community.entity";
import { updateLive, writeUnderLive } from "src/datasources/soft-delete";
import { InviteFeedEvents } from "src/invite-feed.events";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  onetimeInviteRequestApprovedMessage,
  onetimeInviteRequestMessage,
  onetimeInviteRequestRejectedMessage,
} from "src/notifs/notif-copy";
import {
  communityDestination,
  type NotifMessage,
} from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { groupUrl } from "src/search/approutes";
import { PaginationQueryDto } from "src/utils/pagination.dto";
import type { Relations } from "src/utils/Repository";
import {
  DataSource,
  In,
  IsNull,
  type QueryDeepPartialEntity,
  type Repository,
} from "typeorm";
import {
  CreateOnetimeInviteDto,
  type OnetimeInviteEdge,
  type OnetimeInviteList,
  type OnetimeInviteMemberStats,
  RequestOnetimeInviteDto,
} from "./dto/onetime-invite.dto";
import {
  canModifyOnetimeInvite,
  loadedOnetimeInviteInvitingUser,
  OnetimeInvite,
  OnetimeInviteStatus,
} from "./entities/onetime-invite.entity";
import { loadedUserCommunities, User } from "./entities/user.entity";
import { inviteAcceptedSql } from "./invite-claim";
import { UserService } from "./user.service";

@Injectable()
export class OnetimeInviteService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(OnetimeInvite)
    private readonly onetimeInviteRepository: Repository<OnetimeInvite>,
    private readonly userService: UserService,
    private readonly notifsService: NotifsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOnetimeInvite(
    body: CreateOnetimeInviteDto,
    userId: number,
  ): Promise<OnetimeInvite> {
    const code = Math.random().toString(36).substring(2, 15);

    const {
      invitingUserId: providedInvitingUserId,
      communityId,
      ...rest
    } = body;

    const userP = this.userService.findOne(userId, { leaderOf: true });
    const communityP =
      communityId !== undefined
        ? this.communityRepository.findOne({
            where: { id: communityId },
          })
        : undefined;

    const user = await userP;
    if (user === null) {
      throw new BadRequestException("User not found");
    }
    const isAdmin = user.admin;
    if (communityId) {
      assertCanManageCommunity(user, communityId);
    }

    // Normal users cannot create invites from other users
    const invitingUserId =
      (isAdmin ? providedInvitingUserId : undefined) ?? userId;
    const invitingUser =
      invitingUserId === userId
        ? user
        : await this.userService.findOneOrFail(invitingUserId);

    const community = await communityP;
    if (community === null) {
      throw new BadRequestException("Community not found");
    }
    const invite = this.onetimeInviteRepository.create({
      ...rest,
      code,
      invitingUser,
      community: community ?? null,
      status: OnetimeInviteStatus.LINK_UNUSED,
    });
    const savedInvite = await writeUnderLive(this.dataSource.manager, {
      parents: [
        { target: User, id: invitingUser.id },
        ...(community ? [{ target: Community, id: community.id }] : []),
      ],
      write: (manager) => manager.save(invite),
    });
    this.eventEmitter.emit(InviteFeedEvents.Created);
    return savedInvite;
  }

  /**
   * Edit what the inviter chose when the invite was made. Each field is left
   * alone when omitted; `communityId: null` drops the named group, leaving the
   * invitee to be placed like any other referral.
   *
   * Only an unused invite can be edited — once someone has signed up through
   * it, the placement it named has already been acted on.
   */
  async updateOnetimeInvite(params: {
    inviteId: number;
    userId: number;
    invitee?: string;
    communityId?: number | null;
  }): Promise<OnetimeInvite> {
    const { inviteId, userId, invitee, communityId } = params;
    const [invite, user] = await Promise.all([
      this.onetimeInviteRepository.findOneOrFail({
        where: { id: inviteId, deletedAt: IsNull() },
        relations: { invitingUser: true },
      }),
      this.userService.findOneOrFail(userId, { leaderOf: true }),
    ]);
    if (!canModifyOnetimeInvite(user, invite)) {
      throw new BadRequestException("Invite belongs to someone else");
    }
    if (invite.status !== OnetimeInviteStatus.LINK_UNUSED) {
      throw new BadRequestException("This invite can no longer be edited");
    }
    if (communityId !== undefined && communityId !== null) {
      assertCanManageCommunity(user, communityId);
    }

    const trimmedInvitee = invitee?.trim();
    if (invitee !== undefined && !trimmedInvitee) {
      throw new BadRequestException("Invitee name cannot be empty");
    }
    const changes: QueryDeepPartialEntity<OnetimeInvite> = {
      ...(trimmedInvitee !== undefined && { invitee: trimmedInvitee }),
      ...(communityId !== undefined && {
        community: communityId === null ? null : { id: communityId },
      }),
    };
    if (Object.keys(changes).length > 0) {
      await writeUnderLive(this.dataSource.manager, {
        parents:
          communityId != null ? [{ target: Community, id: communityId }] : [],
        write: (manager) =>
          updateLive(manager, {
            target: OnetimeInvite,
            id: inviteId,
            changes,
            notFound: "Invite not found",
          }),
      });
    }
    return this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: { invitingUser: true, community: true, invitedUser: true },
    });
  }

  async deleteOnetimeInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true },
    });
    const user = await this.userService.findOneOrFail(userId);
    if (!canModifyOnetimeInvite(user, invite)) {
      throw new BadRequestException();
    }

    await this.onetimeInviteRepository.update(inviteId, {
      deletedAt: new Date(),
    });
  }

  async requestOnetimeInvite(
    body: RequestOnetimeInviteDto,
    userId: number,
  ): Promise<OnetimeInvite> {
    const { communityId, ...rest } = body;

    const user = await this.userService.findOneOrFail(userId, {
      communities: true,
    });
    const community: Community | undefined = loadedUserCommunities(user).find(
      (community) => community.id === communityId,
    );
    if (!community) {
      throw new BadRequestException(
        `User is not a member of community ${communityId} or community does not exist`,
      );
    }

    const code = Math.random().toString(36).substring(2, 15);

    const invite = this.onetimeInviteRepository.create({
      ...rest,
      code,
      invitingUser: user,
      community,
      status: OnetimeInviteStatus.REQUEST_PENDING,
    });
    const savedInvite = await writeUnderLive(this.dataSource.manager, {
      parents: [
        { target: User, id: userId },
        { target: Community, id: community.id },
      ],
      write: (manager) => manager.save(invite),
    });

    sendNotificationToLeaders: {
      const communityWithLeaders = await this.communityRepository.findOne({
        where: { id: communityId },
        relations: { leaders: true },
      });
      if (!communityWithLeaders || !communityWithLeaders.leaders) {
        console.log("Community leaders not found for community", communityId);
        break sendNotificationToLeaders;
      }
      await this.notifsService.sendNotifs(
        communityWithLeaders.leaders.map((leader) => ({
          user: leader,
          category: NotificationCategory.OnetimeInviteRequestCreated,
          message: onetimeInviteRequestMessage({
            requester: user,
            invitee: rest.invitee,
            community,
          }),
          destination: communityDestination(community.id),
          webAppLocation: groupUrl({
            tab: "invites",
            communityId: community.id,
          }),
          associatedUsers: [user],
          onetimeInvite: savedInvite,
        })),
      );
    }

    return savedInvite;
  }

  async approveOnetimeInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<OnetimeInvite> {
    return this.approveOrRejectOnetimeInviteRequest({
      inviteId,
      userId,
      newStatus: "approve",
    });
  }

  async rejectOnetimeInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<void> {
    await this.approveOrRejectOnetimeInviteRequest({
      inviteId,
      userId,
      newStatus: "reject",
    });
  }

  async approveOrRejectOnetimeInviteRequest(params: {
    userId: number;
    inviteId: number;
    newStatus: "approve" | "reject";
  }): Promise<OnetimeInvite> {
    const { userId, inviteId, newStatus } = params;

    const user = await this.userService.findOneOrFail(userId);

    const request = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true },
    });

    if (request.status !== OnetimeInviteStatus.REQUEST_PENDING) {
      throw new BadRequestException(
        `Invite is not a pending request. Status: ${request.status}`,
      );
    }

    const { communityId } = request;
    if (communityId === null) {
      throw new BadRequestException("Invite request has no group");
    }
    assertCanManageCommunity(user, communityId);

    let category: NotificationCategory;
    let message: (invitee: string) => NotifMessage;
    switch (newStatus) {
      case "approve":
        request.status = OnetimeInviteStatus.LINK_UNUSED;
        category = NotificationCategory.OnetimeInviteRequestApproved;
        message = onetimeInviteRequestApprovedMessage;
        break;
      case "reject":
        request.status = OnetimeInviteStatus.REQUEST_REJECTED;
        category = NotificationCategory.OnetimeInviteRequestRejected;
        message = onetimeInviteRequestRejectedMessage;
        break;
      default:
        throw new InternalServerErrorException(
          `Unhandled status: ${newStatus satisfies never}`,
        );
    }
    const savedInvite = await writeUnderLive(this.dataSource.manager, {
      saved: {
        target: OnetimeInvite,
        id: request.id,
        notFound: "Invite not found",
      },
      write: (em) => em.save(request),
    });

    const invitingUser = loadedOnetimeInviteInvitingUser(savedInvite);
    if (invitingUser) {
      await this.notifsService.sendNotif({
        user: invitingUser,
        category,
        message: message(savedInvite.invitee),
        destination: communityDestination(communityId),
        webAppLocation: groupUrl({
          tab: "invites",
          communityId,
        }),
        associatedUsers: [invitingUser],
      });
    }

    return savedInvite;
  }

  async findInviteByCode(
    code: string,
    relations?: Relations<OnetimeInvite>,
  ): Promise<OnetimeInvite | null> {
    return this.onetimeInviteRepository.findOne({
      where: { code, deletedAt: IsNull() },
      relations: relations ?? {
        invitingUser: true,
        invitedUser: true,
        community: true,
      },
    });
  }

  async findAllOnetimeInvites(
    query: PaginationQueryDto,
  ): Promise<OnetimeInviteList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [items, totalCount] = await this.onetimeInviteRepository.findAndCount(
      {
        where: { deletedAt: IsNull() },
        relations: { invitingUser: true, community: true },
        // id tiebreaker keeps offset pagination stable when createdAt ties
        order: { createdAt: "DESC", id: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getOnetimeInviteMemberStats(): Promise<OnetimeInviteMemberStats[]> {
    const rows = await this.onetimeInviteRepository
      .createQueryBuilder("invite")
      .select("invite.invitingUserId", "userId")
      .addSelect("COUNT(*)", "sent")
      .addSelect(
        `COUNT(*) FILTER (WHERE ${inviteAcceptedSql("invite")})`,
        "accepted",
      )
      .where("invite.deletedAt IS NULL")
      .andWhere("invite.invitingUserId IS NOT NULL")
      .groupBy("invite.invitingUserId")
      // COUNT comes back as a bigint string from pg
      .getRawMany<{ userId: number; sent: string; accepted: string }>();

    const users = rows.length
      ? await this.userRepository.find({
          where: { id: In(rows.map((row) => row.userId)) },
        })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return rows
      .flatMap((row) => {
        const invitingUser = userById.get(row.userId);
        if (!invitingUser) return [];
        return {
          invitingUser,
          sent: Number(row.sent),
          accepted: Number(row.accepted),
        };
      })
      .sort((a, b) => b.sent - a.sent);
  }

  async findOnetimeInviteEdges(): Promise<OnetimeInviteEdge[]> {
    return this.onetimeInviteRepository
      .createQueryBuilder("invite")
      .innerJoin("invite.invitedUser", "invitedUser")
      .select("invite.invitingUserId", "invitingUserId")
      .addSelect("invitedUser.id", "invitedUserId")
      .where(inviteAcceptedSql("invite"))
      .andWhere("invite.invitingUserId IS NOT NULL")
      .getRawMany<OnetimeInviteEdge>();
  }

  async findOnetimeInvites(
    userId: number,
    communityId: number,
  ): Promise<OnetimeInvite[]> {
    const user = await this.userService.findOneOrFail(userId);
    assertCanManageCommunity(user, communityId);
    return this.onetimeInviteRepository.find({
      where: { community: { id: communityId }, deletedAt: IsNull() },
      relations: { invitingUser: true, community: true },
    });
  }

  async findOnetimeInvitesByRequester(
    userId: number,
    communityId: number,
  ): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: {
        invitingUser: { id: userId },
        community: { id: communityId },
        deletedAt: IsNull(),
      },
    });
  }

  async findOnetimeInvitesOverviewForUser(
    userId: number,
  ): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: [
        { invitingUser: { id: userId }, deletedAt: IsNull() },
        {
          community: {
            leaders: { id: userId },
          },
          deletedAt: IsNull(),
        },
      ],
      relations: {
        community: true,
        invitingUser: true,
      },
    });
  }
}
