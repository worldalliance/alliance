import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommunityService } from 'src/community/community.service';
import {
  hasRoomForReturningMember,
  isCommunityLedBy,
} from 'src/community/community.utils';
import { Community } from 'src/community/entities/community.entity';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import {
  NotifsService,
  type CreateNotifParams,
} from 'src/notifs/notifs.service';
import { profileUrl } from 'src/search/approutes';
import {
  inviteAssignmentFromColumns,
  type StoredInviteAssignment,
  StoredInviteAssignmentKind,
} from 'src/share-urls/invite-assignment';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { ReferralSource, User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { referralLabel } from 'src/user/user.utils';
import { IsNull, LessThanOrEqual, MoreThan, Or, Repository } from 'typeorm';
import {
  REFERRAL_COMMUNITY_SELECTORS,
  buildNotifForLeaderWithReferrer,
  memberJoinedCommunityNotif,
  newMemberReferredNotif,
} from './contract.utils';
import { CreateContractDto, UpdateContractDto } from './dto/contract.dto';
import { Contract } from './entities/contract.entity';

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

  /**
   * Where a referred member lands when they sign. Placement stored on a
   * reusable invite link wins over the referral source's default selector;
   * null means nowhere valid, so the member is queued for manual assignment.
   */
  private async selectCommunityForReferral(params: {
    referralSource: ReferralSource;
    referredBy: User;
    inviteAssignment: StoredInviteAssignment | null;
  }): Promise<Community | null> {
    const { referralSource, referredBy, inviteAssignment } = params;
    if (inviteAssignment === null) {
      return REFERRAL_COMMUNITY_SELECTORS[referralSource](referredBy);
    }
    switch (inviteAssignment.kind) {
      case StoredInviteAssignmentKind.Community: {
        const { communityId } = inviteAssignment;
        // Null once the target group is deleted: the invite named a
        // destination and it is gone, so there is nowhere valid to place this
        // member.
        if (communityId === null) return null;
        const community = await this.communityService.findOne(communityId);
        // No capacity check: naming this group on an invite link is the
        // leader's own consent, which `maxCapacity` does not bound. Leadership
        // is rechecked because it can lapse after the link is made.
        if (!community || !isCommunityLedBy(community, referredBy.id)) {
          return null;
        }
        return community;
      }
      case StoredInviteAssignmentKind.Open:
        return REFERRAL_COMMUNITY_SELECTORS[ReferralSource.OnetimeInvite](
          referredBy,
        );
      default:
        throw new Error(
          `unknown reusable invite assignment: ${
            inviteAssignment satisfies never
          }`,
        );
    }
  }

  async signContract(params: {
    userId: number;
    signedName: string | null;
    contractId: number;
  }): Promise<Date> {
    const { userId, signedName, contractId } = params;

    // Cheap initial load
    let user = await this.userRepository.findOneOrFail({
      where: { id: userId },
      relations: {
        contractEvents: true,
        referredBy: true,
        referredByCampaign: true,
        referredByInvite: true,
        pendingCommunity: true,
      },
    });
    const reusableInviteAssignment = inviteAssignmentFromColumns(user);

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
        !hasRoomForReturningMember(user.pendingCommunity)
      ) {
        // Their seat went to someone else while they were suspended.
        // `pendingCommunity` is cleared below either way, so queue them rather
        // than leaving them in no group and no queue.
        userUpdate.undergoingGroupAssignment = true;
      } else if (user.pendingCommunity) {
        promises.push(
          this.communityService.addUsersToCommunityAndRefreshConversation({
            user,
            community: user.pendingCommunity,
            contractBeingSigned: true,
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
        contractBeingSigned: true,
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
      const community = await this.selectCommunityForReferral({
        referralSource: user.referralSource,
        referredBy,
        inviteAssignment: reusableInviteAssignment,
      });

      let referrerNotified = false;
      if (community) {
        promises.push(
          this.communityService.addUsersToCommunityAndRefreshConversation({
            user,
            community,
            contractBeingSigned: true,
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
        message: [user.name, referralLabel(user), 'signed their contract :)']
          .filter(Boolean)
          .join(' '),
        userId: user.id,
        blob: null,
      }),
      ...promises,
    ]);

    return contractEvent.date;
  }

  async suspendContract(params: {
    userId: number;
    automatic?: boolean;
    autoSuspendKey?: string | null;
  }): Promise<Date> {
    const { userId, automatic = false, autoSuspendKey = null } = params;

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
        blob: null,
      });
    }

    return contractEvent.date;
  }
}
