/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  emptyUserPropertyPresence,
  type UserPropertyPresence,
  userValuePropertyPresence,
} from "@alliance/common/forms/user-properties";
import type { AccountDerivedConditionKind } from "@alliance/common/forms/visible-if-formula";
import { hasProfilePicture } from "@alliance/common/profilePicture";
import { type Result } from "@alliance/common/result";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { countBy } from "es-toolkit";
import { PrerequisiteProgressService } from "src/actions/prerequisite-progress.service";
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
  softDeleteCascade,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import {
  EventLogMessage,
  EventLogService,
} from "src/eventlog/eventlog.service";
import { escapeSlackText } from "src/eventlog/slack-format";
import { City } from "src/geo/city.entity";
import { getImageSource, ImagesService } from "src/images/images.service";
import { deleteClaimedWaitlistTracking } from "src/link-tracking/message-tracking.service";
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
import {
  MyVisibilityContext,
  UpdateProfileDto,
  UserCityCount,
} from "./dto/user.dto";
import { AmbassadorInviteGoal } from "./entities/ambassador-invite-goal.entity";
import { AmbassadorProgramInteraction } from "./entities/ambassador-program-interaction.entity";
import { AmbassadorProgramMember } from "./entities/ambassador-program-member.entity";
import {
  ContractEvent,
  ContractEventType,
} from "./entities/contract-event.entity";
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
import { type AccountDeletedPayload, UserEvents } from "./user.events";
import { referralLabel } from "./user.utils";

const AMBASSADOR_MEMBER_NOT_FOUND = "Ambassador program member not found";

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
    @InjectRepository(AmbassadorInviteGoal)
    private readonly ambassadorInviteGoalRepository: TypedRepository<AmbassadorInviteGoal>,
    @InjectRepository(AmbassadorProgramMember)
    private readonly ambassadorProgramMemberRepository: TypedRepository<AmbassadorProgramMember>,
    @InjectRepository(AmbassadorProgramInteraction)
    private readonly ambassadorProgramInteractionRepository: Repository<AmbassadorProgramInteraction>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly eventLogService: EventLogService,
    private readonly notifsService: NotifsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ambassadorInviteStatsService: AmbassadorInviteStatsService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
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
      order: { date: "ASC", id: "ASC" },
    });
    return firstSigned?.date ?? null;
  }

  async getCompletedActionCount(userId: number): Promise<number> {
    return (await this.prerequisiteProgressService.loadCompletions({ userId }))
      .length;
  }

  /**
   * Whether each listed user-table property currently has a value. City matches
   * `userHasCitySet`: a structured city or a non-empty custom city string.
   */
  async userPropertyPresence(userId: number): Promise<UserPropertyPresence> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { city: true },
    });
    if (!user) {
      return emptyUserPropertyPresence();
    }
    return userValuePropertyPresence({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      preferredReminderTime: user.preferredReminderTime,
      timeZone: user.timeZone,
      profilePicture: user.profilePicture,
      profileDescription: user.profileDescription,
      city: user.city,
      customCityString: user.customCityString,
      over18: user.over18,
      clusterId: user.clusterId,
      staffTitle: user.staffTitle,
      switchedDomainAt: user.switchedDomainAt,
      referredById: user.referredById,
      shareInfoPublicly: user.shareInfoPublicly,
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
    let presence: UserPropertyPresence | undefined;
    const loadPresence = async () => {
      presence ??= await this.userPropertyPresence(userId);
      return presence;
    };

    const fetchers: Record<
      AccountDerivedConditionKind,
      () => Promise<Partial<MyVisibilityContext>>
    > = {
      userHasCity: async () => ({
        userHasCity: (await loadPresence()).city,
      }),
      userPropertyHasValue: async () => ({
        userPropertyHasValue: await loadPresence(),
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
        userPropertyHasValue: emptyUserPropertyPresence(),
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
      this.findOneOrFail(createdByUserId),
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

  // The event log is the system of record for deletion requests — the failure
  // is returned to the controller instead of treated as best-effort.
  async requestAccountDeletion(userId: number): Promise<Result<void, Error>> {
    return this.eventLogService.sendMessage({
      type: EventType.AccountDeletionRequested,
      message: `User ${userId} requested account deletion`,
      userId: userId,
      blob: null,
    });
  }

  /**
   * Soft-deletes a member. Everything keyed to them is hidden with the row:
   * forum posts and comments, action activity (so completion counts drop),
   * messages, notifications, and their own event-log history. The rows stay
   * in the database for an operator to restore by hand; join rows such as
   * group memberships, likes, tags and co-authorships are deleted instead. The
   * click history of a waitlist entry whose invite they claimed is hidden too.
   *
   * The deletion also bumps the account's session generation, so every
   * session issued before it stays invalid, even after a restore.
   *
   * The record of the deletion is written with a null `userId`: it is the
   * admin's act, not part of the member's history that the deletion hides and
   * a restore brings back. It shares the deletion's transaction, so a
   * failure to write it takes the deletion with it rather than leave an
   * unrecorded one behind.
   */
  async deleteUserAdmin(params: {
    userId: number;
    adminId: number;
    reason: string;
    confirmationEmail: string;
    screenshotKey?: string | null;
  }): Promise<void> {
    const { userId, adminId, reason, confirmationEmail, screenshotKey } =
      params;

    const [user, admin] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: adminId } }),
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!admin) {
      throw new UnauthorizedException();
    }
    if (user.id === admin.id) {
      throw new BadRequestException("You cannot delete your own account");
    }
    if (
      confirmationEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        "Confirmation does not match the member's email address",
      );
    }

    const deleted = { id: user.id, name: user.name, email: user.email };
    const screenshotUrl = screenshotKey ? getImageSource(screenshotKey) : null;

    const summary = `Admin ${admin.name} deleted the account for ${deleted.name} (${deleted.email}, id ${deleted.id}). Reason: ${reason}`;
    const screenshotLink = screenshotUrl
      ? ` — <${screenshotUrl}|screenshot>`
      : "";

    const forwardAudit = await this.dataSource.transaction(async (manager) => {
      await manager.increment(User, { id: deleted.id }, "sessionGeneration", 1);
      await deleteClaimedWaitlistTracking({ manager, userId: deleted.id });
      await softDeleteCascade(manager, { target: User, ids: [deleted.id] });

      return this.eventLogService.sendMessageInTransaction(manager, {
        type: EventType.AccountDeleted,
        message: screenshotUrl ? `${summary} (${screenshotUrl})` : summary,
        slackMessage: `${escapeSlackText(summary)}${screenshotLink}`,
        userId: null,
        blob: {
          deletedUserId: deleted.id,
          deletedUserName: deleted.name,
          deletedUserEmail: deleted.email,
          adminId: admin.id,
          adminName: admin.name,
          reason,
          screenshotUrl,
        },
      });
    });

    const payload: AccountDeletedPayload = { userId: deleted.id };
    this.eventEmitter.emit(UserEvents.AccountDeleted, payload);
    await forwardAudit();
  }
}
