/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { hasProfilePicture } from "@alliance/common/profilePicture";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { countBy } from "es-toolkit";
import {
  JWTTokenType,
  type MailedJwtPayload,
  verifyMailedToken,
} from "src/auth/tokens";
import { Campaign } from "src/campaign/entities/campaign.entity";
import { Community } from "src/community/entities/community.entity";
import {
  liveOrNull,
  lockLive,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import {
  EventLogMessage,
  EventLogService,
} from "src/eventlog/eventlog.service";
import { City } from "src/geo/city.entity";
import { ImagesService } from "src/images/images.service";
import { MailService } from "src/mail/mail.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  member,
  notifMessage,
  userDestination,
} from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { profileUrl } from "src/search/approutes";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import {
  inviteAssignmentColumns,
  type InviteAssignmentColumns,
  type StoredInviteAssignment,
} from "src/share-urls/invite-assignment";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { findReferredByInvite } from "src/user/user-soft-delete";
import type {
  Relations,
  Repository as TypedRepository,
} from "src/utils/Repository";
import {
  DataSource,
  DeepPartial,
  type EntityManager,
  ILike,
  In,
  IsNull,
  Not,
  type Repository,
} from "typeorm";
import { UpdateProfileDto, UserCityCount } from "./dto/user.dto";
import { ContractEvent } from "./entities/contract-event.entity";
import { Friend } from "./entities/friend.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "./entities/onetime-invite.entity";
import {
  loadedUserCommunities,
  sqlUserHasActiveContractAt,
  User,
} from "./entities/user.entity";
import { acceptedFriendshipsOf, friendOf } from "./friendship";
import { CLAIMABLE_INVITE } from "./invite-claim";
import { referralLabel } from "./user.utils";

@Injectable()
export class UserService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(City)
    private cityRepository: TypedRepository<City>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
  ) {}

  /**
   * A user referred by a one-time invite claims it in the same transaction,
   * so a failed insert leaves the invite usable and only one signup can claim it.
   */
  async create(data: DeepPartial<User>): Promise<User> {
    return this.insertUser({ data });
  }

  private async insertUser(params: {
    data: DeepPartial<User>;
    assignment?: StoredInviteAssignment | null;
  }): Promise<User> {
    const { data: input, assignment } = params;
    const user = await this.dataSource.transaction(async (manager) => {
      // A referral deleted before signup is dropped and the account keeps its
      // referralSource, as when a referrer is deleted after signup. The
      // referrer locks before the invite's group, which locks before the
      // campaign and share link: the orders their deletions take them in.
      const referredBy = await liveOrNull({
        manager,
        target: User,
        row: input.referredBy,
      });
      const data = {
        ...input,
        ...(assignment === undefined
          ? {}
          : await this.inviteAssignmentSnapshot(manager, assignment)),
        referredBy,
        referredByCampaign: await liveOrNull({
          manager,
          target: Campaign,
          row: input.referredByCampaign,
        }),
        referredByShareUrl: await liveOrNull({
          manager,
          target: ShareUrl,
          row: input.referredByShareUrl,
        }),
      };
      const inviteId = data.referredByInvite?.id;
      if (inviteId !== undefined) await this.claimInvite(manager, inviteId);
      return manager.save(manager.create(User, data));
    });
    await this.eventLogService.sendMessage({
      type: EventType.AccountCreated,
      message: [user.name, referralLabel(user), "created an account."]
        .filter(Boolean)
        .join(" "),
      userId: user.id,
      blob: null,
    });
    return user;
  }

  private async claimInvite(
    manager: EntityManager,
    inviteId: number,
  ): Promise<void> {
    // The update locks the invite row, so a concurrent claim waits here and
    // then sees the committed claimant.
    const { affected } = await manager.update(
      OnetimeInvite,
      { id: inviteId, ...CLAIMABLE_INVITE },
      { status: OnetimeInviteStatus.LINK_USED, usedAt: new Date() },
    );
    if (!affected) {
      throw new BadRequestException("This invite code isn't valid");
    }
    if (await this.inviteHasClaimant(manager, inviteId)) {
      throw new BadRequestException("This invite code has already been used");
    }
    // A deleted account keeps its claim until another signup needs the invite;
    // referredByInviteId is unique, so only one account can hold it.
    await manager
      .createQueryBuilder()
      .update(User)
      .set({ referredByInvite: null })
      .where('"referredByInviteId" = :inviteId AND "deletedAt" IS NOT NULL', {
        inviteId,
      })
      .execute();
  }

  private inviteHasClaimant(
    manager: EntityManager,
    inviteId: number,
  ): Promise<boolean> {
    return manager.existsBy(User, { referredByInvite: { id: inviteId } });
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
          throw new BadRequestException("City not found");
        }

        user.city = city;
      }
    }

    const { cityId: _cityId, profilePicture, ...updateData } = data;

    const nextPicture =
      await this.imagesService.resolvePhotoUpdate(profilePicture);

    Object.assign(user, updateData);
    if (nextPicture !== undefined) {
      user.profilePicture = nextPicture;
    }

    await writeUnderLive(this.dataSource.manager, {
      saved: {
        target: User,
        id,
        notFound: `User ${id} not found`,
      },
      write: (manager) => manager.save(user),
    });

    return this.findOneOrFail(id, {
      contractEvents: true,
      city: true,
    });
  }

  async markDomainSwitched(id: number): Promise<void> {
    await this.userRepository.update(
      { id, switchedDomainAt: IsNull(), deletedAt: IsNull() },
      { switchedDomainAt: new Date() },
    );
  }

  async setPassword(id: number, password: string): Promise<void> {
    const user = await this.findOneOrFail(id);
    user.password = password;
    await user.hashPassword();
    await updateLive(this.dataSource.manager, {
      target: User,
      id,
      changes: { password: user.password },
      notFound: `User ${id} not found`,
    });
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
      this.userRepository.find(),
      this.contractEventRepository
        .createQueryBuilder("event")
        .addSelect('event."userId"', "event_user_id")
        .distinctOn(['event."userId"'])
        .orderBy('event."userId"')
        .addOrderBy("event.date", "DESC")
        .addOrderBy("event.id", "DESC")
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

  async findAllMembersPublic(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { shareInfoPublicly: true, staff: false },
      relations: {
        contractEvents: true,
      },
    });
    return users.filter(
      (user) => user.hasActiveContract && hasProfilePicture(user),
    );
  }

  async findStaffDirectory(): Promise<User[]> {
    return this.userRepository.find({
      where: { staff: true },
      order: { staffDisplayOrder: "ASC", id: "ASC" },
    });
  }

  async updateStaffDirectory(
    items: {
      id: number;
      staffTitle?: string | null;
      staffLink?: string | null;
      staffDisplayOrder: number;
    }[],
  ): Promise<User[]> {
    await Promise.all(
      items.map((item) =>
        updateLive(this.dataSource.manager, {
          target: User,
          id: item.id,
          changes: {
            staffDisplayOrder: item.staffDisplayOrder,
            ...(item.staffTitle !== undefined
              ? { staffTitle: item.staffTitle }
              : {}),
            ...(item.staffLink !== undefined
              ? { staffLink: item.staffLink }
              : {}),
          },
        }),
      ),
    );
    return this.findStaffDirectory();
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
      where: { email },
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
   * Snapshot columns for the group placement an invite link carries.
   *
   * A `community` target whose group is already gone keeps its kind but drops
   * the id, matching the state the group's deletion leaves behind when it is
   * deleted after signup. The group stays locked until the signup commits, so
   * a deletion cannot land between this check and the insert.
   */
  private async inviteAssignmentSnapshot(
    manager: EntityManager,
    assignment: StoredInviteAssignment | null,
  ): Promise<InviteAssignmentColumns> {
    const columns = inviteAssignmentColumns(assignment);
    const { inviteAssignmentCommunityId: communityId } = columns;
    if (communityId === null) return columns;
    return (await lockLive(manager, [{ target: Community, id: communityId }]))
      ? columns
      : { ...columns, inviteAssignmentCommunityId: null };
  }

  /** Create a user carrying the group placement their invite link named. */
  async createWithInviteAssignment(
    data: DeepPartial<User>,
    assignment: StoredInviteAssignment | null,
  ): Promise<User> {
    return this.insertUser({ data, assignment });
  }

  async setAdmin(id: number, admin: boolean): Promise<void> {
    await updateLive(this.dataSource.manager, {
      target: User,
      id,
      changes: { admin },
    });
  }

  async updateRolesAdmin(params: {
    id: number;
    actorId: number;
    roles: { ambassador?: boolean; staff?: boolean; admin?: boolean };
  }): Promise<User> {
    const { id, actorId, roles } = params;

    if (roles.admin !== undefined && id === actorId) {
      throw new BadRequestException("You cannot change your own admin status");
    }

    const audit = await this.adminRoleChangeEntry({
      id,
      actorId,
      admin: roles.admin,
    });

    const forwardAudit = await this.dataSource.transaction(async (manager) => {
      await updateLive(manager, {
        target: User,
        id,
        changes: roles,
        notFound: "User not found",
      });
      if (!audit) return null;
      return this.eventLogService.sendMessageInTransaction(manager, audit);
    });
    await forwardAudit?.();

    const user = await this.findAdminDetail(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async findAdminDetail(id: number): Promise<User | null> {
    const user = await this.findOne(id, {
      contractEvents: true,
      referredBy: true,
      referredByCampaign: true,
      referredByShareUrl: true,
      city: true,
      tags: true,
      communities: true,
      leaderOf: true,
    });
    if (!user) return null;
    user.referredByInvite = await findReferredByInvite(
      this.dataSource.manager,
      { userId: id, relations: { invitingUser: true } },
    );
    return user;
  }

  /**
   * The entry for an admin grant or revocation, or null when the request leaves
   * the flag as it is. The `admin` column keeps no history, so an entry that
   * fails to write leaves a privilege change with no record. Callers write this
   * through the transaction that carries the update.
   */
  private async adminRoleChangeEntry(params: {
    id: number;
    actorId: number;
    admin: boolean | undefined;
  }): Promise<EventLogMessage | null> {
    const { id, actorId, admin } = params;
    if (admin === undefined) return null;

    const [target, actor] = await Promise.all([
      this.findOneOrFail(id),
      this.findOneOrFail(actorId),
    ]);
    if (target.admin === admin) return null;

    const verb = admin ? "granted admin to" : "revoked admin from";
    return {
      type: EventType.AdminRoleChanged,
      message: `${actor.name} ${verb} ${target.name} (${target.email}, id ${target.id})`,
      userId: target.id,
      blob: {
        targetId: target.id,
        targetEmail: target.email,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        admin,
      },
    };
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }

  async sendWelcomeEmail(userId: number) {
    if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "staging") {
      return;
    }

    const user = await this.findOneOrFail(userId);
    const token = await this.getVerifyEmailToken(userId);
    const mail = await this.mailService.sendWelcomeEmail({
      recipient: user.email,
      name: user.name,
      verifyToken: token,
    });
    await updateLive(this.dataSource.manager, {
      target: User,
      id: userId,
      changes: { welcomeMail: mail },
    });
  }

  async verifyEmail(token: string) {
    const userId = await verifyMailedToken(this.jwtService, {
      token,
      tokenType: JWTTokenType.verifyEmail,
    });
    if (
      !userId.ok ||
      !(await updateLive(this.dataSource.manager, {
        target: User,
        id: userId.value,
        changes: { emailVerified: true },
      }))
    ) {
      throw new BadRequestException("Invalid or expired verification link");
    }
  }

  async getVerifyEmailToken(userId: number) {
    const payload: MailedJwtPayload = {
      sub: userId,
      tokenType: JWTTokenType.verifyEmail,
    };
    return this.jwtService.sign(payload, {
      expiresIn: `7d`,
      secret: process.env.JWT_SECRET,
    });
  }

  async countActiveUsers(ids: number[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return this.userRepository
      .createQueryBuilder("u")
      .where("u.id IN (:...ids)", { ids })
      .andWhere(sqlUserHasActiveContractAt("u.id", "NOW()"))
      .getCount();
  }

  /** Active members shuffled by `seed`. One seed always picks the same members. */
  async pickActiveUserIdsForSeed(params: {
    count: number;
    excludeIds: number[];
    seed: string;
  }): Promise<number[]> {
    const { count, excludeIds, seed } = params;
    if (count <= 0) {
      return [];
    }
    const qb = this.userRepository
      .createQueryBuilder("u")
      .select("u.id", "id")
      .where(sqlUserHasActiveContractAt("u.id", "NOW()"));
    if (excludeIds.length > 0) {
      qb.andWhere("u.id NOT IN (:...excludeIds)", { excludeIds });
    }
    const rows = await qb
      .orderBy("md5(u.id::text || :seed)")
      .setParameter("seed", seed)
      .take(count)
      .getRawMany<{ id: number }>();
    return rows.map((r) => r.id);
  }

  async findMessageableUsers(userId: number): Promise<User[]> {
    const user = await this.findOneOrFail(userId, { communities: true });

    if (user.staff) {
      return this.userRepository.find({
        where: { id: Not(userId) },
      });
    }

    const memberCommunityIds = loadedUserCommunities(user).map((c) => c.id);
    const leaderCommunityIds = user.leaderOfIds;

    const [rels, staff, communityUsers] = await Promise.all([
      this.friendRepository.find({
        where: acceptedFriendshipsOf(userId),
        relations: { requester: true, addressee: true },
      }),

      this.userRepository.find({ where: { staff: true } }),

      this.userRepository
        .createQueryBuilder("u")
        .distinct(true)
        .leftJoin("u.leaderOf", "leadCommunity")
        .leftJoin("u.communities", "memberCommunity")
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

    const friends = rels.map((r) => friendOf(r, userId));

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
      message: notifMessage`${member(newMember)} joined the Alliance`,
      destination: userDestination(newMember.id),
      webAppLocation: profileUrl(newMember.id),
      associatedUsers: [newMember],
    });
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
        cityName: "Unknown",
        countryCode: null,
        count: nullCityCount,
        latitude: null,
        longitude: null,
      },
    ];
  }

  async generatePasswordResetToken(userId: number) {
    const payload: MailedJwtPayload = {
      sub: userId,
      tokenType: JWTTokenType.passwordReset,
    };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: `1d`,
    });
  }

  async setOptInMms(userId: number, mmsId: number) {
    await updateLive(this.dataSource.manager, {
      target: User,
      id: userId,
      changes: { optInMms: { id: mmsId } },
    });
  }

  async findAllUsers(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findActiveUsersWithTags(): Promise<User[]> {
    return this.userRepository.find({
      relations: { tags: true, awayRanges: true, contractEvents: true },
      relationLoadStrategy: "query",
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
      relations: { awayRanges: true, contractEvents: true },
      relationLoadStrategy: "query",
    });
  }

  /**
   * Ids of the same population as {@link findActiveUsersWithTags}, without
   * hydrating entities — for callers that only need membership checks.
   */
  async findActiveUserIds(): Promise<number[]> {
    const users = await this.userRepository.find({
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  async findByUsername(query: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: {
        name: ILike(`%${query}%`),
        anonymous: false,
      },
    });
    return users;
  }

  async getAllUserIds(): Promise<number[]> {
    return this.userRepository
      .find({ select: ["id"] })
      .then((users) => users.map((user) => user.id));
  }

  async signedMembersCount(): Promise<number> {
    return (
      await this.userRepository.find({
        relations: { contractEvents: true },
      })
    ).filter((user) => user.hasActiveContract).length;
  }
}
