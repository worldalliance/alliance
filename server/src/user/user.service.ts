import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { City } from 'src/geo/city.entity';
import { ImagesService } from 'src/images/images.service';
import { MailService } from 'src/mail/mail.service';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import { ILike, In, Repository } from 'typeorm';
import { Friend, FriendStatus } from './entities/friend.entity';
import { PrefillUser } from './entities/prefill-user.entity';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
} from './user.dto';
import { User } from './entities/user.entity';
import { groupInvitesUrl, profileUrl } from 'src/search/approutes';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './tag.dto';
import { Community } from './entities/community.entity';
import { CreateCommunityDto, UpdateCommunityDto } from './community.dto';
import { CommunityMemberContactInfoDto } from './dto/user-action-relations.dto';
import { OnetimeInvite } from './entities/onetime-invite.entity';
import {
  CommunityInviteDto,
  CreateCommunityInviteDto,
  CreateOnetimeInviteDto,
  CreateOnetimeInviteRequestDto,
} from './dto/invite.dto';
import {
  UserAwayRange,
  UserAwayRangeReason,
} from './entities/user-away-range.entity';
import { CreateAwayRangeDto } from './dto/away-range.dto';
import { Temporal } from '@js-temporal/polyfill';
import {
  CommunityInvite,
  CommunityInviteStatus,
} from './entities/community-invite.entity';
import { ConversationService } from 'src/messaging/conversation.service';
import { RelationString } from 'src/tasks/entities/type';
import {
  OnetimeInviteRequest,
  OnetimeInviteRequestStatus,
} from './entities/onetime-invite-request.entity';

const defaultTimeZone = 'America/Los_Angeles';
const communityDefaultRelations: readonly RelationString<Community>[] = [
  'users',
  'leaders',
];

export interface PWResetJwtPayload {
  sub: number;
  type: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PrefillUser)
    private prefillUserRepository: Repository<PrefillUser>,
    @InjectRepository(City)
    private cityRepository: Repository<City>,
    @InjectRepository(Notification)
    private notifRepository: Repository<Notification>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(OnetimeInvite)
    private readonly onetimeInviteRepository: Repository<OnetimeInvite>,
    @InjectRepository(OnetimeInviteRequest)
    private readonly onetimeInviteRequestRepository: Repository<OnetimeInviteRequest>,
    @InjectRepository(UserAwayRange)
    private readonly userAwayRangeRepository: Repository<UserAwayRange>,
    @InjectRepository(CommunityInvite)
    private readonly communityInviteRepository: Repository<CommunityInvite>,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly conversationService: ConversationService,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: number, data: UpdateProfileDto): Promise<User> {
    const user = await this.findOneOrFail(id);

    if (data.cityId !== undefined) {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cityId, profilePicture, hasActiveContract, ...updateData } = data;

    if (!updateData.preferredReminderTime) {
      updateData.preferredReminderTime = undefined;
    }

    if (profilePicture && profilePicture.length > 100) {
      //TODO: differentiate between file and url
      const key = profilePicture
        ? await this.imagesService.processAndUploadProfileImage(profilePicture)
        : undefined;

      const updateDataWithPfp = {
        ...updateData,
        profilePicture: key,
      };

      Object.assign(user, updateDataWithPfp);
    } else {
      Object.assign(user, updateData);
    }

    return this.userRepository.save(user);
  }

  async setPassword(id: number, password: string): Promise<User> {
    const user = await this.findOneOrFail(id);
    user.password = password;
    await user.hashPassword();
    return this.userRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  findAllWithFriendRequests(): Promise<User[]> {
    return this.userRepository.find({
      relations: [
        'sentFriendRequests',
        'sentFriendRequests.addressee',
        'receivedFriendRequests',
        'receivedFriendRequests.requester',
      ],
    });
  }

  findOne(
    id: number,
    relations?: RelationString<User>[],
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['city', ...(relations ?? [])],
    });
  }

  async findOneByEmail(
    email: string,
    relations?: string[],
  ): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: ILike(email) },
      relations,
    });
  }

  async findOneByReferralCode(referralCode: string): Promise<User | null> {
    return this.userRepository.findOneBy({ referralCode });
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async setAdmin(id: number, admin: boolean): Promise<void> {
    await this.userRepository.update(id, { admin });
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
    const user = await this.findOneByEmail(email, ['leaderOf']);
    if (!user) {
      return false;
    }
    return user.leaderOf?.length > 0;
  }

  async onboarding(userId: number, body: OnboardingDto): Promise<User> {
    const user = await this.findOneOrFail(userId);

    const city = body.cityId
      ? await this.cityRepository.findOne({
          where: { id: body.cityId },
        })
      : null;

    if (city) {
      user.city = city;
    }
    if (body.over18 !== null) {
      user.over18 = body.over18;
    }
    if (body.anonymous !== null) {
      user.anonymous = body.anonymous;
    }

    user.onboardingComplete = true;
    return this.userRepository.save(user);
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
      const notif = this.notifRepository.create({
        user: addressee,
        category: NotificationCategory.FriendRequest,
        message: `${requester.name} wants to be friends`,
        webAppLocation: profileUrl(requesterId),
        associatedUsers: [requester],
      });

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
      relations: ['requester', 'addressee'],
    });

    if (!rel) {
      throw new NotFoundException('No pending request found');
    }

    rel.status = status;
    if (status === FriendStatus.Accepted) {
      rel.acceptedAt = new Date();
      rel.acceptedNotif = this.notifRepository.create({
        user: rel.requester,
        category: NotificationCategory.FriendRequestAccepted,
        message: `${rel.addressee.name} accepted your friend request`,
        webAppLocation: profileUrl(rel.addressee.id),
        associatedUsers: [rel.addressee],
      });
    }
    return this.friendRepository.save(rel);
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

  async findFriends(userId: number): Promise<ProfileDto[]> {
    const rels = await this.friendRepository.find({
      where: [
        { requester: { id: userId }, status: FriendStatus.Accepted },
        { addressee: { id: userId }, status: FriendStatus.Accepted },
      ],
      relations: ['requester', 'addressee'],
    });

    const others = rels.map((r) =>
      r.requester.id === userId ? r.addressee : r.requester,
    );

    return others.map((o) => new ProfileDto(o));
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
  }

  async findPendingRequests(
    userId: number,
    direction: 'sent' | 'received',
  ): Promise<ProfileDto[]> {
    const rels =
      direction === 'sent'
        ? await this.friendRepository.find({
            where: { requester: { id: userId }, status: FriendStatus.Pending },
            relations: ['addressee'],
          })
        : await this.friendRepository.find({
            where: { addressee: { id: userId }, status: FriendStatus.Pending },
            relations: ['requester'],
          });
    const users =
      direction === 'sent'
        ? rels.map((r) => r.addressee)
        : rels.map((r) => r.requester);

    return users.map((u) => new ProfileDto(u));
  }

  async getRelationshipStatus(
    userId: number,
    targetUserId: number,
  ): Promise<FriendStatusDto> {
    const rel =
      (await this.friendRepository.findOne({
        where: { requester: { id: userId }, addressee: { id: targetUserId } },
        relations: ['requester', 'addressee'],
      })) ||
      (await this.friendRepository.findOne({
        where: { requester: { id: targetUserId }, addressee: { id: userId } },
        relations: ['requester', 'addressee'],
      }));

    const status = rel ? rel.status : FriendStatus.None;
    return {
      status,
      didReceiveRequest:
        status === FriendStatus.Pending && rel?.addressee.id === userId,
    };
  }

  async findOneOrFail(
    id: number,
    relations?: RelationString<User>[],
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findOneLeaderOrFail(
    userId: number,
    communityId: number,
  ): Promise<User> {
    const user = await this.findOneOrFail(userId);
    if (user.admin) {
      return user;
    }

    const isLeader = await this.communityRepository
      .createQueryBuilder('community')
      .innerJoin('community.leaders', 'leader')
      .where('community.id = :communityId', { communityId })
      .andWhere('leader.id = :userId', { userId })
      .getExists();

    if (!isLeader) {
      throw new UnauthorizedException(
        `User ${userId} is not a leader of community ${communityId}`,
      );
    }

    return user;
  }

  async findByIds(ids: number[], relations?: string[]): Promise<User[]> {
    return this.userRepository.find({
      where: { id: In(ids) },
      relations,
    });
  }

  async countReferred(id: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['referredUsers'],
    });
    return user?.referredUsers.length ?? 0;
  }

  async getUserLocation(userId: number): Promise<City | undefined> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['city'],
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user.city;
  }

  async findOnePrefill(id: number): Promise<PrefillUser> {
    const user = await this.prefillUserRepository.findOne({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
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

  async findAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        isNotSignedUpPartialProfile: false,
      },
    });
  }

  async findActiveUsersWithTags(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        isNotSignedUpPartialProfile: false,
      },
      relations: ['tags', 'awayRanges'],
    });
  }

  async createPartialProfile(
    body: Pick<PaymentUserDataToken, 'email' | 'firstName' | 'lastName'>,
  ): Promise<User> {
    return this.create({
      email: body.email,
      name: body.firstName + ' ' + body.lastName,
      password: Math.random().toString(36).substring(2, 15), //TODO: they have to reset this but maybe do something better
      isNotSignedUpPartialProfile: true,
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

  async signContract(userId: number): Promise<User> {
    const user = await this.findOneOrFail(userId);
    user.contractDateSigned = new Date();
    user.contractDateSuspended = null;
    return this.userRepository.save(user);
  }

  async suspendContract(userId: number): Promise<User> {
    const user = await this.findOneOrFail(userId);
    user.contractDateSuspended = new Date();
    return this.userRepository.save(user);
  }

  async createAwayRange(
    userId: number,
    data: CreateAwayRangeDto,
  ): Promise<UserAwayRange> {
    const reason = data.reason;
    const startDay = Temporal.PlainDate.from(data.startDay);
    const endDay = Temporal.PlainDate.from(data.endDay);
    const user = await this.findOneOrFail(userId);
    const tz = user.timeZone ?? defaultTimeZone;
    const now = new Date();

    const startDate = startDay
      .toZonedDateTime({
        timeZone: tz,
        plainTime: Temporal.PlainTime.from({ hour: 0 }),
      })
      .toInstant();
    const endDate = endDay
      .toZonedDateTime({
        timeZone: tz,
        plainTime: Temporal.PlainTime.from({ hour: 23, minute: 59 }),
      })
      .toInstant();

    if (startDate.epochMilliseconds >= endDate.epochMilliseconds) {
      throw new BadRequestException('End date must be after start date.');
    }

    if (startDate.epochMilliseconds < now.getTime()) {
      throw new BadRequestException('Start date must be in the future.');
    }

    const maxDuration = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
    if (endDate.epochMilliseconds - startDate.epochMilliseconds > maxDuration) {
      throw new BadRequestException(
        'Away period cannot exceed 14 days. Please email us if you need to be away for longer.',
      );
    }

    if (reason === UserAwayRangeReason.OTHER && !data.note) {
      throw new BadRequestException(
        'Please provide a note for your away period.',
      );
    }

    const awayRange = this.userAwayRangeRepository.create({
      userId,
      startDate: new Date(startDate.epochMilliseconds),
      endDate: new Date(endDate.epochMilliseconds),
      reason,
      note: data.note,
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

  isUserAway(user: User, checkDate: Date = new Date()): boolean {
    return user.awayRanges.some(
      (range) => checkDate >= range.startDate && checkDate <= range.endDate,
    );
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

  private get communityRelations(): string[] {
    return [...communityDefaultRelations];
  }

  async findCommunityOrFail(
    id: number,
    relations?: RelationString<Community>[],
  ): Promise<Community> {
    return this.communityRepository.findOneOrFail({
      where: { id },
      relations: relations ?? this.communityRelations,
    });
  }

  async createCommunity(body: CreateCommunityDto): Promise<Community> {
    const community = this.communityRepository.create(body);
    const savedCommunity = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(
      savedCommunity.id,
    );
    return savedCommunity;
  }

  async findAllCommunities(): Promise<Community[]> {
    return this.communityRepository.find({
      relations: this.communityRelations,
      order: { createdAt: 'DESC' },
    });
  }

  async updateCommunity(
    communityId: number,
    body: UpdateCommunityDto,
    userId: number,
  ): Promise<Community> {
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    if (
      !user.leaderOf.some((leader) => leader.id === communityId) &&
      !user.admin
    ) {
      throw new UnauthorizedException();
    }

    const community = await this.findCommunityOrFail(communityId);
    Object.assign(community, body);
    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async deleteCommunity(communityId: number): Promise<void> {
    await this.communityRepository.delete(communityId);
  }

  async addUserToCommunity(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.findCommunityOrFail(communityId);
    const user = await this.findOneOrFail(userId);

    community.users = community.users ?? [];
    if (!community.users.some((existing) => existing.id === userId)) {
      community.users.push(user);
    }

    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async removeUserFromCommunity(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.findCommunityOrFail(communityId);

    community.users = (community.users ?? []).filter(
      (user) => user.id !== userId,
    );
    community.leaders = (community.leaders ?? []).filter(
      (leader) => leader.id !== userId,
    );

    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async addLeaderToCommunity(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.findCommunityOrFail(communityId);
    const user = await this.findOneOrFail(userId);

    community.users = community.users ?? [];
    if (!community.users.some((existing) => existing.id === userId)) {
      community.users.push(user);
    }

    community.leaders = community.leaders ?? [];
    if (!community.leaders.some((existing) => existing.id === userId)) {
      community.leaders.push(user);
    }

    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async removeLeaderFromCommunity(
    communityId: number,
    userId: number,
  ): Promise<Community> {
    const community = await this.findCommunityOrFail(communityId);

    community.leaders = (community.leaders ?? []).filter(
      (leader) => leader.id !== userId,
    );

    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async findUserCommunity(userId: number): Promise<Community | null> {
    const user = await this.findOneOrFail(userId, ['communities']);
    const communityId =
      user.communities.length > 0 ? user.communities[0].id : null;

    if (!communityId) {
      return null;
    }

    return this.findCommunityOrFail(communityId, ['users', 'leaders']);
  }

  async getUserIdsForUserCommunity(userId: number): Promise<number[]> {
    const user = await this.findOneOrFail(userId, ['communities']);
    const communityId =
      user.communities.length > 0 ? user.communities[0].id : null;
    if (!communityId) {
      throw new NotFoundException('User is not a member of any community.');
    }
    const community = await this.findCommunityOrFail(communityId, ['users']);
    const userIds = community.users!.map((user) => user.id);
    return userIds;
  }

  async getMemberContactInfo(
    userId: number,
  ): Promise<CommunityMemberContactInfoDto[]> {
    const leader = await this.findOneOrFail(userId);
    const userIds = await this.getUserIdsForUserCommunity(userId);
    const contactInfos: CommunityMemberContactInfoDto[] = [];
    for (const userId of userIds) {
      const user = await this.findOneOrFail(userId);
      contactInfos.push(
        new CommunityMemberContactInfoDto(user, leader.timeZone),
      );
    }
    return contactInfos;
  }

  async createTag(body: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create(body);
    return this.tagRepository.save(tag);
  }

  async findAllTags(): Promise<Tag[]> {
    return this.tagRepository.find({ relations: ['users'] });
  }

  async findTagByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { name } });
  }

  async findTagOrFail(id: number): Promise<Tag> {
    return this.tagRepository.findOneOrFail({
      where: { id },
      relations: ['users'],
    });
  }

  async addUserToTag(tagId: number, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: ['users'],
    });
    tag.users.push(await this.findOneOrFail(userId));
    return this.tagRepository.save(tag);
  }

  async removeUserFromTag(tagId: number, userId: number): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
      relations: ['users'],
    });
    tag.users = tag.users.filter((user) => user.id !== userId);
    return this.tagRepository.save(tag);
  }

  async updateTag(tagId: number, body: CreateTagDto): Promise<Tag> {
    const tag = await this.tagRepository.findOneOrFail({
      where: { id: tagId },
    });
    Object.assign(tag, body);
    return this.tagRepository.save(tag);
  }

  async deleteTag(tagId: number): Promise<void> {
    await this.tagRepository.delete(tagId);
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

    // Fetch the user only once
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    const isAdmin = user.admin;

    // Normal users cannot create invites from other users
    const invitingUserId =
      (isAdmin ? providedInvitingUserId : undefined) ?? userId;

    let community: Community | undefined;

    if (isAdmin) {
      if (communityId) {
        community =
          (await this.communityRepository.findOne({
            where: { id: communityId },
          })) ?? undefined;
        if (!community) {
          throw new NotFoundException(`Community ${communityId} not found`);
        }
      }
    } else {
      if (communityId === undefined) {
        throw new UnauthorizedException('Community ID not provided');
      }

      community = user.leaderOf.find(
        (community) => community.id === communityId,
      );
      if (!community) {
        throw new UnauthorizedException(
          `User is not a leader of community ${communityId}`,
        );
      }
    }

    const invitingUser =
      userId === invitingUserId
        ? user
        : await this.findOneOrFail(invitingUserId);

    const invite = this.onetimeInviteRepository.create({
      ...rest,
      code,
      invitingUser,
      community,
    });
    return await this.onetimeInviteRepository.save(invite);
  }

  async deleteOnetimeInviteRequest(
    requestId: number,
    userId: number,
  ): Promise<void> {
    const request = await this.onetimeInviteRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: ['invitingUser', 'community'],
    });
    const user = await this.findOneOrFail(userId);
    if (!(request.invitingUser.id === userId || user.admin)) {
      throw new UnauthorizedException();
    }

    await this.onetimeInviteRequestRepository.delete(requestId);
  }

  async deleteOnetimeInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: ['invitingUser', 'community'],
    });
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    if (
      !(
        invite.invitingUser.id === userId ||
        user.leaderOf.some((leader) => leader.id === invite.community?.id) ||
        user.admin
      )
    ) {
      throw new UnauthorizedException();
    }

    await this.onetimeInviteRepository.delete(inviteId);
  }

  async createOnetimeInviteRequest(
    body: CreateOnetimeInviteRequestDto,
    userId: number,
  ) {
    const {
      invitingUserId: providedInvitingUserId,
      communityId,
      ...rest
    } = body;

    const user = await this.findOneOrFail(userId, ['communities']);
    const isAdmin = user.admin;
    let community: Community | undefined | null = user.communities.find(
      (community) => community.id === communityId,
    );
    if (!community) {
      if (!isAdmin) {
        throw new UnauthorizedException(
          `User is not a member of community ${communityId}`,
        );
      }
      community = await this.communityRepository.findOne({
        where: { id: communityId },
      });
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
    }

    const invitingUserId =
      (isAdmin ? providedInvitingUserId : undefined) ?? userId;
    const invitingUser =
      userId === invitingUserId
        ? user
        : await this.findOneOrFail(invitingUserId);

    const savedRequest = await this.onetimeInviteRequestRepository.save(
      this.onetimeInviteRequestRepository.create({
        ...rest,
        invitingUser,
        community,
      }),
    );

    sendNotificationToLeaders: {
      const communityWithLeaders = await this.communityRepository.findOne({
        where: { id: communityId },
        relations: ['leaders'],
      });
      if (!communityWithLeaders || !communityWithLeaders.leaders) {
        console.log('Community leaders not found for community', communityId);
        break sendNotificationToLeaders;
      }
      for (const leader of communityWithLeaders.leaders) {
        const notif = this.notifRepository.create({
          user: leader,
          category: NotificationCategory.OnetimeInviteRequestCreated,
          message: `${invitingUser.name} has requested a new member to join the Alliance`,
          webAppLocation: groupInvitesUrl(),
          associatedUsers: [invitingUser],
          onetimeInviteRequest: savedRequest,
        });
        this.notifRepository.save(notif);
      }
    }

    return savedRequest;
  }

  async approveOnetimeInviteRequest(
    requestId: number,
    userId: number,
  ): Promise<OnetimeInvite> {
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    const isAdmin = user.admin;

    const request = await this.onetimeInviteRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: ['invitingUser', 'community'],
    });

    if (request.status === 'approved') {
      throw new BadRequestException('Request already approved');
    }

    const community: Community = request.community;
    if (!isAdmin && !user.leaderOf.some((c) => c.id === community.id)) {
      throw new UnauthorizedException(
        `User is not a leader of community ${community.id}`,
      );
    }

    request.status = OnetimeInviteRequestStatus.APPROVED;
    await this.onetimeInviteRequestRepository.save(request);

    const code = Math.random().toString(36).substring(2, 15);

    const invite = await this.onetimeInviteRepository.save(
      this.onetimeInviteRepository.create({
        ...request,
        code,
      }),
    );

    this.notifRepository.save(
      this.notifRepository.create({
        user: invite.invitingUser,
        category: NotificationCategory.OnetimeInviteRequestApproved,
        message: `Your request to invite ${invite.invitee} has been approved`,
        webAppLocation: groupInvitesUrl(),
      }),
    );

    return invite;
  }

  async rejectOnetimeInviteRequest(
    requestId: number,
    userId: number,
  ): Promise<void> {
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    const isAdmin = user.admin;

    const request = await this.onetimeInviteRequestRepository.findOneOrFail({
      where: { id: requestId },
      relations: ['invitingUser', 'community'],
    });

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Request has already been ${request.status}`,
      );
    }

    const community: Community = request.community;
    if (!isAdmin && !user.leaderOf.some((c) => c.id === community.id)) {
      throw new UnauthorizedException(
        `User is not a leader of community ${community.id}`,
      );
    }

    request.status = OnetimeInviteRequestStatus.REJECTED;
    const savedRequest =
      await this.onetimeInviteRequestRepository.save(request);

    await this.notifRepository.save(
      this.notifRepository.create({
        user: savedRequest.invitingUser,
        category: NotificationCategory.OnetimeInviteRequestRejected,
        message: `Your request to invite ${request.invitee} has been rejected`,
        webAppLocation: groupInvitesUrl(),
      }),
    );
  }

  async deleteCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: ['invitingUser', 'community'],
    });
    const user = await this.findOneOrFail(userId, ['leaderOf']);
    if (
      !(
        invite.invitingUser?.id === userId ||
        user.leaderOf.some((leader) => leader.id === invite.community?.id) ||
        user.admin
      )
    ) {
      throw new UnauthorizedException();
    }
    await this.communityInviteRepository.delete(inviteId);
  }

  async findValidInviteByCode(code: string): Promise<OnetimeInvite | null> {
    return this.onetimeInviteRepository.findOne({
      where: { code, isValid: true },
      relations: ['invitingUser', 'community'],
    });
  }

  async findAllOnetimeInvites(): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      relations: ['invitingUser', 'community'],
    });
  }

  async findOnetimeInvites(communityId: number): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: { community: { id: communityId } },
      relations: ['invitingUser'],
    });
  }

  async findOnetimeInvitesByRequester(
    userId: number,
    communityId: number,
  ): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: { invitingUser: { id: userId }, community: { id: communityId } },
    });
  }

  async findOnetimeInviteRequests(
    communityId: number,
  ): Promise<OnetimeInviteRequest[]> {
    return this.onetimeInviteRequestRepository.find({
      where: { community: { id: communityId } },
      relations: ['invitingUser', 'community'],
    });
  }

  async findOnetimeInviteRequestsByRequester(
    userId: number,
    communityId: number,
  ): Promise<OnetimeInviteRequest[]> {
    return this.onetimeInviteRequestRepository.find({
      where: { invitingUser: { id: userId }, community: { id: communityId } },
      relations: ['invitingUser'],
    });
  }

  async invalidateInvite(inviteId: number): Promise<void> {
    await this.onetimeInviteRepository.update(inviteId, { isValid: false });
  }

  async createCommunityInvite(
    body: CreateCommunityInviteDto,
    userId: number,
  ): Promise<CommunityInvite> {
    const { invitedUserId, communityId } = body;

    const invitedUser = await this.findOneOrFail(invitedUserId);
    const community = await this.findCommunityOrFail(communityId);
    const invitingUser = await this.findOneLeaderOrFail(userId, communityId);

    const existingInvites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: invitedUserId },
        community: { id: communityId },
      },
    });
    if (
      existingInvites.some(
        (invite) => invite.status === CommunityInviteStatus.Pending,
      )
    ) {
      throw new BadRequestException(
        'User has already been invited to this community',
      );
    }

    const invite = this.communityInviteRepository.create({
      invitedUser,
      community,
      invitingUser,
    });

    return this.communityInviteRepository.save(invite);
  }

  async findCommunityInvites(
    communityId: number,
  ): Promise<CommunityInviteDto[]> {
    const invites = await this.communityInviteRepository.find({
      where: { community: { id: communityId } },
      relations: ['invitedUser', 'invitingUser'],
    });
    return invites.map((invite) => new CommunityInviteDto(invite));
  }

  async findCommunityInvitesForUser(
    userId: number,
  ): Promise<CommunityInviteDto[]> {
    const invites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: userId },
        status: CommunityInviteStatus.Pending,
      },
      relations: ['invitingUser', 'community'],
    });
    return invites.map((invite) => new CommunityInviteDto(invite));
  }

  async acceptCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: ['invitedUser', 'invitingUser', 'community'],
    });
    if (invite.invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.Pending) {
      throw new BadRequestException();
    }

    invite.status = CommunityInviteStatus.Accepted;
    await this.communityInviteRepository.save(invite);

    const community = await this.findCommunityOrFail(invite.community.id, [
      'users',
    ]);

    if (community.users!.some((user) => user.id === invite.invitedUser.id)) {
      throw new BadRequestException();
    }

    community.users!.push(invite.invitedUser);
    await this.communityRepository.save(community);

    const notif = this.notifRepository.create({
      user: invite.invitingUser,
      category: NotificationCategory.CommunityInviteAccepted,
      message: `${invite.invitedUser?.name} has joined your community`,
      webAppLocation: groupInvitesUrl(),
      associatedUsers: [invite.invitedUser],
    });
    await this.notifRepository.save(notif);
  }

  async rejectCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: ['invitedUser', 'invitingUser'],
    });
    if (invite.invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.Pending) {
      throw new BadRequestException();
    }
    invite.status = CommunityInviteStatus.Rejected;
    await this.communityInviteRepository.save(invite);

    const notif = this.notifRepository.create({
      user: invite.invitingUser,
      category: NotificationCategory.CommunityInviteRejected,
      message: `${invite.invitedUser?.name} declined your community invitation`,
      webAppLocation: groupInvitesUrl(),
      associatedUsers: [invite.invitedUser],
    });
    await this.notifRepository.save(notif);
  }

  async leaveCommunity(communityId: number, userId: number): Promise<void> {
    const user = await this.findOneOrFail(userId, ['communities']);
    if (!user.communities?.some((community) => community.id === communityId)) {
      throw new BadRequestException();
    }
    user.communities = user.communities.filter(
      (community) => community.id !== communityId,
    );
    await this.userRepository.save(user);
  }
}
