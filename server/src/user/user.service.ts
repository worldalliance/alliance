import { ActionActivityType } from '@alliance/common/actionActivity';
import type { AccountDerivedConditionKind } from '@alliance/common/forms/visible-if-formula';
import type { Result } from '@alliance/common/result';
import { Temporal } from '@js-temporal/polyfill';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { countBy } from 'es-toolkit';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { LiveActivityRegistration } from 'src/apns/entities/live-activity-registration.entity';
import { CampaignService } from 'src/campaign/campaign.service';
import { Campaign } from 'src/campaign/entities/campaign.entity';
import { CommunityService } from 'src/community/community.service';
import { getStaffAssignableSlots } from 'src/community/community.utils';
import { Community } from 'src/community/entities/community.entity';
import { ALL_MEMBERS_TAG_NAME } from 'src/constants';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { City } from 'src/geo/city.entity';
import { ImagesService } from 'src/images/images.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import {
  type CreateNotifParams,
  NotifsService,
} from 'src/notifs/notifs.service';
import { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import { Push } from 'src/push/push.entity';
import { PushService } from 'src/push/push.service';
import { groupUrl, profileUrl } from 'src/search/approutes';
import {
  ShareUrl,
  ShareUrlKind,
} from 'src/share-urls/entities/share-url.entity';
import {
  inviteAssignmentColumns,
  type InviteAssignmentColumns,
  type StoredInviteAssignment,
} from 'src/share-urls/invite-assignment';
import { ShareUrlsService } from 'src/share-urls/share-urls.service';
import { isForeignKeyViolation } from 'src/utils/db-errors';
import { PaginationQueryDto } from 'src/utils/pagination.dto';
import type {
  Relations,
  Repository as TypedRepository,
} from 'src/utils/Repository';
import {
  Brackets,
  DeepPartial,
  type FindOptionsWhere,
  ILike,
  In,
  IsNull,
  MoreThan,
  Not,
  type Repository,
} from 'typeorm';
import {
  getAmbassadorGoalHalfwayNotificationMessage,
  getAmbassadorGoalHalfwayNotificationTime,
} from './ambassador-invite-goal-notification.utils';
import { CreateAwayRangeDto, UpdateAwayRangeDto } from './dto/away-range.dto';
import {
  RegisterDeviceDto,
  RegisterLiveActivityPushToStartTokenDto,
  RegisterLiveActivityUpdateTokenDto,
} from './dto/device.dto';
import {
  AmbassadorInviteDashboard,
  AmbassadorInviteGoalWithStats,
  AmbassadorInviteProjection,
  AmbassadorInviteStats,
  AmbassadorProgramDashboard,
  AmbassadorProgramInviteStats,
  type AmbassadorProgramMemberWithInviteStats,
  CreateAmbassadorInviteGoalDto,
  CreateAmbassadorProgramInteractionDto,
  CreateOnetimeInviteDto,
  type OnetimeInviteEdge,
  type OnetimeInviteList,
  type OnetimeInviteMemberStats,
  RequestOnetimeInviteDto,
  UpdateAmbassadorInviteGoalDto,
  UpdateAmbassadorProgramMemberDto,
  UpsertAmbassadorProgramMemberDto,
} from './dto/invite.dto';
import { CreateTagDto } from './dto/tag.dto';
import {
  AssignGroupsDto,
  FriendStatusDtoArgs,
  MyVisibilityContext,
  UpdateProfileDto,
  UserCityCount,
} from './dto/user.dto';
import { AmbassadorInviteGoal } from './entities/ambassador-invite-goal.entity';
import { AmbassadorProgramInteraction } from './entities/ambassador-program-interaction.entity';
import { AmbassadorProgramMember } from './entities/ambassador-program-member.entity';
import {
  ContractEvent,
  ContractEventType,
} from './entities/contract-event.entity';
import { Friend, FriendStatus } from './entities/friend.entity';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from './entities/onetime-invite.entity';
import { Tag } from './entities/tag.entity';
import {
  UserAwayRange,
  UserAwayRangeReason,
} from './entities/user-away-range.entity';
import { UserDevice } from './entities/user-device.entity';
import {
  DEFAULT_TIME_ZONE,
  ReferralSource,
  sqlUserHasActiveContractAt,
  User,
} from './entities/user.entity';
import { type FriendsAcceptedPayload, UserEvents } from './user.events';
import { referralLabel } from './user.utils';

export interface PWResetJwtPayload {
  sub: number;
  type: string;
}

export type ReferrerResolution =
  | { kind: 'user'; user: User }
  | { kind: 'campaign'; campaign: Campaign };

/**
 * Which referral source a user-owned share-url attributes a signup to, keyed by
 * the share-url's kind. `Record<ShareUrlKind, …>` forces every kind to be
 * handled when a new one is added.
 */
const REFERRAL_SOURCE_BY_SHARE_KIND: Record<
  ShareUrlKind,
  | ReferralSource.ActionShareLink
  | ReferralSource.ExternalShareLink
  | ReferralSource.InviteShareLink
> = {
  [ShareUrlKind.Action]: ReferralSource.ActionShareLink,
  [ShareUrlKind.ExternalTarget]: ReferralSource.ExternalShareLink,
  [ShareUrlKind.Invite]: ReferralSource.InviteShareLink,
};

const AMBASSADOR_INVITES_URL = '/invites';
const DAY_MS = 24 * 60 * 60 * 1000;
const AMBASSADOR_GOAL_NOTIFICATION_LOOKBACK_MS = 60 * 60 * 1000;
const AMBASSADOR_PROJECTION_DAYS = [14, 30] as const;
const EMPTY_AMBASSADOR_INVITE_STATS: AmbassadorInviteStats = {
  totalInvitesSent: 0,
  totalAcceptedInvites: 0,
  totalSuccessfulRecruits: 0,
  goalSuccessfulRecruits: 0,
};

function ambassadorGoalHalfwayGroupingKey(goalId: number) {
  return `ambassador-invite-goal:${goalId}:halfway`;
}

function ambassadorGoalEndedGroupingKey(goalId: number) {
  return `ambassador-invite-goal:${goalId}:ended`;
}

/**
 * What a referral code/sid points to, resolved in a fixed precedence order
 * (onetime invite → campaign-owned share link → user-owned share link →
 * bare campaign code → user referral code). Side-effect free: callers apply
 * their own behaviour (signup attribution in AuthService, display in
 * UserService.resolveReferrer). See {@link UserService.resolveReferral}.
 */
export type ReferralResolution =
  | { kind: 'invite'; invite: OnetimeInvite }
  | { kind: 'campaign'; campaign: Campaign }
  | {
      kind: 'user';
      user: User;
      shareUrl: ShareUrl | null;
      referralSource:
        | ReferralSource.ActionShareLink
        | ReferralSource.ExternalShareLink
        | ReferralSource.InviteShareLink
        | ReferralSource.ReferralLink;
    };

/**
 * The "active user" population: every fully signed-up profile. Shared by the
 * user-listing methods and by cohort resolution's NOT-universe
 * (`findActiveUserIds`), which must never diverge from the base-user set
 * (`findActiveUsersWithTags`).
 */
const ACTIVE_USER_WHERE: FindOptionsWhere<User> = {
  isNotSignedUpPartialProfile: false,
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(City)
    private cityRepository: TypedRepository<City>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(OnetimeInvite)
    private readonly onetimeInviteRepository: Repository<OnetimeInvite>,
    @InjectRepository(AmbassadorInviteGoal)
    private readonly ambassadorInviteGoalRepository: Repository<AmbassadorInviteGoal>,
    @InjectRepository(AmbassadorProgramMember)
    private readonly ambassadorProgramMemberRepository: Repository<AmbassadorProgramMember>,
    @InjectRepository(AmbassadorProgramInteraction)
    private readonly ambassadorProgramInteractionRepository: Repository<AmbassadorProgramInteraction>,
    @InjectRepository(UserAwayRange)
    private readonly userAwayRangeRepository: TypedRepository<UserAwayRange>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(LiveActivityRegistration)
    private readonly liveActivityRegistrationRepository: Repository<LiveActivityRegistration>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly campaignService: CampaignService,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly communityService: CommunityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(data: DeepPartial<User>): Promise<User> {
    const user = await this.userRepository.save(
      this.userRepository.create(data),
    );
    await this.eventLogService.sendMessage({
      type: EventType.AccountCreated,
      message: [user.name, referralLabel(user), 'created an account.']
        .filter(Boolean)
        .join(' '),
      userId: user.id,
    });
    return user;
  }

  async update(id: number, data: UpdateProfileDto): Promise<User> {
    const user = await this.findOneOrFail(id);

    if (data.cityId !== undefined) {
      if (data.cityId === null) {
        user.city = null;
      } else {
        const city =
          (data.cityId
            ? await this.cityRepository.findOne({
                where: { id: data.cityId },
              })
            : undefined) ?? undefined;

        if (data.cityId && !city) {
          throw new BadRequestException('City not found');
        }

        user.city = city;
      }
    }

    const { cityId: _cityId, profilePicture, ...updateData } = data;

    if (!updateData.preferredReminderTime) {
      updateData.preferredReminderTime = undefined;
    }

    if (profilePicture?.startsWith('data:')) {
      //TODO: differentiate between file and url
      const key =
        await this.imagesService.processAndUploadProfileImage(profilePicture);

      const updateDataWithPfp = {
        ...updateData,
        profilePicture: key,
      };

      Object.assign(user, updateDataWithPfp);
    } else {
      Object.assign(user, updateData);
      if (profilePicture !== undefined) {
        user.profilePicture = profilePicture;
      }
    }

    await this.userRepository.save(user);

    return this.findOneOrFail(id, {
      contractEvents: true,
      city: true,
    });
  }

  async setPassword(id: number, password: string): Promise<User> {
    const user = await this.findOneOrFail(id);
    user.password = password;
    await user.hashPassword();
    return this.userRepository.save(user);
  }

  findAll(relations?: Relations<User>): Promise<User[]> {
    // Callers pass arbitrary relations, so this must keep the default join
    // strategy: relationLoadStrategy 'query' generates a broken self-join
    // (same alias twice) for the self-referencing `referredBy` relation.
    return this.userRepository.find({
      relations,
    });
  }

  /**
   * Users for the admin list view: `contractEvents` holds only each user's
   * latest event. The list views only read the latest (full history lives on
   * the per-user detail endpoint), and shipping every event for every user
   * bloats the payload and the join.
   */
  async findAllForAdminList(): Promise<User[]> {
    const [users, latestEvents] = await Promise.all([
      this.userRepository.find({ relations: { referredBy: true } }),
      this.contractEventRepository
        .createQueryBuilder('event')
        .addSelect('event."userId"', 'event_user_id')
        .distinctOn(['event."userId"'])
        .orderBy('event."userId"')
        .addOrderBy('event.date', 'DESC')
        .getRawAndEntities(),
    ]);

    const latestEventByUserId = new Map<number, ContractEvent>();
    latestEvents.entities.forEach((event, index) => {
      const userId = Number(latestEvents.raw[index].event_user_id);
      latestEventByUserId.set(userId, event);
    });

    for (const user of users) {
      const latest = latestEventByUserId.get(user.id);
      user.contractEvents = latest ? [latest] : [];
    }
    return users;
  }

  async findAcceptedFriendIdsByUserId(): Promise<Map<number, number[]>> {
    const rows = await this.friendRepository
      .createQueryBuilder('f')
      .select('f.requesterId', 'requesterId')
      .addSelect('f.addresseeId', 'addresseeId')
      .where('f.status = :status', { status: FriendStatus.Accepted })
      .getRawMany<{ requesterId: number; addresseeId: number }>();

    const byUser = new Map<number, number[]>();
    const addFriend = (userId: number, friendId: number) => {
      const list = byUser.get(userId);
      if (list) {
        list.push(friendId);
        return;
      }
      byUser.set(userId, [friendId]);
    };
    for (const row of rows) {
      addFriend(row.requesterId, row.addresseeId);
      addFriend(row.addresseeId, row.requesterId);
    }
    return byUser;
  }

  async findAllMembersPublic(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { shareInfoPublicly: true },
      relations: {
        contractEvents: true,
      },
    });
    return users.filter((user) => user.hasActiveContract);
  }

  findOne(id: number, relations?: Relations<User>): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations,
    });
  }

  async findOneByEmail(
    email: string,
    relations?: Relations<User>,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: ILike(email) },
      relations,
    });
  }

  async findOneByReferralCode(
    referralCode: string,
    relations?: Relations<User>,
  ): Promise<User | null> {
    return this.userRepository.findOne({ where: { referralCode }, relations });
  }

  async findUserByShareSid(sid: string): Promise<User | null> {
    return this.shareUrlsService.findUserBySid(sid);
  }

  /**
   * Resolve a referral code/sid to whatever it points to, in a fixed
   * precedence order, with no side effects. The single source of truth for
   * referral precedence — both signup attribution (AuthService) and the
   * signup-page inviter display ({@link resolveReferrer}) build on it, so the
   * two can't drift. `opts.inviteRelations` lets a caller load the matched
   * invite with extra relations (AuthService needs the inviting user's
   * communities and the invited user to detect a spent invite).
   */
  async resolveReferral(
    code: string,
    opts?: { inviteRelations?: Relations<OnetimeInvite> },
  ): Promise<ReferralResolution | null> {
    const invite = await this.findInviteByCode(code, opts?.inviteRelations);
    if (invite) {
      return { kind: 'invite', invite };
    }
    const shareUrl = await this.shareUrlsService.findByReferralSid(code);
    if (shareUrl?.campaign) {
      return { kind: 'campaign', campaign: shareUrl.campaign };
    }
    if (shareUrl?.user) {
      return {
        kind: 'user',
        user: shareUrl.user,
        shareUrl,
        referralSource: REFERRAL_SOURCE_BY_SHARE_KIND[shareUrl.kind],
      };
    }
    const campaign = await this.campaignService.findByCode(code);
    if (campaign) {
      return { kind: 'campaign', campaign };
    }
    const user = await this.findOneByReferralCode(code);
    if (user) {
      return {
        kind: 'user',
        user,
        shareUrl: null,
        referralSource: ReferralSource.ReferralLink,
      };
    }
    return null;
  }

  /**
   * Resolve a referral code/sid to whoever (or whatever) referred the signup:
   * a referring user, or a userless campaign — for display on the signup page.
   */
  async resolveReferrer(code: string): Promise<ReferrerResolution | null> {
    const resolution = await this.resolveReferral(code);
    if (!resolution) return null;
    switch (resolution.kind) {
      case 'invite':
        return resolution.invite.invitingUser
          ? { kind: 'user', user: resolution.invite.invitingUser }
          : null;
      case 'campaign':
        return { kind: 'campaign', campaign: resolution.campaign };
      case 'user':
        return { kind: 'user', user: resolution.user };
      default:
        throw new Error(
          `unknown referral resolution: ${resolution satisfies never}`,
        );
    }
  }

  /**
   * Snapshot columns for the group placement an invite link carries.
   *
   * A `community` target whose group is already gone keeps its kind but drops
   * the id, matching the state the `ON DELETE SET NULL` FK leaves behind when
   * the group is deleted after signup — otherwise the stale id, which nothing
   * prunes from `share_url.data`, fails that FK and the signup 500s.
   */
  async inviteAssignmentSnapshot(
    assignment: StoredInviteAssignment | null,
  ): Promise<InviteAssignmentColumns> {
    const columns = inviteAssignmentColumns(assignment);
    const { inviteAssignmentCommunityId: communityId } = columns;
    if (communityId === null) return columns;
    const communityExists = await this.communityRepository.exists({
      where: { id: communityId },
    });
    return communityExists
      ? columns
      : { ...columns, inviteAssignmentCommunityId: null };
  }

  /**
   * Create a user carrying the group placement their invite link named.
   *
   * The snapshot checks the group and writes it in two steps, so a group
   * deleted in between still fails the FK. Confirm it is actually gone before
   * retrying without it — any other foreign key is a real error, not this race.
   */
  async createWithInviteAssignment(
    data: DeepPartial<User>,
    assignment: StoredInviteAssignment | null,
  ): Promise<User> {
    const columns = await this.inviteAssignmentSnapshot(assignment);
    const { inviteAssignmentCommunityId: communityId } = columns;
    try {
      return await this.create({ ...data, ...columns });
    } catch (error) {
      if (communityId === null || !isForeignKeyViolation(error)) throw error;
      const communityExists = await this.communityRepository.exists({
        where: { id: communityId },
      });
      if (communityExists) throw error;
      return this.create({
        ...data,
        ...columns,
        inviteAssignmentCommunityId: null,
      });
    }
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async setAdmin(id: number, admin: boolean): Promise<void> {
    await this.userRepository.update(id, { admin });
  }

  async updateRolesAdmin(
    id: number,
    roles: { ambassador?: boolean },
  ): Promise<User> {
    await this.userRepository.update(id, roles);
    return this.findOneOrFail(id, {
      contractEvents: true,
      referredBy: true,
      referredByCampaign: true,
      referredByInvite: { invitingUser: true },
      referredByShareUrl: true,
      city: true,
      tags: true,
    });
  }

  async count(): Promise<number> {
    return this.userRepository.count({
      where: { isNotSignedUpPartialProfile: false },
    });
  }

  async sendWelcomeEmail(userId: number) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'staging') {
      return;
    }

    const user = await this.findOneOrFail(userId);
    const token = await this.getVerifyEmailToken(userId);
    const mail = await this.mailService.sendWelcomeEmail(
      user.email,
      user.name,
      token,
    );
    await this.userRepository.update(userId, { welcomeMail: mail });
  }

  async verifyEmail(token: string) {
    const payload = this.jwtService.verify(token, {
      secret: process.env.JWT_SECRET,
    });
    const user = await this.findOneOrFail(payload.sub);
    user.emailVerified = true;
    await this.userRepository.save(user);
  }

  async getVerifyEmailToken(userId: number) {
    const payload = { sub: userId, type: 'verify-email' };
    return this.jwtService.sign(payload, {
      expiresIn: `7d`,
      secret: process.env.JWT_SECRET,
    });
  }

  async isAdmin(id: number): Promise<boolean> {
    const user = await this.findOneOrFail(id);
    return user.admin;
  }

  async isCommunityLeader(email: string): Promise<boolean> {
    const user = await this.findOneByEmail(email);
    return user?.isCommunityLeader ?? false;
  }

  /* ───────────────────────────────
   *  Friend-request helpers
   * ─────────────────────────────── */

  async createFriendRequest(
    requesterId: number,
    addresseeId: number,
  ): Promise<Friend> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot friend yourself');
    }

    const requester = await this.findOneOrFail(requesterId);
    const addressee = await this.findOneOrFail(addresseeId);

    let rel = await this.friendRepository.findOne({
      where: { requester: { id: requesterId }, addressee: { id: addresseeId } },
    });

    if (rel) {
      rel.status = FriendStatus.Pending; // reset to pending / resend
    } else {
      const notif = this.notifsService.createNotif({
        user: addressee,
        category: NotificationCategory.FriendRequest,
        message: `${requester.name} wants to be friends`,
        webAppLocation: profileUrl(requesterId),
        associatedUsers: [requester],
      } satisfies CreateNotifParams);

      rel = this.friendRepository.create({
        requester,
        addressee,
        status: FriendStatus.Pending,
        sentNotif: notif,
      });
    }
    return this.friendRepository.save(rel);
  }

  /** Accept / decline a pending request (requester → addressee). */
  async updateFriendRequestStatus(
    requesterId: number,
    addresseeId: number,
    status: FriendStatus.Accepted | FriendStatus.Declined,
  ): Promise<Friend> {
    const rel = await this.friendRepository.findOne({
      where: {
        requester: { id: requesterId },
        addressee: { id: addresseeId },
        status: FriendStatus.Pending,
      },
      relations: { requester: true, addressee: true, sentNotif: true },
    });

    if (!rel || !rel.requester || !rel.addressee) {
      throw new NotFoundException('No pending request found');
    }

    rel.status = status;
    if (status === FriendStatus.Accepted) {
      rel.acceptedAt = new Date();
      rel.acceptedNotif = this.notifsService.createNotif({
        user: rel.requester,
        category: NotificationCategory.FriendRequestAccepted,
        message: `${rel.addressee.name} accepted your friend request`,
        webAppLocation: profileUrl(rel.addressee.id),
        associatedUsers: [rel.addressee],
      });
    }
    if (rel.sentNotif) {
      try {
        await this.notifsService.setRead(rel.sentNotif.id, addresseeId);
      } catch (error) {
        this.logger.error(
          'Error setting read status for friend request:',
          error,
        );
      }
    }

    const saved = await this.friendRepository.save({
      ...rel,
      sentNotif: undefined,
    });

    if (status === FriendStatus.Accepted) {
      this.emitFriendsAccepted(requesterId, addresseeId);
    }

    return saved;
  }

  /**
   * Decoupled from messaging via an event. Messaging listens and auto-accepts
   * a pending direct-message invite between the two so a new friend never shows
   * as a message request.
   */
  private emitFriendsAccepted(requesterId: number, addresseeId: number): void {
    const payload: FriendsAcceptedPayload = {
      userIdA: requesterId,
      userIdB: addresseeId,
    };
    this.eventEmitter.emit(UserEvents.FriendsAccepted, payload);
  }

  /** Cancel a request OR un-friend an accepted friend in either direction. */
  async removeFriend(userId: number, targetUserId: number): Promise<void> {
    await this.friendRepository
      .createQueryBuilder()
      .delete()
      .where(
        `(requesterId = :u AND addresseeId = :t) OR (requesterId = :t AND addresseeId = :u)`,
        { u: userId, t: targetUserId },
      )
      .execute();
  }

  async findFriends(userId: number): Promise<User[]> {
    const rels = await this.friendRepository.find({
      where: [
        { requester: { id: userId }, status: FriendStatus.Accepted },
        { addressee: { id: userId }, status: FriendStatus.Accepted },
      ],
      relations: {
        requester: { contractEvents: true },
        addressee: { contractEvents: true },
      },
    });

    return rels.map((r) =>
      r.requester!.id === userId ? r.addressee! : r.requester!,
    );
  }

  private async findFriendUsersWithProfilePictures(
    inviterId: number,
  ): Promise<User[]> {
    const contractAt = new Date();
    const rels = await this.friendRepository
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.requester', 'req')
      .innerJoinAndSelect('f.addressee', 'addr')
      .where('f.status = :status', { status: FriendStatus.Accepted })
      .andWhere('(f.requesterId = :inviterId OR f.addresseeId = :inviterId)', {
        inviterId,
      })
      .andWhere(
        new Brackets((sqb) => {
          sqb
            .where(
              `f.requesterId = :inviterId AND addr.profilePicture IS NOT NULL AND TRIM(addr.profilePicture) <> '' AND (${sqlUserHasActiveContractAt('addr.id')})`,
            )
            .orWhere(
              `f.addresseeId = :inviterId AND req.profilePicture IS NOT NULL AND TRIM(req.profilePicture) <> '' AND (${sqlUserHasActiveContractAt('req.id')})`,
            );
        }),
      )
      .setParameter('contractAt', contractAt)
      .getMany();
    const others = rels.map((r) =>
      r.requester!.id === inviterId ? r.addressee! : r.requester!,
    );
    return others.sort((a, b) => a.id - b.id);
  }

  private async pickRandomUsersWithProfilePictures(
    count: number,
    excludeIds: number[],
    signedContract: boolean = true,
  ): Promise<User[]> {
    if (count <= 0) {
      return [];
    }
    const contractAt = new Date();
    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.profilePicture IS NOT NULL')
      .andWhere("TRIM(u.profilePicture) != ''")
      .andWhere('u.isNotSignedUpPartialProfile = :partial', { partial: false });
    if (excludeIds.length > 0) {
      qb.andWhere('u.id NOT IN (:...ids)', { ids: excludeIds });
    }
    if (signedContract) {
      qb.andWhere(sqlUserHasActiveContractAt('u.id'), { contractAt });
    }
    return qb.orderBy('RANDOM()').take(count).getMany();
  }

  /**
   * Up to 5 member profiles with avatars for the signup page.
   * Prefer accepted friends of the referrer (from invite or referral code), then random members with photos.
   */
  async getSignupSocialProof(referralCode?: string): Promise<User[]> {
    const minProfiles = 5;
    const users: User[] = [];
    const usedIds: number[] = [];

    const trimmed = referralCode?.trim();
    let inviterId: number | null = null;
    if (trimmed) {
      const invite = await this.findInviteByCode(trimmed);
      if (invite?.invitingUser) {
        inviterId = invite.invitingUser.id;
      } else {
        const refUser = await this.findOneByReferralCode(trimmed);
        inviterId = refUser?.id ?? null;
      }
    }

    if (inviterId != null) {
      const friends = await this.findFriendUsersWithProfilePictures(inviterId);
      for (const u of friends) {
        if (users.length >= minProfiles) {
          break;
        }
        if (!usedIds.includes(u.id)) {
          usedIds.push(u.id);
          users.push(u);
        }
      }
    }

    const need = minProfiles - users.length;
    if (need > 0) {
      const fillers = await this.pickRandomUsersWithProfilePictures(
        need,
        usedIds,
      );
      users.push(...fillers);
    }

    return users;
  }

  async findMessageableUsers(userId: number): Promise<User[]> {
    const user = await this.findOneOrFail(userId, {
      communities: true,
      leaderOf: true,
    });

    if (user.staff) {
      return this.userRepository.find({
        where: { id: Not(userId) },
      });
    }

    const memberCommunityIds = user.communities.map((c) => c.id);
    const leaderCommunityIds = user.leaderOf.map((c) => c.id);

    const [rels, staff, communityUsers] = await Promise.all([
      this.friendRepository.find({
        where: [
          { requester: { id: userId }, status: FriendStatus.Accepted },
          { addressee: { id: userId }, status: FriendStatus.Accepted },
        ],
        relations: { requester: true, addressee: true },
      }),

      this.userRepository.find({ where: { staff: true } }),

      this.userRepository
        .createQueryBuilder('u')
        .distinct(true)
        .leftJoin('u.leaderOf', 'leadCommunity')
        .leftJoin('u.communities', 'memberCommunity')
        .where(
          `
            (
              leadCommunity.id IN (:...memberCommunityIds)
              OR memberCommunity.id IN (:...leaderCommunityIds)
            )
          `,
          {
            memberCommunityIds: memberCommunityIds.length
              ? memberCommunityIds
              : [-1],
            leaderCommunityIds: leaderCommunityIds.length
              ? leaderCommunityIds
              : [-1],
          },
        )
        .getMany(),
    ]);

    const friends = rels.map((r) =>
      r.requester!.id === userId ? r.addressee! : r.requester!,
    );

    const byId = new Map<number, User>();
    for (const u of [...staff, ...communityUsers, ...friends]) {
      if (u?.id && u.id !== userId) byId.set(u.id, u);
    }

    return [...byId.values()];
  }

  async notifyReferrerOfNewMember(referrer: User, newMember: User) {
    await this.notifsService.sendNotif({
      user: referrer,
      category: NotificationCategory.NewMemberReferred,
      message: `${newMember.name} joined the Alliance`,
      webAppLocation: profileUrl(newMember.id),
      associatedUsers: [newMember],
    });
  }

  /**
   * Make two users friends without sending any notifications. Used sed when a user signs up with a referral code.
   */
  async makeFriendsAutomated(
    requesterId: number,
    addresseeId: number,
  ): Promise<void> {
    const requester = await this.findOneOrFail(requesterId);
    const addressee = await this.findOneOrFail(addresseeId);

    const rel = this.friendRepository.create({
      requester,
      addressee,
      status: FriendStatus.Accepted,
    });

    await this.friendRepository.save(rel);
    this.emitFriendsAccepted(requesterId, addresseeId);
  }

  async findPendingRequests(
    userId: number,
    direction: 'sent' | 'received',
  ): Promise<User[]> {
    if (direction === 'sent') {
      return (
        await this.friendRepository.find({
          where: {
            requester: { id: userId },
            status: FriendStatus.Pending,
          },
          relations: { addressee: true },
        })
      ).map((r) => r.addressee!);
    }
    return (
      await this.friendRepository.find({
        where: {
          addressee: { id: userId },
          status: FriendStatus.Pending,
        },
        relations: { requester: true },
      })
    ).map((r) => r.requester!);
  }

  async getRelationshipStatus(
    userId: number,
    targetUserId: number,
  ): Promise<FriendStatusDtoArgs> {
    const rel =
      (await this.friendRepository.findOne({
        where: { requester: { id: userId }, addressee: { id: targetUserId } },
        relations: { requester: true, addressee: true },
      })) ||
      (await this.friendRepository.findOne({
        where: { requester: { id: targetUserId }, addressee: { id: userId } },
        relations: { requester: true, addressee: true },
      }));

    const status = rel ? rel.status : FriendStatus.None;
    return {
      status,
      didReceiveRequest:
        status === FriendStatus.Pending && rel?.addressee!.id === userId,
    };
  }

  async findOneOrFail(id: number, relations?: Relations<User>): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByIds(ids: number[], relations?: Relations<User>): Promise<User[]> {
    return this.userRepository.find({
      where: { id: In(ids) },
      relations,
    });
  }

  async countReferred(id: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { referredUsers: true },
    });
    return user?.referredUsers!.length ?? 0;
  }

  async getUserLocation(userId: number): Promise<City | undefined> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { city: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user.city ?? undefined;
  }

  /**
   * Whether the user has a location set — either a structured city or a custom
   * city string. Mirrors the location shown by the `userLocation` display block
   * and drives `userHasCity` visibility conditions.
   */
  async userHasCitySet(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { city: true },
    });
    if (!user) {
      return false;
    }
    return user.city != null || (user.customCityString?.trim().length ?? 0) > 0;
  }

  /**
   * Date of the user's earliest `signed` contract event, or null when they
   * have never signed. Drives `firstContractSigned` visibility conditions.
   */
  async getFirstContractSignedAt(userId: number): Promise<Date | null> {
    const firstSigned = await this.contractEventRepository.findOne({
      where: { user: { id: userId }, type: ContractEventType.SIGNED },
      order: { date: 'ASC', id: 'ASC' },
    });
    return firstSigned?.date ?? null;
  }

  /**
   * How many actions the user has completed. `USER_COMPLETED` activities are
   * deduplicated per action (see `ALLOW_DUPLICATE`), so this is a count of
   * distinct actions.
   */
  async getCompletedActionCount(userId: number): Promise<number> {
    return this.actionActivityRepository.count({
      where: { userId, type: ActionActivityType.USER_COMPLETED },
    });
  }

  /**
   * User-account-derived values for form visibility conditions. Keep in sync
   * with the condition kinds evaluated in `common/src/forms/visibility.ts`.
   *
   * Each value costs a query, so `kinds` narrows the fetch to the condition
   * kinds a schema actually uses; anything omitted comes back as the same
   * default an unauthenticated viewer would get. Pass nothing to fetch all of
   * it (the `/user/myvisibilitycontext` endpoint doesn't know the schema).
   */
  async getVisibilityContext(
    userId: number,
    kinds?: ReadonlySet<AccountDerivedConditionKind>,
  ): Promise<MyVisibilityContext> {
    const fetchers: Record<
      AccountDerivedConditionKind,
      () => Promise<Partial<MyVisibilityContext>>
    > = {
      userHasCity: async () => ({
        userHasCity: await this.userHasCitySet(userId),
      }),
      firstContractSigned: async () => ({
        firstContractSignedAt: await this.getFirstContractSignedAt(userId),
      }),
      completedActionCount: async () => ({
        completedActionCount: await this.getCompletedActionCount(userId),
      }),
    };

    const requested = kinds
      ? [...kinds].map((kind) => fetchers[kind])
      : Object.values(fetchers);
    const slices = await Promise.all(requested.map((fetch) => fetch()));

    // Unfetched kinds keep the default an unauthenticated viewer would get.
    // Typing the seed as MyVisibilityContext makes a new *field* an error too.
    return slices.reduce<MyVisibilityContext>(
      (context, slice) => ({ ...context, ...slice }),
      {
        userHasCity: false,
        firstContractSignedAt: null,
        completedActionCount: 0,
      },
    );
  }

  async getUserCityCounts(): Promise<UserCityCount[]> {
    // return (
    //   await this.userRepository.find({
    //     relations: { contractEvents: true },
    //   })
    // ).filter((user) => user.hasActiveContract)

    const allUsers = await this.userRepository.find({
      relations: { contractEvents: true, city: true },
    });
    const users = allUsers.filter((user) => user.hasActiveContract);

    const cityIds = users
      .map((user) => user.city?.id)
      .filter((id) => id != null);
    const nullCityCount = users.length - cityIds.length;
    const cityCounts = countBy(cityIds, (id) => id);

    const cities = await this.cityRepository.find({
      where: { id: In(Object.keys(cityCounts)) },
    });
    const cityById = new Map(cities.map((c) => [c.id, c]));

    const cityCountsArray = Object.entries(cityCounts).map(
      ([cityId, count]) => {
        const city = cityById.get(parseInt(cityId, 10));
        return {
          cityId: city?.id ?? null,
          cityName: city?.name ?? null,
          countryCode: city?.countryCode ?? null,
          count,
          latitude: city?.latitude ?? null,
          longitude: city?.longitude ?? null,
        } satisfies UserCityCount;
      },
    );

    return [
      ...cityCountsArray,
      {
        cityId: null,
        cityName: 'Unknown',
        countryCode: null,
        count: nullCityCount,
        latitude: null,
        longitude: null,
      },
    ];
  }

  async findOneByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { stripeCustomerId: stripeCustomerId },
    });
  }

  async generatePasswordResetToken(userId: number) {
    const payload: PWResetJwtPayload = { sub: userId, type: 'password-reset' };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: `1d`,
    });
  }

  async setStripeCustomerId(userId: number, stripeCustomerId: string) {
    await this.userRepository.update(userId, { stripeCustomerId });
  }

  async setOptInMms(userId: number, mmsId: number) {
    await this.userRepository.update(userId, { optInMms: { id: mmsId } });
  }

  async findAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: ACTIVE_USER_WHERE,
    });
  }

  async findActiveUsersWithTags(): Promise<User[]> {
    return this.userRepository.find({
      where: ACTIVE_USER_WHERE,
      relations: { tags: true, awayRanges: true, contractEvents: true },
      relationLoadStrategy: 'query',
    });
  }

  /**
   * Same population as {@link findActiveUsersWithTags}, but hydrating only
   * what the assignment predicates (`computeIsAssignedAndPresent`,
   * `computeIsAwayDuringWindow`) read: `id`, `contractEvents`, and
   * `awayRanges`. Every other scalar column is left unselected — hydrating
   * ~50 columns for every user is the dominant cost of the full load, and
   * it's pure event-loop CPU. Only use where the consumers are known.
   */
  async findActiveUsersForRoster(): Promise<User[]> {
    return this.userRepository.find({
      select: { id: true },
      where: ACTIVE_USER_WHERE,
      relations: { awayRanges: true, contractEvents: true },
      relationLoadStrategy: 'query',
    });
  }

  /**
   * Ids of the same population as {@link findActiveUsersWithTags}, without
   * hydrating entities — for callers that only need membership checks.
   */
  async findActiveUserIds(): Promise<number[]> {
    const users = await this.userRepository.find({
      select: { id: true },
      where: ACTIVE_USER_WHERE,
    });
    return users.map((user) => user.id);
  }

  async createPartialProfile(
    body: Pick<PaymentUserDataToken, 'email' | 'firstName' | 'lastName'>,
  ): Promise<User> {
    return this.create({
      email: body.email,
      name: body.firstName + ' ' + body.lastName,
      password: Math.random().toString(36).substring(2, 15), //TODO: they have to reset this but maybe do something better
      isNotSignedUpPartialProfile: true,
      referralSource: ReferralSource.None,
    });
  }

  async findByUsername(query: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: {
        name: ILike(`%${query}%`),
        anonymous: false,
        isNotSignedUpPartialProfile: false,
      },
    });
    return users;
  }

  private validateAwayRange(
    startDate: Date,
    endDate: Date,
    reason: UserAwayRangeReason,
    note: string | null,
    options?: { validateStartDate?: boolean },
  ): void {
    const { validateStartDate = true } = options ?? {};
    const now = new Date();

    if (startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException('End date must be after start date.');
    }

    // buffer to let ranges start in the current day
    if (
      validateStartDate &&
      startDate.getTime() + 1000 * 60 * 60 * 36 < now.getTime()
    ) {
      throw new BadRequestException('Start date must be in the future.');
    }

    if (reason === UserAwayRangeReason.OTHER && !note) {
      throw new BadRequestException(
        'Please provide a note for your away period.',
      );
    }
  }

  async createAwayRange(
    userId: number,
    data: CreateAwayRangeDto,
  ): Promise<UserAwayRange> {
    const reason = data.reason;
    const note = data.note ?? null;
    const startDay = Temporal.PlainDate.from(data.startDay);
    const endDay = Temporal.PlainDate.from(data.endDay);
    const user = await this.findOneOrFail(userId);
    const tz = user.timeZone ?? DEFAULT_TIME_ZONE;

    const startDate = new Date(
      startDay
        .toZonedDateTime({
          timeZone: tz,
          plainTime: Temporal.PlainTime.from({ hour: 0 }),
        })
        .toInstant().epochMilliseconds,
    );
    const endDate = new Date(
      endDay
        .toZonedDateTime({
          timeZone: tz,
          plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59 }),
        })
        .toInstant().epochMilliseconds,
    );

    this.validateAwayRange(startDate, endDate, reason, note);

    const awayRange = this.userAwayRangeRepository.create({
      userId,
      startDate,
      endDate,
      reason,
      note,
    });

    return this.userAwayRangeRepository.save(awayRange);
  }

  async getAwayRanges(userId: number): Promise<UserAwayRange[]> {
    return this.userAwayRangeRepository.find({
      where: { userId },
      order: { startDate: 'DESC' },
    });
  }

  async deleteAwayRange(userId: number, awayRangeId: number): Promise<void> {
    const awayRange = await this.userAwayRangeRepository.findOne({
      where: { id: awayRangeId, userId },
    });

    if (!awayRange) {
      throw new NotFoundException('Away range not found.');
    }

    await this.userAwayRangeRepository.remove(awayRange);
  }

  async updateAwayRange(
    userId: number,
    awayRangeId: number,
    data: UpdateAwayRangeDto,
  ): Promise<UserAwayRange> {
    const awayRange = await this.userAwayRangeRepository.findOne({
      where: { id: awayRangeId, userId },
    });

    if (!awayRange) {
      throw new NotFoundException('Away range not found.');
    }

    const user = await this.findOneOrFail(userId);
    const tz = user.timeZone ?? DEFAULT_TIME_ZONE;

    if (data.startDay) {
      const startDay = Temporal.PlainDate.from(data.startDay);
      awayRange.startDate = new Date(
        startDay
          .toZonedDateTime({
            timeZone: tz,
            plainTime: Temporal.PlainTime.from({ hour: 0 }),
          })
          .toInstant().epochMilliseconds,
      );
    }

    if (data.endDay) {
      const endDay = Temporal.PlainDate.from(data.endDay);
      awayRange.endDate = new Date(
        endDay
          .toZonedDateTime({
            timeZone: tz,
            plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59 }),
          })
          .toInstant().epochMilliseconds,
      );
    }

    if (data.reason !== undefined) {
      awayRange.reason = data.reason;
    }

    if (data.note !== undefined) {
      awayRange.note = data.note;
    }

    this.validateAwayRange(
      awayRange.startDate,
      awayRange.endDate,
      awayRange.reason,
      awayRange.note,
      { validateStartDate: false },
    );

    return this.userAwayRangeRepository.save(awayRange);
  }

  async isUserIdAway(
    userId: number,
    checkDate: Date = new Date(),
  ): Promise<boolean> {
    const awayRanges = await this.userAwayRangeRepository.find({
      where: { userId },
    });

    return awayRanges.some(
      (range) => checkDate >= range.startDate && checkDate <= range.endDate,
    );
  }

  async createTag(body: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create(body);
    return this.tagRepository.save(tag);
  }

  async findAllTags(): Promise<Tag[]> {
    return this.tagRepository.find({ relations: { users: true } });
  }

  async findAllTagSummaries(): Promise<Tag[]> {
    return this.tagRepository.find();
  }

  async findTagByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { name } });
  }

  async findAllMembersTag(): Promise<Tag | null> {
    return this.findTagByName(ALL_MEMBERS_TAG_NAME);
  }

  async findTagOrFail(id: string): Promise<Tag> {
    return this.tagRepository.findOneOrFail({
      where: { id },
      relations: { users: { contractEvents: true } },
    });
  }

  async addUserToTag(tagId: string, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: { users: true },
    });
    tag.users.push(await this.findOneOrFail(userId));
    return this.tagRepository.save(tag);
  }

  async removeUserFromTag(tagId: string, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: { users: true },
    });
    tag.users = tag.users.filter((user) => user.id !== userId);
    return this.tagRepository.save(tag);
  }

  async updateTag(tagId: string, body: CreateTagDto): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
    });
    Object.assign(tag, body);
    return this.tagRepository.save(tag);
  }

  async deleteTag(tagId: string): Promise<void> {
    await this.tagRepository.delete(tagId);
  }

  async getAmbassadorProgramDashboard(): Promise<AmbassadorProgramDashboard> {
    const members = await this.ambassadorProgramMemberRepository.find({
      relations: {
        interactions: true,
        user: { contractEvents: true, tags: true },
      },
      order: {
        activeParticipant: 'DESC',
        invited: 'DESC',
        updatedAt: 'DESC',
        id: 'ASC',
      },
    });
    const activeUserIds = members
      .filter((member) => member.activeParticipant)
      .map((member) => member.userId);
    const [projection, totalsByUserId, goals] = await Promise.all([
      this.getAmbassadorInviteProjection(activeUserIds),
      this.getAmbassadorInviteStatsByUserIds(activeUserIds),
      activeUserIds.length
        ? this.ambassadorInviteGoalRepository.find({
            where: { ambassador: { id: In(activeUserIds) } },
            relations: { ambassador: true },
            order: { startAt: 'ASC', id: 'ASC' },
          })
        : Promise.resolve([]),
    ]);
    const statsByGoalId = await this.getAmbassadorInviteStatsByGoalIds(goals);
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
    goals: AmbassadorInviteGoal[];
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
  ): Promise<AmbassadorProgramMember> {
    const member = await this.ambassadorProgramMemberRepository.findOne({
      where: { user: { id: userId } },
      relations: {
        interactions: true,
        user: { contractEvents: true, tags: true },
      },
      order: { interactions: { interactionDate: 'DESC', id: 'DESC' } },
    });

    if (!member) {
      throw new NotFoundException('Ambassador program member not found');
    }

    return member;
  }

  async upsertAmbassadorProgramMember(
    body: UpsertAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMember> {
    const userP = this.findOneOrFail(body.userId, {
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

    await this.ambassadorProgramMemberRepository.save(member);
    return this.findAmbassadorProgramMemberOrFail(body.userId);
  }

  async updateAmbassadorProgramMember(
    userId: number,
    body: UpdateAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMember> {
    const member = await this.findAmbassadorProgramMemberOrFail(userId);

    if (body.invited !== undefined) {
      member.invited = body.invited;
    }
    if (body.activeParticipant !== undefined) {
      member.activeParticipant = body.activeParticipant;
    }

    await this.ambassadorProgramMemberRepository.save(member);
    return this.findAmbassadorProgramMemberOrFail(userId);
  }

  async createAmbassadorProgramInteraction(
    body: CreateAmbassadorProgramInteractionDto,
    createdByUserId: number,
  ): Promise<AmbassadorProgramMember> {
    const [member, createdBy] = await Promise.all([
      this.upsertAmbassadorProgramMember({
        userId: body.userId,
      }),
      this.findOneOrFail(createdByUserId),
    ]);
    const text = body.text.trim();

    if (!text) {
      throw new BadRequestException('Interaction text is required');
    }

    await this.ambassadorProgramInteractionRepository.save(
      this.ambassadorProgramInteractionRepository.create({
        programMember: member,
        createdBy,
        text,
        interactionDate: body.interactionDate,
      }),
    );

    return this.findAmbassadorProgramMemberOrFail(body.userId);
  }

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

    const userP = this.findOne(userId, { leaderOf: true });
    const communityP =
      communityId !== undefined
        ? this.communityRepository.findOne({
            where: { id: communityId },
          })
        : undefined;

    const user = await userP;
    if (user === null) {
      throw new BadRequestException('User not found');
    }
    const isAdmin = user.admin;
    if (!isAdmin && communityId && !user.leaderOfIdSet.has(communityId)) {
      throw new BadRequestException(
        `User is not a leader of community ${communityId}`,
      );
    }

    // Normal users cannot create invites from other users
    const invitingUserId =
      (isAdmin ? providedInvitingUserId : undefined) ?? userId;
    const invitingUser =
      invitingUserId === userId
        ? user
        : await this.findOneOrFail(invitingUserId);

    const community = await communityP;
    if (community === null) {
      throw new BadRequestException('Community not found');
    }
    const invite = this.onetimeInviteRepository.create({
      ...rest,
      code,
      invitingUser,
      community,
      status: OnetimeInviteStatus.LINK_UNUSED,
    });
    return await this.onetimeInviteRepository.save(invite);
  }

  async createAmbassadorInviteGoal(
    body: CreateAmbassadorInviteGoalDto,
    userId: number,
  ): Promise<AmbassadorInviteGoal> {
    const user = await this.findOneOrFail(userId);
    const startAt = new Date(body.startAt);
    const dueAt = new Date(body.dueAt);

    if (!user.ambassador) {
      throw new ForbiddenException('Only ambassadors can set invite goals');
    }
    this.validateAmbassadorInviteGoalDates(startAt, dueAt);
    await this.assertAmbassadorInviteGoalDoesNotOverlap({
      userId,
      startAt,
      dueAt,
    });

    return this.ambassadorInviteGoalRepository.save(
      this.ambassadorInviteGoalRepository.create({
        ambassador: user,
        targetSuccessfulRecruits: body.targetSuccessfulRecruits,
        startAt,
        dueAt,
      }),
    );
  }

  async updateAmbassadorInviteGoal(
    goalId: number,
    body: UpdateAmbassadorInviteGoalDto,
    userId: number,
  ): Promise<AmbassadorInviteGoal> {
    const userP = this.findOneOrFail(userId);
    const goalP = this.ambassadorInviteGoalRepository.findOneOrFail({
      where: { id: goalId, ambassador: { id: userId } },
      relations: { ambassador: true },
    });

    const user = await userP;
    if (!user.ambassador) {
      throw new ForbiddenException('Only ambassadors can edit invite goals');
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

    return this.ambassadorInviteGoalRepository.save(goal);
  }

  async deleteAmbassadorInviteGoal(
    goalId: number,
    userId: number,
  ): Promise<void> {
    const user = await this.findOneOrFail(userId);
    if (!user.ambassador) {
      throw new ForbiddenException('Only ambassadors can delete invite goals');
    }

    const goal = await this.ambassadorInviteGoalRepository.findOneOrFail({
      where: { id: goalId, ambassador: { id: userId } },
    });
    await this.ambassadorInviteGoalRepository.delete(goal.id);
  }

  async getAmbassadorInviteDashboard(
    userId: number,
  ): Promise<AmbassadorInviteDashboard> {
    const userP = this.findOneOrFail(userId);
    const goalsP = this.ambassadorInviteGoalRepository.find({
      where: { ambassador: { id: userId } },
      relations: { ambassador: true },
      order: { startAt: 'ASC', id: 'ASC' },
    });

    const user = await userP;
    if (!user.ambassador) {
      throw new ForbiddenException('Only ambassadors can view invite stats');
    }
    const goals = await goalsP;
    const [stats, statsByGoalId, projection] = await Promise.all([
      this.getAmbassadorInviteStats(userId),
      this.getAmbassadorInviteStatsByGoalIds(goals),
      this.getAmbassadorInviteProjection([userId]),
    ]);
    const goalsWithStats = goals.map((goal) => ({
      goal,
      stats: statsByGoalId.get(goal.id) ?? EMPTY_AMBASSADOR_INVITE_STATS,
    }));

    return { goals: goalsWithStats, projection, stats };
  }

  private async getAmbassadorInviteProjection(
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
          order: { dueAt: 'ASC', id: 'ASC' },
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
        const date = new Date(now.getTime() + days * DAY_MS);
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
          WHERE goal."startAt" <= $1::timestamptz
            AND goal."dueAt" > $1::timestamptz
            AND (goal."startAt" + ((goal."dueAt" - goal."startAt") / 2)) <= $1::timestamptz
            AND NOT EXISTS (
              SELECT 1
              FROM "notification" notif
              WHERE notif."userId" = goal."ambassadorId"
                AND notif."groupingKey" = CONCAT(
                  'ambassador-invite-goal:', goal."id", ':halfway'
                )
            )
        `,
        [now],
      ) as Promise<{ id: number }[]>,
      this.ambassadorInviteGoalRepository.query(
        `
          SELECT goal."id"
          FROM "ambassador_invite_goal" goal
          WHERE goal."dueAt" <= $1::timestamptz
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
    goal: AmbassadorInviteGoal,
    sendTime: Date,
  ): Promise<void> {
    const groupingKey = ambassadorGoalHalfwayGroupingKey(goal.id);
    const alreadySent = await this.notifsService.hasNotifWithGroupingKey(
      goal.ambassador.id,
      groupingKey,
    );
    if (alreadySent) {
      return;
    }

    const stats = await this.getAmbassadorInviteStats(goal.ambassador.id, goal);
    await this.notifsService.sendNotif({
      user: goal.ambassador,
      category: NotificationCategory.NewMemberReferred,
      message: getAmbassadorGoalHalfwayNotificationMessage(
        goal,
        stats.goalSuccessfulRecruits,
        sendTime,
      ),
      webAppLocation: AMBASSADOR_INVITES_URL,
      mobileAppLocation: AMBASSADOR_INVITES_URL,
      associatedUsers: [],
      groupingKey,
      sendTime,
      shouldPush: true,
    });
  }

  private async sendAmbassadorInviteGoalEndedNotif(
    goal: AmbassadorInviteGoal,
  ): Promise<void> {
    const groupingKey = ambassadorGoalEndedGroupingKey(goal.id);
    const alreadySent = await this.notifsService.hasNotifWithGroupingKey(
      goal.ambassador.id,
      groupingKey,
    );
    if (alreadySent) {
      return;
    }

    const stats = await this.getAmbassadorInviteStats(goal.ambassador.id, goal);
    await this.notifsService.sendNotif({
      user: goal.ambassador,
      category: NotificationCategory.NewMemberReferred,
      message: this.getAmbassadorInviteGoalEndedMessage(goal, stats),
      webAppLocation: AMBASSADOR_INVITES_URL,
      mobileAppLocation: AMBASSADOR_INVITES_URL,
      associatedUsers: [],
      groupingKey,
      sendTime: new Date(),
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
    return `${successful}/${target} ${target === 1 ? 'successful recruit' : 'successful recruits'}`;
  }

  private async getAmbassadorInviteStatsByUserIds(
    userIds: number[],
  ): Promise<Map<number, AmbassadorInviteStats>> {
    if (!userIds.length) {
      return new Map();
    }

    const rows = (await this.onetimeInviteRepository.query(
      `
        WITH selected_users AS (
          SELECT UNNEST($1::int[]) AS "userId"
        ),
        invite_stats AS (
          SELECT
            selected_users."userId",
            COUNT(invite."id")::int AS "totalInvitesSent",
            COUNT(invite."id") FILTER (
              WHERE invite."status" = $2
            )::int AS "totalAcceptedInvites"
          FROM selected_users
          LEFT JOIN "onetime_invite" invite
            ON invite."invitingUserId" = selected_users."userId"
            AND invite."deletedAt" IS NULL
          GROUP BY selected_users."userId"
        ),
        successful_stats AS (
          SELECT
            selected_users."userId",
            COUNT(invited_user."id") FILTER (
              WHERE first_sign."signedAt" IS NOT NULL
            )::int AS "totalSuccessfulRecruits"
          FROM selected_users
          LEFT JOIN "user" invited_user
            ON invited_user."referredById" = selected_users."userId"
            AND invited_user."referralSource" IN ($3, $4)
          LEFT JOIN LATERAL (
            SELECT MIN(contract_event."date") AS "signedAt"
            FROM "contract_event" contract_event
            WHERE contract_event."userId" = invited_user."id"
              AND contract_event."type" = $5
          ) first_sign ON TRUE
          GROUP BY selected_users."userId"
        ),
        share_stats AS (
          SELECT
            selected_users."userId",
            COUNT(share_invite."id")::int AS "duplicateInviteLinks"
          FROM selected_users
          LEFT JOIN "share_url" share_invite
            ON share_invite."userId" = selected_users."userId"
            AND share_invite."kind" = $6
            AND share_invite."duplicate" = TRUE
          GROUP BY selected_users."userId"
        )
        SELECT
          selected_users."userId",
          (
            COALESCE(invite_stats."totalInvitesSent", 0)
            + COALESCE(share_stats."duplicateInviteLinks", 0)
          )::int AS "totalInvitesSent",
          COALESCE(invite_stats."totalAcceptedInvites", 0)::int
            AS "totalAcceptedInvites",
          COALESCE(successful_stats."totalSuccessfulRecruits", 0)::int
            AS "totalSuccessfulRecruits",
          0::int AS "goalSuccessfulRecruits"
        FROM selected_users
        LEFT JOIN invite_stats
          ON invite_stats."userId" = selected_users."userId"
        LEFT JOIN successful_stats
          ON successful_stats."userId" = selected_users."userId"
        LEFT JOIN share_stats
          ON share_stats."userId" = selected_users."userId"
      `,
      [
        userIds,
        OnetimeInviteStatus.LINK_USED,
        ReferralSource.OnetimeInvite,
        ReferralSource.InviteShareLink,
        ContractEventType.SIGNED,
        ShareUrlKind.Invite,
      ],
    )) as ({
      userId: number;
    } & AmbassadorInviteStats)[];

    return new Map(
      rows.map((row) => [
        row.userId,
        {
          totalInvitesSent: row.totalInvitesSent,
          totalAcceptedInvites: row.totalAcceptedInvites,
          totalSuccessfulRecruits: row.totalSuccessfulRecruits,
          goalSuccessfulRecruits: row.goalSuccessfulRecruits,
        },
      ]),
    );
  }

  private async getAmbassadorInviteStatsByGoalIds(
    goals: AmbassadorInviteGoal[],
  ): Promise<Map<number, AmbassadorInviteStats>> {
    if (!goals.length) {
      return new Map();
    }

    const rows = (await this.onetimeInviteRepository.query(
      `
        WITH selected_goals AS (
          SELECT *
          FROM UNNEST(
            $1::int[],
            $2::int[],
            $3::timestamptz[],
            $4::timestamptz[]
          ) AS goal("goalId", "userId", "startAt", "dueAt")
        ),
        invite_stats AS (
          SELECT
            selected_goals."goalId",
            COUNT(invite."id")::int AS "totalInvitesSent",
            COUNT(invite."id") FILTER (
              WHERE invite."status" = $5
            )::int AS "totalAcceptedInvites"
          FROM selected_goals
          LEFT JOIN "onetime_invite" invite
            ON invite."invitingUserId" = selected_goals."userId"
            AND invite."deletedAt" IS NULL
            AND invite."createdAt" >= selected_goals."startAt"
            AND invite."createdAt" <= selected_goals."dueAt"
          GROUP BY selected_goals."goalId"
        ),
        successful_stats AS (
          SELECT
            selected_goals."goalId",
            COUNT(invited_user."id") FILTER (
              WHERE first_sign."signedAt" >= selected_goals."startAt"
                AND first_sign."signedAt" <= selected_goals."dueAt"
            )::int AS "totalSuccessfulRecruits"
          FROM selected_goals
          LEFT JOIN "user" invited_user
            ON invited_user."referredById" = selected_goals."userId"
            AND invited_user."referralSource" IN ($6, $7)
          LEFT JOIN LATERAL (
            SELECT MIN(contract_event."date") AS "signedAt"
            FROM "contract_event" contract_event
            WHERE contract_event."userId" = invited_user."id"
              AND contract_event."type" = $8
          ) first_sign ON TRUE
          GROUP BY selected_goals."goalId"
        ),
        share_stats AS (
          SELECT
            selected_goals."goalId",
            COUNT(share_invite."id")::int AS "duplicateInviteLinks"
          FROM selected_goals
          LEFT JOIN "share_url" share_invite
            ON share_invite."userId" = selected_goals."userId"
            AND share_invite."kind" = $9
            AND share_invite."duplicate" = TRUE
            AND share_invite."createdAt" >= selected_goals."startAt"
            AND share_invite."createdAt" <= selected_goals."dueAt"
          GROUP BY selected_goals."goalId"
        )
        SELECT
          selected_goals."goalId",
          (
            COALESCE(invite_stats."totalInvitesSent", 0)
            + COALESCE(share_stats."duplicateInviteLinks", 0)
          )::int AS "totalInvitesSent",
          COALESCE(invite_stats."totalAcceptedInvites", 0)::int
            AS "totalAcceptedInvites",
          COALESCE(successful_stats."totalSuccessfulRecruits", 0)::int
            AS "totalSuccessfulRecruits",
          COALESCE(successful_stats."totalSuccessfulRecruits", 0)::int
            AS "goalSuccessfulRecruits"
        FROM selected_goals
        LEFT JOIN invite_stats
          ON invite_stats."goalId" = selected_goals."goalId"
        LEFT JOIN successful_stats
          ON successful_stats."goalId" = selected_goals."goalId"
        LEFT JOIN share_stats
          ON share_stats."goalId" = selected_goals."goalId"
      `,
      [
        goals.map((goal) => goal.id),
        goals.map((goal) => goal.ambassador.id),
        goals.map((goal) => goal.startAt),
        goals.map((goal) => goal.dueAt),
        OnetimeInviteStatus.LINK_USED,
        ReferralSource.OnetimeInvite,
        ReferralSource.InviteShareLink,
        ContractEventType.SIGNED,
        ShareUrlKind.Invite,
      ],
    )) as ({
      goalId: number;
    } & AmbassadorInviteStats)[];

    return new Map(
      rows.map((row) => [
        row.goalId,
        {
          totalInvitesSent: row.totalInvitesSent,
          totalAcceptedInvites: row.totalAcceptedInvites,
          totalSuccessfulRecruits: row.totalSuccessfulRecruits,
          goalSuccessfulRecruits: row.goalSuccessfulRecruits,
        },
      ]),
    );
  }

  private async getAmbassadorInviteStats(
    userId: number,
    goal?: AmbassadorInviteGoal,
  ): Promise<AmbassadorInviteStats> {
    const goalStartAt = goal?.startAt ?? null;
    const goalDueAt = goal?.dueAt ?? null;

    const [row] = (await this.onetimeInviteRepository.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE ($5::timestamptz IS NULL OR invite."createdAt" >= $5::timestamptz)
              AND ($6::timestamptz IS NULL OR invite."createdAt" <= $6::timestamptz)
          )::int + (
            SELECT COUNT(*)::int
            FROM "share_url" share_invite
            WHERE share_invite."userId" = $1
              AND share_invite."kind" = $7
              AND share_invite."duplicate" = TRUE
              AND ($5::timestamptz IS NULL OR share_invite."createdAt" >= $5::timestamptz)
              AND ($6::timestamptz IS NULL OR share_invite."createdAt" <= $6::timestamptz)
          ) AS "totalInvitesSent",
          COUNT(*) FILTER (
            WHERE invite."status" = $2
              AND ($5::timestamptz IS NULL OR invite."createdAt" >= $5::timestamptz)
              AND ($6::timestamptz IS NULL OR invite."createdAt" <= $6::timestamptz)
          )::int AS "totalAcceptedInvites",
          (
            SELECT COUNT(*)::int
            FROM "user" invited_user
            LEFT JOIN LATERAL (
              SELECT MIN(contract_event."date") AS "signedAt"
              FROM "contract_event" contract_event
              WHERE contract_event."userId" = invited_user."id"
                AND contract_event."type" = $8
            ) first_sign ON TRUE
            WHERE invited_user."referredById" = $1
              AND invited_user."referralSource" IN ($3, $4)
              AND first_sign."signedAt" IS NOT NULL
              AND ($5::timestamptz IS NULL OR first_sign."signedAt" >= $5::timestamptz)
              AND ($6::timestamptz IS NULL OR first_sign."signedAt" <= $6::timestamptz)
          ) AS "totalSuccessfulRecruits"
        FROM "onetime_invite" invite
        WHERE invite."invitingUserId" = $1
          AND invite."deletedAt" IS NULL
      `,
      [
        userId,
        OnetimeInviteStatus.LINK_USED,
        ReferralSource.OnetimeInvite,
        ReferralSource.InviteShareLink,
        goalStartAt,
        goalDueAt,
        ShareUrlKind.Invite,
        ContractEventType.SIGNED,
      ],
    )) as [
      {
        totalInvitesSent: number;
        totalAcceptedInvites: number;
        totalSuccessfulRecruits: number;
      },
    ];

    return {
      totalInvitesSent: row.totalInvitesSent,
      totalAcceptedInvites: row.totalAcceptedInvites,
      totalSuccessfulRecruits: row.totalSuccessfulRecruits,
      goalSuccessfulRecruits: goal ? row.totalSuccessfulRecruits : 0,
    };
  }

  private validateAmbassadorInviteGoalDates(startAt: Date, dueAt: Date): void {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Goal dates are invalid');
    }
    if (startAt >= dueAt) {
      throw new BadRequestException('Goal start date must be before end date');
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
        'Invite goal dates overlap with an existing goal',
      );
    }
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
      this.findOneOrFail(userId, { leaderOf: true }),
    ]);
    if (invite.invitingUser?.id !== userId && !user.admin) {
      throw new BadRequestException('Invite belongs to someone else');
    }
    if (invite.status !== OnetimeInviteStatus.LINK_UNUSED) {
      throw new BadRequestException('This invite can no longer be edited');
    }
    if (
      communityId !== undefined &&
      communityId !== null &&
      !user.admin &&
      !user.leaderOfIdSet.has(communityId)
    ) {
      throw new BadRequestException(
        `User is not a leader of community ${communityId}`,
      );
    }

    const trimmedInvitee = invitee?.trim();
    if (invitee !== undefined && !trimmedInvitee) {
      throw new BadRequestException('Invitee name cannot be empty');
    }
    await this.onetimeInviteRepository.save({
      id: inviteId,
      ...(trimmedInvitee !== undefined && { invitee: trimmedInvitee }),
      ...(communityId !== undefined && {
        community: communityId === null ? null : { id: communityId },
      }),
    });
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
    const user = await this.findOneOrFail(userId);
    if (
      !(
        invite.invitingUser.id === userId ||
        user.leaderOfIds.some((cid) => cid === invite.communityId) ||
        user.admin
      )
    ) {
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

    const user = await this.findOneOrFail(userId, { communities: true });
    const community: Community | undefined = user.communities.find(
      (community) => community.id === communityId,
    );
    if (!community) {
      throw new BadRequestException(
        `User is not a member of community ${communityId} or community does not exist`,
      );
    }

    const code = Math.random().toString(36).substring(2, 15);

    const savedInvite = await this.onetimeInviteRepository.save(
      this.onetimeInviteRepository.create({
        ...rest,
        code,
        invitingUser: user,
        community,
        status: OnetimeInviteStatus.REQUEST_PENDING,
      }),
    );

    sendNotificationToLeaders: {
      const communityWithLeaders = await this.communityRepository.findOne({
        where: { id: communityId },
        relations: { leaders: true },
      });
      if (!communityWithLeaders || !communityWithLeaders.leaders) {
        console.log('Community leaders not found for community', communityId);
        break sendNotificationToLeaders;
      }
      await this.notifsService.sendNotifs(
        communityWithLeaders.leaders.map((leader) => ({
          user: leader,
          category: NotificationCategory.OnetimeInviteRequestCreated,
          message: `${user.name} requested an invite for ${rest.invitee} (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'invites',
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
      newStatus: 'approve',
      message: `Your request to invite [USER] was approved`,
    });
  }

  async rejectOnetimeInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<void> {
    await this.approveOrRejectOnetimeInviteRequest({
      inviteId,
      userId,
      newStatus: 'reject',
      message: 'Your request to invite [USER] was rejected',
    });
  }

  async approveOrRejectOnetimeInviteRequest(params: {
    userId: number;
    inviteId: number;
    newStatus: 'approve' | 'reject';
    message: `${string}[USER]${string}`;
  }): Promise<OnetimeInvite> {
    const { userId, inviteId, newStatus, message } = params;

    const user = await this.findOneOrFail(userId);

    const request = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true },
    });

    if (request.status !== OnetimeInviteStatus.REQUEST_PENDING) {
      throw new BadRequestException(
        `Invite is not a pending request. Status: ${request.status}`,
      );
    }

    if (!user.leaderOfIds.some((cid) => cid === request.communityId)) {
      throw new BadRequestException(
        `User is not a leader of community ${request.communityId}`,
      );
    }

    let category: NotificationCategory;
    switch (newStatus) {
      case 'approve':
        request.status = OnetimeInviteStatus.LINK_UNUSED;
        category = NotificationCategory.OnetimeInviteRequestApproved;
        break;
      case 'reject':
        request.status = OnetimeInviteStatus.REQUEST_REJECTED;
        category = NotificationCategory.OnetimeInviteRequestRejected;
        break;
      default:
        throw new InternalServerErrorException(
          `Unhandled status: ${newStatus satisfies never}`,
        );
    }
    const savedInvite = await this.onetimeInviteRepository.save(request);

    await this.notifsService.sendNotif({
      user: savedInvite.invitingUser,
      category,
      message: message.replace('[USER]', savedInvite.invitee),
      webAppLocation: groupUrl({
        tab: 'invites',
        communityId: savedInvite.communityId,
      }),
      associatedUsers: [savedInvite.invitingUser],
    });

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
        order: { createdAt: 'DESC', id: 'DESC' },
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
      .createQueryBuilder('invite')
      .leftJoin('invite.invitedUser', 'invitedUser')
      .select('invite.invitingUserId', 'userId')
      .addSelect('COUNT(*)', 'sent')
      .addSelect(
        'COUNT(*) FILTER (WHERE invite.status = :linkUsed OR invitedUser.id IS NOT NULL)',
        'accepted',
      )
      .where('invite.deletedAt IS NULL')
      .andWhere('invite.invitingUserId IS NOT NULL')
      .setParameter('linkUsed', OnetimeInviteStatus.LINK_USED)
      .groupBy('invite.invitingUserId')
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
      .createQueryBuilder('invite')
      .innerJoin('invite.invitedUser', 'invitedUser')
      .select('invite.invitingUserId', 'invitingUserId')
      .addSelect('invitedUser.id', 'invitedUserId')
      .where('invite.deletedAt IS NULL')
      .andWhere('invite.status = :status', {
        status: OnetimeInviteStatus.LINK_USED,
      })
      .andWhere('invite.invitingUserId IS NOT NULL')
      .getRawMany<OnetimeInviteEdge>();
  }

  async findOnetimeInvites(communityId: number): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: { community: { id: communityId }, deletedAt: IsNull() },
      relations: { invitingUser: true },
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

  async invalidateInvite(inviteId: number): Promise<void> {
    await this.onetimeInviteRepository.update(inviteId, {
      status: OnetimeInviteStatus.LINK_USED,
      usedAt: new Date(),
    });
  }

  async joinGroupAssignment(userId: number): Promise<void> {
    const user = await this.findOneOrFail(userId);
    user.undergoingGroupAssignment = true;
    await this.userRepository.save(user);
  }

  async leaveGroupAssignment(userId: number): Promise<void> {
    const user = await this.findOneOrFail(userId);
    user.undergoingGroupAssignment = false;
    await this.userRepository.save(user);
  }

  async findGroupAssignmentMembers(): Promise<User[]> {
    return this.userRepository.find({
      where: { undergoingGroupAssignment: true },
      relations: {
        communities: { leaders: true },
      },
    });
  }

  async assignGroupsAdmin(body: AssignGroupsDto): Promise<void> {
    const userIds = body.assignments.map(({ userId }) => userId);
    if (userIds.length !== new Set(userIds).size) {
      throw new BadRequestException(
        'Cannot assign the same user multiple times',
      );
    }

    const userByIdP = this.userRepository
      .find({
        where: {
          id: In(userIds),
          undergoingGroupAssignment: true,
        },
        relations: {
          communities: { leaders: true, users: true },
        },
      })
      .then((users) => new Map(users.map((user) => [user.id, user])));
    const communityByIdP = this.communityRepository
      .find({
        where: {
          id: In(body.assignments.map(({ communityId }) => communityId)),
        },
        relations: {
          users: true,
          leaders: true,
        },
      })
      .then(
        (communities) =>
          new Map(communities.map((community) => [community.id, community])),
      );

    const userById = await userByIdP;
    const communityById = await communityByIdP;

    // The loop below drops each member from their old groups before adding them
    // to the new one, and it is not transactional — so everything that can
    // refuse the batch has to refuse it here, before the first write. A throw
    // part-way through leaves earlier assignments applied and the member it
    // stopped on in no group at all.
    const assignments = body.assignments.map(({ userId, communityId }) => {
      const user = userById.get(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      const community = communityById.get(communityId);
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      return { user, community };
    });

    // Implies maxCapacity is non-null for everything left, per the check
    // constraint on Community.
    const closed = Array.from(communityById.values()).filter(
      (community) => !community.allowStaffAssignments,
    );
    if (closed.length) {
      throw new BadRequestException(
        `Cannot assign to groups that do not accept staff assignments: ${closed
          .map((community) => community.name)
          .join(', ')}`,
      );
    }

    const remainingSlots = new Map<number, number>();
    for (const { community } of assignments) {
      const remaining =
        remainingSlots.get(community.id) ?? getStaffAssignableSlots(community);
      if (remaining <= 0) {
        throw new BadRequestException(
          `Too many members assigned to community ${community.id}`,
        );
      }
      remainingSlots.set(community.id, remaining - 1);
    }

    // Queued members can lose their contract after they join the queue —
    // nothing clears `undergoingGroupAssignment` on suspension — so this is a
    // live rejection, not a formality.
    await this.communityService.assertUsersHaveActiveContracts(
      assignments.map(({ user }) => user),
    );

    const userNotifs: CreateNotifParams[] = [];
    for (const { user, community } of assignments) {
      // Remove user from old communities (except ones they lead)
      await Promise.all(
        user.communities
          .filter((oldCommunity) => !user.leaderOfIdSet.has(oldCommunity.id))
          .map((oldCommunity) =>
            this.communityService.removeUserFromCommunityAndRefreshConversation(
              {
                user,
                community: oldCommunity,
                removeAsLeader: false,
                notifForLeader: ({ leader }) => ({
                  user: leader,
                  category: NotificationCategory.MemberLeftCommunity,
                  message: `${user.name} left your group (${oldCommunity.name})`,
                  webAppLocation: groupUrl({
                    tab: 'members',
                    communityId: oldCommunity.id,
                  }),
                  associatedUsers: [user],
                }),
                saveAsPendingCommunity: false,
              },
            ),
          ),
      );

      // Refetch community to get up-to-date users list
      const freshCommunity = await this.communityRepository.findOneOrFail({
        where: { id: community.id },
        relations: { users: true, leaders: true },
      });

      // Add user to new community
      await this.communityService.addUsersToCommunityAndRefreshConversation({
        user,
        community: freshCommunity,
        notifForLeader: ({ leader }) => ({
          user: leader,
          category: NotificationCategory.CommunityAssigned,
          message: `Alliance staff assigned ${user.name} to your group (${freshCommunity.name})`,
          webAppLocation: groupUrl({
            tab: 'members',
            communityId: freshCommunity.id,
          }),
          associatedUsers: [user],
        }),
      });

      userNotifs.push({
        user,
        category: NotificationCategory.CommunityAssigned,
        message: `You were assigned to a new group (${freshCommunity.name})`,
        webAppLocation: groupUrl({
          communityId: freshCommunity.id,
        }),
        associatedUsers: [],
      });
    }

    await this.notifsService.sendNotifs(userNotifs);
  }

  async getAllUserIds(): Promise<number[]> {
    return this.userRepository
      .find({ select: ['id'] })
      .then((users) => users.map((user) => user.id));
  }

  async registerDevice(
    userId: number,
    body: RegisterDeviceDto,
  ): Promise<string> {
    const user = await this.findOneOrFail(userId, { devices: true });
    if (body.deviceId) {
      const existingDevice = await this.userDeviceRepository.findOne({
        where: { id: body.deviceId, user: { id: userId } },
      });
      if (existingDevice) {
        await this.userDeviceRepository.update(existingDevice.id, {
          expoPushToken: body.expoPushToken,
        });
        return existingDevice.id;
      }
    }

    if (body.expoPushToken) {
      const existingByToken = await this.userDeviceRepository.findOne({
        where: { expoPushToken: body.expoPushToken },
        relations: { user: true },
      });
      if (existingByToken) {
        if (existingByToken.user?.id !== userId) {
          console.log('Reassigning device by expo push token to user', userId);
          await this.userDeviceRepository.update(existingByToken.id, {
            user: { id: userId },
            deviceType: body.deviceType ?? existingByToken.deviceType,
          });
        }
        return existingByToken.id;
      }
    }

    const device = this.userDeviceRepository.create({
      deviceType: body.deviceType,
      expoPushToken: body.expoPushToken,
      user,
    });
    const savedDevice = await this.userDeviceRepository.save(device);
    return savedDevice.id;
  }

  async testPushNotification(userId: number, message: string): Promise<Push> {
    const user = await this.findOneOrFail(userId, { devices: true });
    const device = user.devices?.[0];
    if (!device || !device.expoPushToken) {
      throw new BadRequestException('User has no expo push token');
    }
    return this.pushService.sendPushNotification(
      userId,
      device.expoPushToken,
      message,
    );
  }

  async signedMembersCount(): Promise<number> {
    return (
      await this.userRepository.find({
        relations: { contractEvents: true },
      })
    ).filter((user) => user.hasActiveContract).length;
  }

  async registerLiveActivityPushToStartToken(
    userId: number,
    body: RegisterLiveActivityPushToStartTokenDto,
  ): Promise<string> {
    const user = await this.findOneOrFail(userId, { devices: true });

    // Find the device to update - match by deviceId if provided, otherwise first device
    let device: UserDevice | null = null;
    if (body.deviceId) {
      device = await this.userDeviceRepository.findOne({
        where: { id: body.deviceId, user: { id: userId } },
      });
    }
    if (!device && user.devices?.length) {
      device = user.devices[0];
    }

    if (!device) {
      throw new NotFoundException('No device found for user');
    }

    await this.userDeviceRepository.update(device.id, {
      liveActivityPushToStartToken: body.pushToStartToken,
    });

    return device.id;
  }

  async registerLiveActivityUpdateToken(
    userId: number,
    body: RegisterLiveActivityUpdateTokenDto,
  ): Promise<void> {
    const existing = await this.liveActivityRegistrationRepository.findOne({
      where: { userId, actionId: body.actionId },
    });

    if (existing) {
      await this.liveActivityRegistrationRepository.update(existing.id, {
        updateToken: body.updateToken,
        activityId: body.activityId,
      });
    } else {
      await this.liveActivityRegistrationRepository.save(
        this.liveActivityRegistrationRepository.create({
          userId,
          actionId: body.actionId,
          updateToken: body.updateToken,
          activityId: body.activityId,
          pushToStartSent: true,
        }),
      );
    }
  }

  // The event log is the system of record for deletion requests — the failure
  // is returned to the controller instead of treated as best-effort.
  async requestAccountDeletion(userId: number): Promise<Result<void, Error>> {
    return this.eventLogService.sendMessage({
      type: EventType.AccountDeletionRequested,
      message: `User ${userId} requested account deletion`,
      userId: userId,
    });
  }
}
