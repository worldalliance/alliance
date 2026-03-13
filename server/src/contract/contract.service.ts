import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { CommunityService } from 'src/community/community.service';
import {
  NotifsService,
  type CreateNotifParams,
} from 'src/notifs/notifs.service';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { EventType } from 'src/eventlog/event-log.entity';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import { Community } from 'src/community/entities/community.entity';
import { groupUrl, profileUrl } from 'src/search/approutes';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly notifsService: NotifsService,
    private readonly eventLogService: EventLogService,
  ) {}

  async findAll(): Promise<Contract[]> {
    return this.contractRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Contract> {
    return this.contractRepository.findOneOrFail({ where: { id } });
  }

  async findNewestActiveContract(): Promise<Contract> {
    const now = new Date();
    return this.contractRepository.findOneOrFail({
      where: {
        startDate: LessThanOrEqual(now),
        endDate: Or(IsNull(), MoreThan(now)),
      },
      order: {
        startDate: 'DESC',
      },
    });
  }

  async create(dto: CreateContractDto): Promise<Contract> {
    const contract = this.contractRepository.create(dto);
    return await this.contractRepository.save(contract);
  }

  async update(id: number, dto: UpdateContractDto): Promise<Contract> {
    await this.contractRepository.update(id, dto);
    return this.findOne(id);
  }

  async signContract(params: {
    userId: number;
    signedName: string | undefined;
    contractId: number;
  }): Promise<Date> {
    const { userId, signedName, contractId } = params;

    const user = await this.userService.findOneOrFail(userId, {
      contractEvents: true,
      referredBy: { communities: { leaders: true, users: true } },
      referredByInvite: { community: { leaders: true, users: true } },
      communities: true,
      pendingCommunity: { leaders: true, users: true },
    });
    const switchingContracts = user.hasActiveContract;
    const contractEvent = this.contractEventRepository.create({
      user,
      type: ContractEventType.SIGNED,
      date: new Date(),
      signedName,
      contract: { id: contractId },
    });
    const saveContractEventP = this.contractEventRepository.save(contractEvent);

    if (switchingContracts) {
      await saveContractEventP;
      return contractEvent.date;
    }

    const promises: Promise<unknown>[] = [];
    const notifs: CreateNotifParams[] = [];
    const firstSigning = user.contractEvents!.length === 0;
    const userUpdate: Partial<User> = {
      id: user.id,
      pendingCommunity: null,
    };
    if (!firstSigning) {
      if (user.pendingCommunity) {
        if (
          user.pendingCommunity.maxCapacity !== null &&
          user.pendingCommunity.maxCapacity -
            (user.pendingCommunity.users.length -
              (user.pendingCommunity.leaders?.length ?? 0)) >
            0
        ) {
          promises.push(
            this.communityService.addUsersToCommunityAndRefreshConversation({
              user,
              community: user.pendingCommunity,
              notifForLeader: ({ leader }) => ({
                user: leader,
                category: NotificationCategory.MemberJoinedCommunity,
                message: `${user.name} signed their contract and was re-added to your group (${user.pendingCommunity!.name})`,
                webAppLocation: groupUrl({
                  tab: 'members',
                  communityId: user.pendingCommunity!.id,
                }),
                associatedUsers: [user],
              }),
            }),
          );
        }
      }
    } else if (user.referredByInvite?.community) {
      // Join community from invite
      const community = user.referredByInvite.community;
      let referrerNotified = false;
      await this.communityService.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: ({ leader }) => {
          if (leader.id === user.referredBy?.id) {
            referrerNotified = true;
            return {
              user: leader,
              category: NotificationCategory.MemberJoinedCommunity,
              message: `${user.name} joined the Alliance and your group (${community.name})`,
              webAppLocation: groupUrl({
                tab: 'members',
                communityId: community.id,
              }),
              associatedUsers: [user],
            };
          }
          return {
            user: leader,
            category: NotificationCategory.MemberJoinedCommunity,
            message: `${user.name} (invited by ${user.referredBy!.name}) joined the Alliance and your group (${community.name})`,
            webAppLocation: groupUrl({
              tab: 'members',
              communityId: community.id,
            }),
            associatedUsers: [user, user.referredBy!],
          };
        },
      });

      if (user.referredBy && !referrerNotified) {
        notifs.push({
          user: user.referredBy,
          category: NotificationCategory.NewMemberReferred,
          message: `${user.name} joined the Alliance`,
          webAppLocation: profileUrl(user.id),
          associatedUsers: [user],
        });
      }
    } else if (user.referredBy) {
      const referredBy = user.referredBy;
      // Join some community adjacent to the user
      const community: Community | null =
        referredBy.communities?.find(
          (c: Community) =>
            c.maxCapacity !== null &&
            (c.users?.length ?? 0) - (c.leaders?.length ?? 0) < c.maxCapacity &&
            !c.leaders?.some(
              (leader: { id: number }) => leader.id === referredBy.id,
            ),
        ) ?? null;

      if (community) {
        promises.push(
          this.communityService.addUsersToCommunityAndRefreshConversation({
            user,
            community,
            notifForLeader: ({ leader }) => ({
              user: leader,
              category: NotificationCategory.MemberJoinedCommunity,
              message: `${user.name} (invited by ${referredBy.name}) joined the Alliance and your group (${community.name})`,
              webAppLocation: groupUrl({
                tab: 'members',
                communityId: community.id,
              }),
              associatedUsers: [user],
            }),
          }),
        );
      } else {
        userUpdate.undergoingGroupAssignment = true;
      }
      notifs.push({
        user: referredBy,
        category: NotificationCategory.NewMemberReferred,
        message: `${user.name} joined the Alliance`,
        webAppLocation: profileUrl(user.id),
        associatedUsers: [user],
      });
    } else {
      // no community and no referrer
      userUpdate.undergoingGroupAssignment = true;
    }

    await Promise.all([
      saveContractEventP,
      this.userRepository.save(userUpdate),
      this.notifsService.sendNotifs(notifs),
      this.eventLogService.sendMessage({
        type: EventType.ContractSigned,
        message: `${user.name} ${user.referredBy ? `(invited by ${user.referredBy.name}) ` : ''}signed their contract :)`,
        userId: user.id,
      }),
      ...promises,
    ]);

    return contractEvent.date;
  }

  async suspendContract(
    userId: number,
    automatic: boolean = false,
    autoSuspendKey?: string,
  ): Promise<Date> {
    const user = await this.userService.findOneOrFail(userId, {
      contractEvents: true,
      communities: { leaders: true, users: true },
      leaderOf: true,
    });
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

    const communitiesP = Promise.all(
      (user.communities ?? []).map((community: Community) =>
        this.communityService.removeUserFromCommunityAndRefreshConversation({
          user,
          community,
          removeAsLeader: false,
          notifForLeader: ({ leader }) => ({
            user: leader,
            category: NotificationCategory.MemberSuspendedRemovedFromCommunity,
            message: `${user.name} ${automatic ? 'was automatically suspended' : 'suspended their contract'} and has been removed from your group (${community.name})`,
            webAppLocation: profileUrl(user.id),
            associatedUsers: [user],
          }),
          saveAsPendingCommunity: true,
        }),
      ),
    );

    await Promise.all([
      this.contractEventRepository.save(contractEvent),
      communitiesP,
    ]);

    if (!automatic) {
      await this.eventLogService.sendMessage({
        type: EventType.ContractSuspended,
        message: `${user.name} suspended their contract :(`,
        userId: user.id,
      });
    }

    return contractEvent.date;
  }
}
