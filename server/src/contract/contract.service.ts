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
import { communityHasCapacity } from 'src/community/community.utils';
import { profileUrl } from 'src/search/approutes';
import { run } from '@alliance/common/run';
import {
  REFERRAL_COMMUNITY_SELECTORS,
  buildNotifForLeaderWithReferrer,
  memberJoinedCommunityNotif,
  newMemberReferredNotif,
} from './contract.utils';

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

    // Cheap initial load
    let user = await this.userRepository.findOneOrFail({
      where: { id: userId },
      relations: {
        contractEvents: true,
        referredBy: true,
        referredByInvite: true,
        pendingCommunity: true,
      },
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

    const firstSigning = user.contractEvents!.length === 0;
    const promises: Promise<unknown>[] = [];
    const notifs: CreateNotifParams[] = [];
    const userUpdate: Partial<User> = {
      id: user.id,
      pendingCommunity: null,
    };
    if (!firstSigning) {
      user = await this.userRepository.findOneOrFail({
        where: { id: userId },
        relations: {
          contractEvents: true,
          pendingCommunity: { users: true, leaders: true },
        },
      });
      if (
        user.pendingCommunity &&
        communityHasCapacity(user.pendingCommunity)
      ) {
        promises.push(
          this.communityService.addUsersToCommunityAndRefreshConversation({
            user,
            community: user.pendingCommunity,
            notifForLeader: ({ leader }) =>
              memberJoinedCommunityNotif(
                leader,
                user,
                user.pendingCommunity!,
                `${user.name} signed their contract and was re-added to your group (${user.pendingCommunity!.name})`,
              ),
          }),
        );
      }
    } else if (user.referredByInvite?.communityId) {
      user = await this.userRepository.findOneOrFail({
        where: { id: userId },
        relations: {
          contractEvents: true,
          referredBy: true,
          referredByInvite: { community: { users: true, leaders: true } },
        },
      });
      const community = user.referredByInvite!.community!;
      let referrerNotified = false;
      await this.communityService.addUsersToCommunityAndRefreshConversation({
        user,
        community,
        notifForLeader: user.referredBy
          ? buildNotifForLeaderWithReferrer(
              user,
              community,
              user.referredBy,
              (v) => (referrerNotified = v),
            )
          : ({ leader }) =>
              memberJoinedCommunityNotif(
                leader,
                user,
                community,
                `${user.name} joined the Alliance and your group (${community.name})`,
              ),
      });
      if (user.referredBy && !referrerNotified) {
        notifs.push(newMemberReferredNotif(user, user.referredBy));
      }
    } else if (user.referredBy) {
      user = await this.userRepository.findOneOrFail({
        where: { id: userId },
        relations: {
          contractEvents: true,
          referredBy: { communities: { users: true, leaders: true } },
        },
      });
      const referredBy = user.referredBy!;
      const community = run(() => {
        const selector = REFERRAL_COMMUNITY_SELECTORS[user.referralSource];
        if (!selector) {
          throw new Error(`Unknown referral source: ${user.referralSource}`);
        }
        return selector(referredBy);
      });

      let referrerNotified = false;
      if (community) {
        promises.push(
          this.communityService.addUsersToCommunityAndRefreshConversation({
            user,
            community,
            notifForLeader: buildNotifForLeaderWithReferrer(
              user,
              community,
              referredBy,
              (v) => (referrerNotified = v),
            ),
          }),
        );
      } else {
        userUpdate.undergoingGroupAssignment = true;
      }
      if (!referrerNotified) {
        notifs.push(newMemberReferredNotif(user, referredBy));
      }
    } else {
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
