import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
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
import { DeepPartial, ILike, In, Not, Repository } from 'typeorm';
import { Friend, FriendStatus } from './entities/friend.entity';
import { PrefillUser } from './entities/prefill-user.entity';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
} from './dto/user.dto';
import { User } from './entities/user.entity';
import { groupInvitesUrl, profileUrl } from 'src/search/approutes';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/tag.dto';
import { Community } from './entities/community.entity';
import { CreateCommunityDto, UpdateCommunityDto } from './community.dto';
import { CommunityMemberContactInfoDto } from './dto/user-action-relations.dto';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from './entities/onetime-invite.entity';
import {
  CommunityInviteDto,
  CreateCommunityInviteDto,
  CreateOnetimeInviteDto,
  RequestOnetimeInviteDto,
} from './dto/invite.dto';
import {
  UserAwayRange,
  UserAwayRangeReason,
} from './entities/user-away-range.entity';
import {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from './dto/away-range.dto';
import { Temporal } from '@js-temporal/polyfill';
import {
  CommunityInvite,
  CommunityInviteStatus,
} from './entities/community-invite.entity';
import { ConversationService } from 'src/messaging/conversation.service';
import {
  ContractEvent,
  ContractEventType,
} from './entities/contract-event.entity';
import { Relations } from 'src/utils/Repository';
import { RegisterDeviceDto, UserDeviceDto } from './dto/device.dto';
import { UserDevice } from './entities/user-device.entity';
import { PushService } from 'src/push/push.service';
import { Push } from 'src/push/push.entity';

const defaultTimeZone = 'America/Los_Angeles';
const COMMUNITY_DEFAULT_RELATIONS: Readonly<Relations<Community>> =
  Object.freeze({
    users: true,
    leaders: true,
  });

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
    @InjectRepository(UserAwayRange)
    private readonly userAwayRangeRepository: Repository<UserAwayRange>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(CommunityInvite)
    private readonly communityInviteRepository: Repository<CommunityInvite>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly conversationService: ConversationService,
    private readonly pushService: PushService,
  ) {}

  async create(data: DeepPartial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cityId, profilePicture, ...updateData } = data;

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
    return this.userRepository.find({
      relations,
    });
  }

  findAllWithFriendRequests(): Promise<User[]> {
    return this.userRepository.find({
      relations: {
        sentFriendRequests: { addressee: true },
        receivedFriendRequests: { requester: true },
        contractEvents: true,
      },
    });
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
    const user = await this.findOneByEmail(email);
    return user?.isCommunityLeader ?? false;
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
      relations: { requester: true, addressee: true },
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
      relations: { requester: true, addressee: true },
    });

    const others = rels.map((r) =>
      r.requester.id === userId ? r.addressee : r.requester,
    );

    return others.map((o) => new ProfileDto(o));
  }

  async findMessageableUsers(userId: number): Promise<ProfileDto[]> {
    const user = await this.findOneOrFail(userId, {
      communities: true,
      leaderOf: true,
    });

    // Staff can message everyone
    if (user.staff) {
      const allUsers = await this.userRepository.find({
        where: { id: Not(userId) },
      });
      return allUsers.map((u) => new ProfileDto(u));
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
      r.requester.id === userId ? r.addressee : r.requester,
    );

    const byId = new Map<number, User>();
    for (const u of [...staff, ...communityUsers, ...friends]) {
      if (u?.id && u.id !== userId) byId.set(u.id, u);
    }

    return [...byId.values()].map((o) => new ProfileDto(o));
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
            relations: { addressee: true },
          })
        : await this.friendRepository.find({
            where: { addressee: { id: userId }, status: FriendStatus.Pending },
            relations: { requester: true },
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
        status === FriendStatus.Pending && rel?.addressee.id === userId,
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
    return user?.referredUsers.length ?? 0;
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
      relations: { tags: true, awayRanges: true, contractEvents: true },
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

  async signContract(userId: number): Promise<Date> {
    const user = await this.findOneOrFail(userId, { contractEvents: true });
    if (user.hasActiveContract) {
      throw new BadRequestException('Member already has an active contract.');
    }
    const contractEvent = this.contractEventRepository.create({
      user,
      type: ContractEventType.SIGNED,
      date: new Date(),
    });
    await this.contractEventRepository.save(contractEvent);
    return contractEvent.date;
  }

  async suspendContract(
    userId: number,
    automatic: boolean = false,
    autoSuspendKey?: string,
  ): Promise<Date> {
    const user = await this.findOneOrFail(userId, { contractEvents: true });
    if (!user.hasActiveContract) {
      throw new BadRequestException('Member does not have an active contract.');
    }
    const contractEvent = this.contractEventRepository.create({
      user,
      type: ContractEventType.SUSPENDED,
      date: new Date(),
      automatic,
      autoSuspendKey,
    });
    await this.contractEventRepository.save(contractEvent);
    return contractEvent.date;
  }

  private validateAwayRange(
    startDate: Date,
    endDate: Date,
    reason: UserAwayRangeReason,
    note?: string,
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
      startDate.getTime() + 1000 * 60 * 60 * 24 < now.getTime()
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
    const startDay = Temporal.PlainDate.from(data.startDay);
    const endDay = Temporal.PlainDate.from(data.endDay);
    const user = await this.findOneOrFail(userId);
    const tz = user.timeZone ?? defaultTimeZone;

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

    this.validateAwayRange(startDate, endDate, reason, data.note);

    const awayRange = this.userAwayRangeRepository.create({
      userId,
      startDate,
      endDate,
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
    const tz = user.timeZone ?? defaultTimeZone;

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

  isUserAwayAt(user: User, checkDate: Date): boolean {
    return user.awayRanges.some(
      (range) => checkDate >= range.startDate && checkDate <= range.endDate,
    );
  }

  isUserAwayInRange(
    user: User,
    range: { startDate: Date; endDate?: Date },
  ): boolean {
    return user.awayRanges.some(
      (awayRange) =>
        !(
          (range.endDate && range.endDate <= awayRange.startDate) ||
          range.startDate >= awayRange.endDate
        ),
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

  async findCommunityOrFail(
    id: number,
    relations?: Relations<Community>,
  ): Promise<Community> {
    return this.communityRepository.findOneOrFail({
      where: { id },
      relations: relations ?? COMMUNITY_DEFAULT_RELATIONS,
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
      relations: COMMUNITY_DEFAULT_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  async updateCommunity(
    communityId: number,
    body: UpdateCommunityDto,
    userId: number,
  ): Promise<Community> {
    const user = await this.findOneOrFail(userId);
    if (!user.leaderOfIds.some((cid) => cid === communityId) && !user.admin) {
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
    const user = await this.findOneOrFail(userId, { communities: true });
    const communityId =
      user.communities.length > 0 ? user.communities[0].id : null;

    if (!communityId) {
      return null;
    }

    return this.findCommunityOrFail(communityId, {
      users: {
        contractEvents: true,
      },
      leaders: true,
    });
  }

  async findCommunityForUserOrFail(
    userId: number,
    relations?: Relations<Community>,
  ): Promise<Community> {
    const user = await this.findOneOrFail(userId, {
      communities: relations ?? true,
    });
    const community = user.communities.length > 0 ? user.communities[0] : null;
    if (!community) {
      throw new NotFoundException('User is not a member of any community.');
    }
    return community;
  }

  async findUserIdsForCommunity(communityId: number): Promise<number[]> {
    const community = await this.findCommunityOrFail(communityId, {
      users: true,
    });
    const userIds = community.users!.map((user) => user.id);
    return userIds;
  }

  async getMemberContactInfoByCommunityId(
    communityId: number,
  ): Promise<CommunityMemberContactInfoDto[]> {
    const userIds = await this.findUserIdsForCommunity(communityId);
    if (userIds.length === 0) {
      return [];
    }
    return this.getMemberContactInfo(userIds[0]);
  }

  async getAllMemberContactInfo(): Promise<CommunityMemberContactInfoDto[]> {
    const users = await this.userRepository.find({
      relations: ['awayRanges'],
    });

    return users.map((user) => {
      const awayRanges: UserAwayRangeDto[] = (user.awayRanges ?? [])
        .slice()
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .map((awayRange) =>
          Object.assign(new UserAwayRangeDto(), {
            id: awayRange.id,
            startDate: awayRange.startDate,
            endDate: awayRange.endDate,
            createdAt: awayRange.createdAt,
            reason: awayRange.reason,
            note: awayRange.note,
          }),
        );

      return new CommunityMemberContactInfoDto(
        user,
        'America/Los_Angeles',
        awayRanges,
      );
    });
  }

  async getMemberContactInfo(
    userId: number,
  ): Promise<CommunityMemberContactInfoDto[]> {
    const leader = await this.findOneOrFail(userId);
    const community = await this.findCommunityForUserOrFail(userId);
    const userIds = await this.findUserIdsForCommunity(community.id);
    const users = await this.userRepository.find({
      where: { id: In(userIds) },
      relations: { awayRanges: true },
    });
    return users.map((user) => {
      const awayRanges: UserAwayRangeDto[] = (user.awayRanges ?? [])
        .slice()
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .map((awayRange) =>
          Object.assign(new UserAwayRangeDto(), {
            id: awayRange.id,
            startDate: awayRange.startDate,
            endDate: awayRange.endDate,
            createdAt: awayRange.createdAt,
            reason: awayRange.reason,
            note: awayRange.note,
          }),
        );

      return new CommunityMemberContactInfoDto(
        user,
        leader.timeZone,
        awayRanges,
      );
    });
  }

  async createTag(body: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create(body);
    return this.tagRepository.save(tag);
  }

  async findAllTags(): Promise<Tag[]> {
    return this.tagRepository.find({ relations: { users: true } });
  }

  async findTagByName(name: string): Promise<Tag | null> {
    return this.tagRepository.findOne({ where: { name } });
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

    const user = await this.findOneOrFail(userId, { leaderOf: true });
    const isAdmin = user.admin;

    // Normal users cannot create invites from other users
    const invitingUserId =
      (isAdmin ? providedInvitingUserId : undefined) ?? userId;

    let community: Community | undefined;

    if (isAdmin) {
      if (communityId) {
        community = await this.communityRepository.findOneOrFail({
          where: { id: communityId },
        });
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
      status: OnetimeInviteStatus.LINK_UNUSED,
    });
    return await this.onetimeInviteRepository.save(invite);
  }

  async deleteOnetimeInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId },
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
      throw new UnauthorizedException();
    }

    await this.onetimeInviteRepository.delete(inviteId);
  }

  async requestOnetimeInvite(body: RequestOnetimeInviteDto, userId: number) {
    const { communityId, ...rest } = body;

    const user = await this.findOneOrFail(userId, { communities: true });
    const community: Community | undefined = user.communities.find(
      (community) => community.id === communityId,
    );
    if (!community) {
      throw new UnauthorizedException(
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
      for (const leader of communityWithLeaders.leaders) {
        const notif = this.notifRepository.create({
          user: leader,
          category: NotificationCategory.OnetimeInviteRequestCreated,
          message: `${user.name} requested an invite for ${rest.invitee}`,
          webAppLocation: groupInvitesUrl(),
          associatedUsers: [user],
          onetimeInvite: savedInvite,
        });
        this.notifRepository.save(notif);
      }
    }

    return savedInvite;
  }

  async approveOnetimeInvite(
    inviteId: number,
    userId: number,
  ): Promise<OnetimeInvite> {
    return this.approveOrRejectOnetimeInvite({
      inviteId,
      userId,
      newStatus: 'approve',
      message: `Your request to invite [USER] was approved`,
    });
  }

  async rejectOnetimeInvite(inviteId: number, userId: number): Promise<void> {
    await this.approveOrRejectOnetimeInvite({
      inviteId,
      userId,
      newStatus: 'reject',
      message: 'Your request to invite [USER] was rejected',
    });
  }

  async approveOrRejectOnetimeInvite(params: {
    userId: number;
    inviteId: number;
    newStatus: 'approve' | 'reject';
    message: `${string}[USER]${string}`;
  }): Promise<OnetimeInvite> {
    const { userId, inviteId, newStatus, message } = params;

    const user = await this.findOneOrFail(userId);

    const request = await this.onetimeInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: { invitingUser: true },
    });

    if (request.status === OnetimeInviteStatus.REQUEST_REJECTED) {
      throw new BadRequestException(`Request has already been rejected`);
    }
    if (
      request.status === OnetimeInviteStatus.LINK_UNUSED ||
      request.status === OnetimeInviteStatus.LINK_USED
    ) {
      throw new BadRequestException(`Request has already been approved`);
    }
    if (request.status !== OnetimeInviteStatus.REQUEST_PENDING) {
      request.status satisfies never;
      throw new InternalServerErrorException(
        `Unhandled status: ${request.status}`,
      );
    }

    if (!user.leaderOfIds.some((cid) => cid === request.communityId)) {
      throw new UnauthorizedException(
        `User is not a leader of community ${request.communityId}`,
      );
    }

    request.status =
      newStatus === 'approve'
        ? OnetimeInviteStatus.LINK_UNUSED
        : OnetimeInviteStatus.REQUEST_REJECTED;
    const savedInvite = await this.onetimeInviteRepository.save(request);

    await this.notifRepository.save(
      this.notifRepository.create({
        user: savedInvite.invitingUser,
        category:
          newStatus === 'approve'
            ? NotificationCategory.OnetimeInviteRequestApproved
            : NotificationCategory.OnetimeInviteRequestRejected,
        message: message.replace('[USER]', savedInvite.invitee),
        webAppLocation: groupInvitesUrl(),
      }),
    );

    return savedInvite;
  }

  async deleteCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: { invitingUser: true, community: true },
    });
    const user = await this.findOneOrFail(userId, { leaderOf: true });
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

  async findInviteByCode(code: string): Promise<OnetimeInvite | null> {
    return this.onetimeInviteRepository.findOne({
      where: { code },
      relations: { invitingUser: true, community: true },
    });
  }

  async findAllOnetimeInvites(): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      relations: { invitingUser: true, community: true },
    });
  }

  async findOnetimeInvites(communityId: number): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: { community: { id: communityId } },
      relations: { invitingUser: true },
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

  async invalidateInvite(inviteId: number): Promise<void> {
    await this.onetimeInviteRepository.update(inviteId, {
      status: OnetimeInviteStatus.LINK_USED,
    });
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
      relations: { invitedUser: true, invitingUser: true },
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
      relations: { invitingUser: true, community: true },
    });
    return invites.map((invite) => new CommunityInviteDto(invite));
  }

  async acceptCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId },
      relations: { invitedUser: true, invitingUser: true, community: true },
    });
    if (invite.invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.Pending) {
      throw new BadRequestException();
    }

    invite.status = CommunityInviteStatus.Accepted;
    await this.communityInviteRepository.save(invite);

    const community = await this.findCommunityOrFail(invite.community.id, {
      users: true,
    });

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
      relations: { invitedUser: true, invitingUser: true },
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
    const user = await this.findOneOrFail(userId, { communities: true });
    if (!user.communities?.some((community) => community.id === communityId)) {
      throw new BadRequestException();
    }
    user.communities = user.communities.filter(
      (community) => community.id !== communityId,
    );
    await this.userRepository.save(user);
  }

  async getAllUserIds(): Promise<number[]> {
    return this.userRepository
      .find({ select: ['id'] })
      .then((users) => users.map((user) => user.id));
  }

  async registerDevice(
    userId: number,
    body: RegisterDeviceDto,
  ): Promise<UserDeviceDto> {
    const user = await this.findOneOrFail(userId, { devices: true });
    if (body.deviceId) {
      const existingDevice = await this.userDeviceRepository.findOne({
        where: { id: body.deviceId, user: { id: userId } },
      });
      if (existingDevice) {
        this.userDeviceRepository.update(existingDevice.id, {
          expoPushToken: body.expoPushToken,
        });
        return existingDevice;
      }
    }

    const device = this.userDeviceRepository.create({
      deviceType: body.deviceType,
      expoPushToken: body.expoPushToken,
      user,
    });
    const savedDevice = await this.userDeviceRepository.save(device);
    return savedDevice;
  }

  async testPushNotification(userId: number, message: string): Promise<Push> {
    const user = await this.findOneOrFail(userId, { devices: true });
    const device = user.devices?.[0];
    if (!device || !device.expoPushToken) {
      throw new BadRequestException('User has no expo push token');
    }
    return this.pushService.sendPushNotification(device.expoPushToken, message);
  }
}
