import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Campaign } from "src/campaign/entities/campaign.entity";
import { Community } from "src/community/entities/community.entity";
import {
  liveOrNull,
  lockLive,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { City } from "src/geo/city.entity";
import { ImagesService } from "src/images/images.service";
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
  type Repository,
} from "typeorm";
import { UpdateProfileDto } from "./dto/user.dto";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "./entities/onetime-invite.entity";
import { sqlUserHasActiveContractAt, User } from "./entities/user.entity";
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
    private readonly shareUrlsService: ShareUrlsService,
    private readonly imagesService: ImagesService,
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

  async count(): Promise<number> {
    return this.userRepository.count();
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
