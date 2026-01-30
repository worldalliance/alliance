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
  NotifPriority,
} from 'src/notifs/entities/notification.entity';
import { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import { DeepPartial, ILike, In, IsNull, Not, Repository } from 'typeorm';
import { Friend, FriendStatus } from './entities/friend.entity';
import { PrefillUser } from './entities/prefill-user.entity';
import {
  AssignGroupsDto,
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
} from './dto/user.dto';
import { User } from './entities/user.entity';
import { groupUrl, profileUrl } from 'src/search/approutes';
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
  RequestCommunityInviteDto,
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
import { run } from 'src/utils/promise';
import { SlackService } from 'src/slack/slack.service';

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
    private readonly slackService: SlackService,
  ) { }

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

  async findOneByReferralCode(
    referralCode: string,
    relations?: Relations<User>,
  ): Promise<User | null> {
    return this.userRepository.findOne({ where: { referralCode }, relations });
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
        priority: NotifPriority.High,
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

  async setOptInMms(userId: number, mmsId: number) {
    await this.userRepository.update(userId, { optInMms: { id: mmsId } });
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

    await this.slackService.sendMessage(
      `${user.name} signed their contract :)`,
    );

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

    if (!automatic) {
      await this.slackService.sendMessage(
        `${user.name} suspended their contract :(`,
      );
    }

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

  async createCommunityAdmin(body: CreateCommunityDto): Promise<Community> {
    const community = this.communityRepository.create(body);
    const savedCommunity = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(
      savedCommunity.id,
    );
    return savedCommunity;
  }

  async createCommunity(
    userId: number,
    body: CreateCommunityDto,
  ): Promise<Community> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    if (user.isIntroductoryGroupMember) {
      throw new UnauthorizedException(
        'Introductory group members cannot create communities',
      );
    }
    if (body.name.trim().length === 0) {
      throw new BadRequestException('Name cannot be empty');
    }

    const community = this.communityRepository.create({
      ...body,
      name: body.name.trim(),
      leaders: [user],
      users: [user],
    });
    const savedCommunity = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(
      savedCommunity.id,
    );
    return savedCommunity;
  }

  async findAllCommunities(): Promise<Community[]> {
    const communities = await this.communityRepository.find({
      relations: COMMUNITY_DEFAULT_RELATIONS,
    });
    return communities.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findPublicCommunities(): Promise<Community[]> {
    const communities = await this.communityRepository.find({
      where: {
        public: true,
      },
      relations: COMMUNITY_DEFAULT_RELATIONS,
    });
    return communities.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findUserCommunityWithCapacity(user: User): Promise<Community | null> {
    const communities = await this.communityRepository.find({
      where: {
        maxCapacity: Not(IsNull()),
        id: In(user.communities.map((c) => c.id)),
      },
      relations: {
        users: true,
      },
    });
    if (!communities) {
      return null;
    }
    for (const community of communities) {
      if (community.users.length < community.maxCapacity!) {
        return community;
      }
    }
    return null;
  }

  async joinPublicCommunity(
    userId: number,
    communityId: number,
  ): Promise<Community> {
    const community = await this.communityRepository.findOneOrFail({
      where: {
        id: communityId,
        public: true,
      },
      relations: {
        users: true,
        leaders: true,
      },
    });

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
      relations: {
        communities: { leaders: true },
      },
    });

    if (community.users.some((existing) => existing.id === userId)) {
      throw new BadRequestException(
        'User is already a member of this community',
      );
    }

    if (community.users.length >= community.maxCapacity!) {
      throw new BadRequestException('Community is full');
    }

    const updatedCommunities: Community[] = [];
    user.communities = user.communities.filter((existing) => {
      const keep =
        existing.id === community.id || user.leaderOfIdSet.has(existing.id);
      if (!keep) {
        updatedCommunities.push(existing);
      }
      return keep;
    });
    user.communities.push(community);
    user.undergoingGroupAssignment = false;

    const notifs = community.leaders!.map((leader) =>
      this.notifRepository.create({
        user: leader,
        category: NotificationCategory.MemberJoinedCommunity,
        message: `${user.name} joined your public group (${community.name})`,
        webAppLocation: groupUrl({
          tab: 'members',
          communityId: community.id,
        }),
        associatedUsers: [user],
      }),
    );

    notifs.push(
      ...updatedCommunities.flatMap((c) =>
        (c.leaders ?? []).map((leader) =>
          this.notifRepository.create({
            user: leader,
            category: NotificationCategory.MemberLeftCommunity,
            message: `${user.name} left your group (${c.name})`,
            webAppLocation: groupUrl({
              tab: 'members',
              communityId: c.id,
            }),
            associatedUsers: [user],
          }),
        ),
      ),
    );

    await this.userRepository.save(user);

    await Promise.all([
      this.conversationService.syncCommunityConversationMembers(community.id),
      ...updatedCommunities.map((c) =>
        this.conversationService.syncCommunityConversationMembers(c.id),
      ),
      this.notifRepository.save(notifs),
    ]);

    return community;
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
    community.name = community.name.trim();
    if (community.name.length === 0) {
      throw new BadRequestException('Name cannot be empty');
    }
    const updated = await this.communityRepository.save(community);
    await this.conversationService.syncCommunityConversationMembers(updated.id);
    return updated;
  }

  async deleteCommunityAdmin(communityId: number): Promise<void> {
    await this.communityRepository.delete(communityId);
  }

  async deleteCommunity(userId: number, communityId: number): Promise<void> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId, communities: { id: communityId } },
      relations: { communities: { users: true } },
    });
    if (!user.leaderOfIds.some((cid) => cid === communityId)) {
      throw new UnauthorizedException();
    }
    if (!user.communities.length) {
      throw new NotFoundException();
    }
    if (user.communities.length !== 1) {
      throw new InternalServerErrorException('Multiple communities found');
    }
    const community = user.communities[0];
    if (community.users.some((user) => user.id !== userId)) {
      throw new UnauthorizedException(
        'User cannot delete community with other members',
      );
    }
    await this.communityRepository.delete(communityId);
  }

  async addUserToCommunity(params: {
    communityId: number;
    userId: number;
    sendNotif: boolean;
  }): Promise<Community> {
    const { communityId, userId, sendNotif } = params;

    const [community, user] = await Promise.all([
      this.findCommunityOrFail(communityId),
      this.findOneOrFail(userId),
    ]);

    community.users = community.users ?? [];
    if (!community.users.some((existing) => existing.id === userId)) {
      community.users.push(user);
    }

    const notifs: Notification[] = sendNotif
      ? community.leaders!.map((leader) =>
        this.notifRepository.create({
          user: leader,
          category: NotificationCategory.MemberJoinedCommunity,
          message: `${user.name} joined your group (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'members',
            communityId: community.id,
          }),
          associatedUsers: [user],
        }),
      )
      : [];

    const updatedP = this.communityRepository.save(community);
    await Promise.all([
      this.notifRepository.save(notifs),
      updatedP.then((updated) =>
        this.conversationService.syncCommunityConversationMembers(updated.id),
      ),
    ]);

    return await updatedP;
  }

  async removeUserFromCommunity(params: {
    userId: number;
    removeeId: number;
    communityId: number;
  }) {
    const { userId, removeeId, communityId } = params;

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    if (!user.leaderOfIdSet.has(communityId)) {
      throw new UnauthorizedException();
    }
    const community = await this.removeUserFromCommunityAdmin(
      communityId,
      removeeId,
    );

    const removee = await this.userRepository.findOneOrFail({
      where: { id: removeeId },
    });
    const notif = this.notifRepository.create({
      user: removee,
      category: NotificationCategory.RemovedFromCommunity,
      message: `${user.name} removed you from their group (${community.name})`,
      webAppLocation: groupUrl({
        tab: 'groups',
      }),
      associatedUsers: [user],
    });
    await this.notifRepository.save(notif);

    return community;
  }

  async removeUserFromCommunityAdmin(
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

  async findUserCommunities(userId: number): Promise<Community[]> {
    const user = await this.findOneOrFail(userId, { communities: true });

    const communities = await this.communityRepository.find({
      where: { id: In(user.communities.map((c) => c.id)) },
      relations: {
        users: {
          contractEvents: true,
        },
        leaders: true,
      },
    });
    function leaderKey(community: Community) {
      return (community.leaders?.some((leader) => leader.id === userId) ??
        false)
        ? 0
        : 1;
    }
    return communities.sort((a, b) => leaderKey(a) - leaderKey(b));
  }

  async findOneCommunityWithUserOrFail(
    communityId: number,
    userId: number,
    relations?: Relations<Community>,
  ): Promise<Community> {
    const community = await this.communityRepository.findOneOrFail({
      where: { id: communityId },
      relations: relations ?? {
        users: true,
      },
    });
    if (!community.users.some((user) => user.id === userId)) {
      throw new NotFoundException('User is not a member of this community');
    }
    return community;
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

    const userP = this.findOneOrFail(userId, { leaderOf: true });
    const communityP =
      communityId !== undefined
        ? this.communityRepository.findOneOrFail({
          where: { id: communityId },
        })
        : undefined;

    const user = await userP;
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
      throw new UnauthorizedException();
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
          message: `${user.name} requested an invite for ${rest.invitee} (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'invites',
            communityId: community.id,
          }),
          associatedUsers: [user],
          onetimeInvite: savedInvite,
        });
        this.notifRepository.save(notif);
      }
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
      throw new UnauthorizedException(
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

    await this.notifRepository.save(
      this.notifRepository.create({
        user: savedInvite.invitingUser,
        category,
        message: message.replace('[USER]', savedInvite.invitee),
        webAppLocation: groupUrl({
          tab: 'invites',
          communityId: savedInvite.communityId,
        }),
        associatedUsers: [savedInvite.invitingUser],
      }),
    );

    return savedInvite;
  }

  async deleteCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
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
    await this.communityInviteRepository.update(inviteId, {
      deletedAt: new Date(),
    });
  }

  async findInviteByCode(
    code: string,
    relations?: Relations<OnetimeInvite>,
  ): Promise<OnetimeInvite | null> {
    return this.onetimeInviteRepository.findOne({
      where: { code, deletedAt: IsNull() },
      relations: relations ?? {
        invitingUser: true,
        community: true,
      },
    });
  }

  async findAllOnetimeInvites(): Promise<OnetimeInvite[]> {
    return this.onetimeInviteRepository.find({
      where: { deletedAt: IsNull() },
      relations: { invitingUser: true, community: true },
    });
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
        invitingUser: true,
        community: true,
      },
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
        deletedAt: IsNull(),
      },
    });
    if (
      existingInvites.some(
        (invite) => invite.status === CommunityInviteStatus.InviteePending,
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
      status: CommunityInviteStatus.InviteePending,
    });
    const notif = this.notifRepository.create({
      user: invitedUser,
      category: NotificationCategory.CommunityInviteCreated,
      message: `${invitingUser.name} invited you to join their group (${community.name})`,
      webAppLocation: groupUrl({
        tab: 'groups',
      }),
      associatedUsers: [invitingUser],
    });

    const [savedInvite] = await Promise.all([
      this.communityInviteRepository.save(invite),
      this.notifRepository.save(notif),
    ]);
    return savedInvite;
  }

  async requestCommunityInvite(
    body: RequestCommunityInviteDto,
    userId: number,
  ): Promise<CommunityInvite> {
    const { communityId, invitedUserId } = body;

    const invitingUserP = this.userRepository.findOneOrFail({
      where: { id: userId, communities: { id: communityId } },
    });
    const invitedUserP = this.userRepository
      .findOneOrFail({
        where: { id: invitedUserId },
        relations: {
          communities: true,
        },
      })
      .then((user) => {
        if (user.communities.some((c) => c.id === communityId)) {
          throw new BadRequestException(
            'Invited user is already a member of the community',
          );
        }
        return user;
      });
    const communityP = this.findCommunityOrFail(communityId);

    const existingInvites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: invitedUserId },
        community: { id: communityId },
        deletedAt: IsNull(),
      },
    });
    if (
      existingInvites.some(
        (invite) =>
          invite.status === CommunityInviteStatus.RequestPending ||
          invite.status === CommunityInviteStatus.InviteePending,
      )
    ) {
      throw new BadRequestException(
        'This user already has a pending invite to this community.',
      );
    }

    const invitedUser = await invitedUserP;
    const invitingUser = await invitingUserP;
    const community = await communityP;
    const invite = this.communityInviteRepository.create({
      invitedUser,
      community,
      invitingUser,
      status: CommunityInviteStatus.RequestPending,
    });
    const savedInvite = await this.communityInviteRepository.save(invite);

    sendNotificationToLeaders: {
      const communityWithLeaders = await this.communityRepository.findOne({
        where: { id: communityId },
        relations: { leaders: true },
      });
      if (!communityWithLeaders?.leaders?.length) {
        break sendNotificationToLeaders;
      }
      const notifs = communityWithLeaders.leaders.map((leader) =>
        this.notifRepository.create({
          user: leader,
          category: NotificationCategory.CommunityInviteRequestCreated,
          message: `${invitingUser.name} requested an invite for ${invitedUser.name} (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'invites',
            communityId: community.id,
          }),
          associatedUsers: [invitingUser, invitedUser],
        }),
      );
      await this.notifRepository.save(notifs);
    }

    return savedInvite;
  }

  async approveCommunityInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<CommunityInvite> {
    const userP = this.findOneOrFail(userId);
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitingUser: true, invitedUser: true, community: true },
    });

    if (invite.status !== CommunityInviteStatus.RequestPending) {
      throw new BadRequestException(
        `Invite is not a pending request. Status: ${JSON.stringify(
          invite.status,
        )}`,
      );
    }

    const user = await userP;
    if (!user.leaderOfIds.some((cid) => cid === invite.community.id)) {
      throw new UnauthorizedException(
        `User is not a leader of community ${invite.community.id}`,
      );
    }

    invite.status = CommunityInviteStatus.InviteePending;
    const savedInvite = await this.communityInviteRepository.save(invite);

    const notifs = [
      this.notifRepository.create({
        user: invite.invitedUser,
        category: NotificationCategory.CommunityInviteCreated,
        message: `${invite.invitingUser?.name ?? user.name} invited you to join their group (${invite.community.name})`,
        webAppLocation: groupUrl({
          tab: 'groups',
        }),
        associatedUsers: [invite.invitingUser ?? user],
      }),
      ...(invite.invitingUser
        ? [
          this.notifRepository.create({
            user: invite.invitingUser,
            category: NotificationCategory.CommunityInviteCreated,
            message: `Your request to invite ${invite.invitedUser.name} was approved`,
            webAppLocation: groupUrl({
              tab: 'groups',
              communityId: invite.community.id,
            }),
            associatedUsers: [],
          }),
        ]
        : []),
    ];
    await this.notifRepository.save(notifs);

    return savedInvite;
  }

  async rejectCommunityInviteRequest(
    inviteId: number,
    userId: number,
  ): Promise<void> {
    const userP = this.findOneOrFail(userId);
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitedUser: true, invitingUser: true, community: true },
    });

    if (invite.status !== CommunityInviteStatus.RequestPending) {
      throw new BadRequestException(
        `Invite is not a pending request. Status: ${JSON.stringify(
          invite.status,
        )}`,
      );
    }

    const user = await userP;
    if (!user.leaderOfIds.some((cid) => cid === invite.community.id)) {
      throw new UnauthorizedException(
        `User is not a leader of community ${invite.community.id}`,
      );
    }

    invite.status = CommunityInviteStatus.RequestRejected;
    await this.communityInviteRepository.save(invite);

    if (invite.invitingUser) {
      const notif = this.notifRepository.create({
        user: invite.invitingUser,
        category: NotificationCategory.CommunityInviteRequestRejected,
        message: `Your request to invite ${invite.invitedUser.name} was rejected`,
        webAppLocation: groupUrl({
          tab: 'groups',
        }),
        associatedUsers: [user],
      });
      await this.notifRepository.save(notif);
    }
  }

  async findCommunityInvites(
    communityId: number,
  ): Promise<CommunityInviteDto[]> {
    const invites = await this.communityInviteRepository.find({
      where: { community: { id: communityId }, deletedAt: IsNull() },
      relations: { invitedUser: true, invitingUser: true },
    });
    return invites.map((invite) => new CommunityInviteDto(invite));
  }

  async findIncomingCommunityInvitesForUser(
    userId: number,
  ): Promise<CommunityInviteDto[]> {
    const invites = await this.communityInviteRepository.find({
      where: {
        invitedUser: { id: userId },
        deletedAt: IsNull(),
      },
      relations: { invitingUser: true, community: true },
    });
    return invites.map((invite) => new CommunityInviteDto(invite));
  }

  async acceptCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: {
        invitedUser: {
          communities: { leaders: true },
        },
        invitingUser: true,
        community: true,
      },
    });
    if (invite.invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.InviteePending) {
      throw new BadRequestException();
    }

    invite.status = CommunityInviteStatus.InviteeAccepted;

    const community = await this.findCommunityOrFail(invite.community.id, {
      users: true,
    });

    if (community.users!.some((user) => user.id === invite.invitedUser.id)) {
      throw new BadRequestException();
    }

    const saveInvite = this.communityInviteRepository.save(invite);

    community.users!.push(invite.invitedUser);
    const saveCommunity = this.communityRepository
      .save(community)
      .then((savedCommunity) =>
        this.conversationService.syncCommunityConversationMembers(
          savedCommunity.id,
        ),
      );

    // Remove user from all other communities that they are not a leader of
    const updatedCommunities: Community[] = [];
    invite.invitedUser.communities = invite.invitedUser.communities.filter(
      (c) => {
        const keep =
          c.id === community.id || invite.invitedUser.leaderOfIdSet.has(c.id);
        if (!keep) {
          updatedCommunities.push(c);
        }
        return keep;
      },
    );

    const notifs = updatedCommunities.flatMap((community) =>
      community.leaders!.map((leader) =>
        this.notifRepository.create({
          user: leader,
          category: NotificationCategory.MemberLeftCommunity,
          message: `${invite.invitedUser.name} left your group (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'members',
            communityId: community.id,
          }),
          associatedUsers: [invite.invitedUser],
        }),
      ),
    );

    const saveUser = this.userRepository.save(invite.invitedUser);
    const syncConversationMembers = run(async () => {
      await saveCommunity;
      await saveUser;
      await Promise.all([
        ...updatedCommunities.map((c) =>
          this.conversationService.syncCommunityConversationMembers(c.id),
        ),
        this.notifRepository.save(notifs),
      ]);
    });

    const notif = this.notifRepository.create({
      user: invite.invitingUser,
      category: NotificationCategory.CommunityInviteAccepted,
      message: `${invite.invitedUser.name} accepted your invitation to join your group (${community.name})`,
      webAppLocation: groupUrl({
        tab: 'invites',
        communityId: community.id,
      }),
      associatedUsers: [invite.invitedUser],
    });
    const saveNotif = this.notifRepository.save(notif);
    await Promise.all([saveInvite, syncConversationMembers, saveNotif]);
  }

  async rejectCommunityInvite(inviteId: number, userId: number): Promise<void> {
    const invite = await this.communityInviteRepository.findOneOrFail({
      where: { id: inviteId, deletedAt: IsNull() },
      relations: { invitedUser: true, invitingUser: true, community: true },
    });
    if (invite.invitedUser.id !== userId) {
      throw new BadRequestException();
    }
    if (invite.status !== CommunityInviteStatus.InviteePending) {
      throw new BadRequestException();
    }
    invite.status = CommunityInviteStatus.InviteeRejected;
    await this.communityInviteRepository.save(invite);

    const notif = this.notifRepository.create({
      user: invite.invitingUser,
      category: NotificationCategory.CommunityInviteRejected,
      message: `${invite.invitedUser?.name} declined your invitation to join your group (${invite.community.name})`,
      webAppLocation: groupUrl({
        tab: 'invites',
        communityId: invite.community.id,
      }),
      associatedUsers: [invite.invitedUser],
    });
    await this.notifRepository.save(notif);
  }

  async leaveCommunity(communityId: number, userId: number): Promise<void> {
    const community = await this.communityRepository.findOneOrFail({
      where: {
        id: communityId,
      },
      relations: {
        users: true,
        leaders: true,
      },
    });
    const user = community.users.find((user) => user.id === userId);
    if (!user) {
      throw new BadRequestException('User not found in community');
    }
    if (
      community.leaders!.length === 1 &&
      community.leaders![0].id === userId
    ) {
      throw new BadRequestException(
        'You cannot leave as the last leader of the community',
      );
    }

    community.users = community.users.filter((u) => u.id !== user.id);

    await this.communityRepository.save(community);
    const notifs = [
      ...community.leaders!.map((leader) =>
        this.notifRepository.create({
          user: leader,
          category: NotificationCategory.MemberLeftCommunity,
          message: `${user.name} left your group (${community.name})`,
          webAppLocation: groupUrl({
            tab: 'members',
            communityId: community.id,
          }),
          associatedUsers: [user],
        }),
      ),
      this.notifRepository.create({
        user: user,
        category: NotificationCategory.LeftCommunityReminder,
        message: `You left the group (${community.name}). It is encouraged that you request a new group assignment.`,
        webAppLocation: groupUrl({
          tab: 'groups',
        }),
        associatedUsers: [user],
      }),
    ];
    await Promise.all([
      this.conversationService.syncCommunityConversationMembers(communityId),
      this.notifRepository.save(notifs),
    ]);
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
          communities: { leaders: true },
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
    const communities = Array.from(communityById.values());

    if (communities.some((community) => community.maxCapacity === null)) {
      throw new BadRequestException(
        'One or more communities has no max capacity',
      );
    }
    const allowedMemberCounts = new Map<number, number>(
      communities.map((community) => [
        community.id,
        community.maxCapacity! - community.users.length,
      ]),
    );
    for (const { communityId } of body.assignments) {
      const allowed = allowedMemberCounts.get(communityId);
      if (allowed! <= 0) {
        throw new BadRequestException(
          `Too many members assigned to community ${communityId}`,
        );
      }
      allowedMemberCounts.set(communityId, allowed! - 1);
    }

    const notifs: Notification[] = [];
    const updatedCommunities = new Set<number>();
    for (const { userId, communityId } of body.assignments) {
      const user = userById.get(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      const community = communityById.get(communityId);
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }

      user.communities = user.communities.filter((community) => {
        const keep = user.leaderOfIdSet.has(community.id);
        if (!keep) {
          updatedCommunities.add(community.id);
          notifs.push(
            ...community.leaders!.map((leader) =>
              this.notifRepository.create({
                user: leader,
                category: NotificationCategory.MemberLeftCommunity,
                message: `${user.name} left your group (${community.name})`,
                webAppLocation: groupUrl({
                  tab: 'members',
                  communityId: community.id,
                }),
                associatedUsers: [user],
              }),
            ),
          );
        }
        return keep;
      });
      user.communities.push(community);
      updatedCommunities.add(community.id);
      user.undergoingGroupAssignment = false;
      notifs.push(
        this.notifRepository.create({
          user,
          category: NotificationCategory.CommunityAssigned,
          message: `You were assigned to a new group (${community.name})`,
          webAppLocation: groupUrl({
            communityId: community.id,
          }),
        }),
      );
    }

    await Promise.all(
      Array.from(userById.values()).map((user) =>
        this.userRepository.save(user),
      ),
    );
    await Promise.all([
      ...Array.from(updatedCommunities.values()).map((communityId) =>
        this.conversationService.syncCommunityConversationMembers(communityId),
      ),
      this.notifRepository.save(notifs),
    ]);
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
