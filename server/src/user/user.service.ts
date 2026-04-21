import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ALL_MEMBERS_TAG_NAME } from 'src/constants';
import { City } from 'src/geo/city.entity';
import { ImagesService } from 'src/images/images.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import {
  Brackets,
  DeepPartial,
  ILike,
  In,
  IsNull,
  Not,
  type Repository,
} from 'typeorm';
import { sqlUserHasActiveContractAt } from './has-active-contract-at';
import { Friend, FriendStatus } from './entities/friend.entity';
import { PrefillUser } from './entities/prefill-user.entity';
import {
  AssignGroupsDto,
  FriendStatusDto,
  ProfileDto,
  SignupSocialProofDto,
  UpdateProfileDto,
  UserCityCountDto,
} from './dto/user.dto';
import { DEFAULT_TIME_ZONE, User } from './entities/user.entity';
import { groupUrl, profileUrl } from 'src/search/approutes';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/tag.dto';
import { Community } from 'src/community/entities/community.entity';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from './entities/onetime-invite.entity';
import {
  CreateOnetimeInviteDto,
  RequestOnetimeInviteDto,
} from './dto/invite.dto';
import {
  UserAwayRange,
  UserAwayRangeReason,
} from './entities/user-away-range.entity';
import { CreateAwayRangeDto, UpdateAwayRangeDto } from './dto/away-range.dto';
import { Temporal } from '@js-temporal/polyfill';
import type { Relations } from 'src/utils/Repository';
import {
  RegisterDeviceDto,
  RegisterLiveActivityPushToStartTokenDto,
  RegisterLiveActivityUpdateTokenDto,
  UserDeviceDto,
} from './dto/device.dto';
import { UserDevice } from './entities/user-device.entity';
import { LiveActivityRegistration } from 'src/apns/entities/live-activity-registration.entity';
import { ActionShareUrl } from 'src/actions/entities/action-share-url.entity';
import { PushService } from 'src/push/push.service';
import { Push } from 'src/push/push.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import {
  type CreateNotifParams,
  NotifsService,
} from 'src/notifs/notifs.service';
import { CommunityService } from 'src/community/community.service';
import { EventType } from 'src/eventlog/event-log.entity';

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
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(LiveActivityRegistration)
    private readonly liveActivityRegistrationRepository: Repository<LiveActivityRegistration>,
    @InjectRepository(ActionShareUrl)
    private readonly actionShareUrlRepository: Repository<ActionShareUrl>,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly communityService: CommunityService,
  ) {}

  async create(data: DeepPartial<User>): Promise<User> {
    const user = await this.userRepository.save(
      this.userRepository.create(data),
    );
    await this.eventLogService.sendMessage({
      type: EventType.AccountCreated,
      message: `${user.name} created an account.`,
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

  async findUserByActionShareSid(sid: string): Promise<User | null> {
    const trimmed = sid.trim();
    if (!trimmed) return null;
    const shareUrl = await this.actionShareUrlRepository.findOne({
      where: { sid: trimmed },
      relations: { user: true },
    });
    return shareUrl?.user ?? null;
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
        console.error('Error setting read status for friend request:', error);
      }
    }

    return this.friendRepository.save({ ...rel, sentNotif: undefined });
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
      r.requester!.id === userId ? r.addressee! : r.requester!,
    );

    return others.map((o) => new ProfileDto(o));
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
              `f.requesterId = :inviterId AND addr.profilePicture IS NOT NULL AND TRIM(addr.profilePicture) <> '' AND (${sqlUserHasActiveContractAt('addr')})`,
            )
            .orWhere(
              `f.addresseeId = :inviterId AND req.profilePicture IS NOT NULL AND TRIM(req.profilePicture) <> '' AND (${sqlUserHasActiveContractAt('req')})`,
            );
        }),
      )
      .setParameter('contractAt', contractAt) // used in sqlUserHasActiveContractAt
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
      qb.andWhere(sqlUserHasActiveContractAt('u'), { contractAt });
    }
    return qb.orderBy('RANDOM()').take(count).getMany();
  }

  /**
   * Up to 5 member profiles with avatars for the signup page.
   * Prefer accepted friends of the referrer (from invite or referral code), then random members with photos.
   */
  async getSignupSocialProof(
    referralCode?: string,
  ): Promise<SignupSocialProofDto> {
    const minProfiles = 5;
    const profiles: ProfileDto[] = [];
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
        if (profiles.length >= minProfiles) {
          break;
        }
        if (!usedIds.includes(u.id)) {
          usedIds.push(u.id);
          profiles.push(new ProfileDto(u));
        }
      }
    }

    const need = minProfiles - profiles.length;
    if (need > 0) {
      const fillers = await this.pickRandomUsersWithProfilePictures(
        need,
        usedIds,
      );
      for (const u of fillers) {
        profiles.push(new ProfileDto(u));
      }
    }

    return new SignupSocialProofDto(profiles);
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
      r.requester!.id === userId ? r.addressee! : r.requester!,
    );

    const byId = new Map<number, User>();
    for (const u of [...staff, ...communityUsers, ...friends]) {
      if (u?.id && u.id !== userId) byId.set(u.id, u);
    }

    return [...byId.values()].map((o) => new ProfileDto(o));
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
  }

  async findPendingRequests(
    userId: number,
    direction: 'sent' | 'received',
  ): Promise<ProfileDto[]> {
    const users =
      direction === 'sent'
        ? (
            await this.friendRepository.find({
              where: {
                requester: { id: userId },
                status: FriendStatus.Pending,
              },
              relations: { addressee: true },
            })
          ).map((r) => r.addressee!)
        : (
            await this.friendRepository.find({
              where: {
                addressee: { id: userId },
                status: FriendStatus.Pending,
              },
              relations: { requester: true },
            })
          ).map((r) => r.requester!);

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

  async getUserCityCounts(): Promise<UserCityCountDto[]> {
    // return (
    //   await this.userRepository.find({
    //     relations: { contractEvents: true },
    //   })
    // ).filter((user) => user.hasActiveContract)

    const allUsers = await this.userRepository.find({
      relations: { contractEvents: true, city: true },
    });
    const users = allUsers.filter((user) => user.hasActiveContract);

    let nullCityCount = 0;

    const cityCounts = users.reduce(
      (acc, user) => {
        const cityId = user.city?.id ?? null;
        if (cityId) {
          acc[cityId] = (acc[cityId] ?? 0) + 1;
        } else {
          nullCityCount++;
        }
        return acc;
      },
      {} as Record<number, number>,
    );

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
        } as UserCityCountDto;
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

    const userNotifs: CreateNotifParams[] = [];
    for (const { userId, communityId } of body.assignments) {
      const user = userById.get(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      const community = communityById.get(communityId);
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }

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
        where: { id: communityId },
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
  ): Promise<UserDeviceDto> {
    const user = await this.findOneOrFail(userId, { devices: true });
    if (body.deviceId) {
      const existingDevice = await this.userDeviceRepository.findOne({
        where: { id: body.deviceId, user: { id: userId } },
      });
      if (existingDevice) {
        await this.userDeviceRepository.update(existingDevice.id, {
          expoPushToken: body.expoPushToken,
        });
        return existingDevice;
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
        return existingByToken;
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
  ): Promise<UserDeviceDto> {
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

    return { id: device.id };
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

  async requestAccountDeletion(userId: number): Promise<void> {
    await this.eventLogService.sendMessage({
      type: EventType.AccountDeletionRequested,
      message: `User ${userId} requested account deletion`,
      userId: userId,
    });
  }
}
