import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { updateLive } from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import {
  EventLogMessage,
  EventLogService,
} from "src/eventlog/eventlog.service";
import { DataSource, type Repository } from "typeorm";
import { ContractEvent } from "./entities/contract-event.entity";
import { User } from "./entities/user.entity";
import { findReferredByInvite } from "./user-soft-delete";
import { UserService } from "./user.service";

@Injectable()
export class UserAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    private readonly userService: UserService,
    private readonly eventLogService: EventLogService,
  ) {}

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
    const user = await this.userService.findOne(id, {
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
      this.userService.findOneOrFail(id),
      this.userService.findOneOrFail(actorId),
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
}
