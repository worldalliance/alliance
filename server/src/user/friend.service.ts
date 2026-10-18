import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  friendRequestAcceptedMessage,
  friendRequestMessage,
} from "src/notifs/notif-copy";
import { userDestination } from "src/notifs/notification-content";
import { NotificationInboxService } from "src/notifs/notification-inbox.service";
import {
  type CreateNotifParams,
  NotifsService,
} from "src/notifs/notifs.service";
import { profileUrl } from "src/search/approutes";
import { isUniqueViolation } from "src/utils/db-errors";
import { DataSource, type Repository } from "typeorm";
import { type FriendGraphEdge } from "./dto/friend-graph.dto";
import { FriendStatusDtoArgs } from "./dto/user.dto";
import { Friend, FriendStatus } from "./entities/friend.entity";
import { sqlUserHasActiveContractAt, User } from "./entities/user.entity";
import {
  acceptedFriendshipsOf,
  acceptedFriendshipSql,
  friendOf,
  friendshipBetween,
} from "./friendship";
import { saveFriendOfLiveUsers } from "./user-soft-delete";
import { type FriendsAcceptedPayload, UserEvents } from "./user.events";
import { UserService } from "./user.service";

@Injectable()
export class FriendService {
  private readonly logger = new Logger(FriendService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly userService: UserService,
    private readonly notifsService: NotifsService,
    private readonly inbox: NotificationInboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAcceptedFriendIdsByUserId(): Promise<Map<number, number[]>> {
    const rows = await this.friendRepository
      .createQueryBuilder("f")
      .select("f.requesterId", "requesterId")
      .addSelect("f.addresseeId", "addresseeId")
      .where(acceptedFriendshipSql("f"))
      .getRawMany<{ requesterId: number; addresseeId: number }>();

    const byUser = new Map<number, number[]>();
    const addFriend = (userId: number, friendId: number) => {
      const list = byUser.get(userId);
      if (list) {
        list.push(friendId);
        return;
      }
      byUser.set(userId, [friendId]);
    };
    for (const row of rows) {
      addFriend(row.requesterId, row.addresseeId);
      addFriend(row.addresseeId, row.requesterId);
    }
    return byUser;
  }

  async createFriendRequest(
    requesterId: number,
    addresseeId: number,
  ): Promise<Friend> {
    try {
      return await this.saveFriendRequest(requesterId, addresseeId);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another request for the pair committed after our reads; the retry sees it.
      return this.saveFriendRequest(requesterId, addresseeId);
    }
  }

  private async saveFriendRequest(
    requesterId: number,
    addresseeId: number,
  ): Promise<Friend> {
    if (requesterId === addresseeId) {
      throw new BadRequestException("Cannot friend yourself");
    }

    const requester = await this.userService.findOneOrFail(requesterId);
    const addressee = await this.userService.findOneOrFail(addresseeId);

    let rel = await this.friendRepository.findOne({
      where: { requester: { id: requesterId }, addressee: { id: addresseeId } },
    });
    const reverse = await this.friendRepository.findOne({
      where: { requester: { id: addresseeId }, addressee: { id: requesterId } },
    });

    if (reverse) {
      switch (reverse.status) {
        case FriendStatus.Accepted:
          throw new ConflictException("Already friends");
        case FriendStatus.Pending:
          return this.updateFriendRequestStatus(
            addresseeId,
            requesterId,
            FriendStatus.Accepted,
          );
        case FriendStatus.Declined:
        case FriendStatus.None:
          break;
        default:
          throw new Error(
            `unknown friend status: ${reverse.status satisfies never}`,
          );
      }
    }

    if (rel) {
      switch (rel.status) {
        case FriendStatus.Accepted:
          throw new ConflictException("Already friends");
        case FriendStatus.Pending:
          break;
        case FriendStatus.Declined:
        case FriendStatus.None:
          rel.status = FriendStatus.Pending;
          rel.sentNotif = await this.createFriendRequestNotif(
            requester,
            addressee,
          );
          break;
        default:
          throw new Error(
            `unknown friend status: ${rel.status satisfies never}`,
          );
      }
    } else {
      // Reverses a declined request instead of adding a second row for the pair.
      rel = this.friendRepository.create({
        ...reverse,
        requester,
        addressee,
        status: FriendStatus.Pending,
        sentNotif: await this.createFriendRequestNotif(requester, addressee),
      });
    }
    return saveFriendOfLiveUsers(this.dataSource.manager, {
      rel,
      userIds: [requesterId, addresseeId],
      notFound: "Friendship not found",
    });
  }

  private createFriendRequestNotif(requester: User, addressee: User) {
    return this.notifsService.createNotif({
      user: addressee,
      category: NotificationCategory.FriendRequest,
      message: friendRequestMessage(requester),
      destination: userDestination(requester.id),
      webAppLocation: profileUrl(requester.id),
      associatedUsers: [requester],
    } satisfies CreateNotifParams);
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
      throw new NotFoundException("No pending request found");
    }

    rel.status = status;
    if (status === FriendStatus.Accepted) {
      rel.acceptedAt = new Date();
      rel.acceptedNotif = await this.notifsService.createNotif({
        user: rel.requester,
        category: NotificationCategory.FriendRequestAccepted,
        message: friendRequestAcceptedMessage(rel.addressee),
        destination: userDestination(rel.addressee.id),
        webAppLocation: profileUrl(rel.addressee.id),
        associatedUsers: [rel.addressee],
      });
    }
    if (rel.sentNotif) {
      try {
        await this.inbox.setRead(rel.sentNotif.id, addresseeId);
      } catch (error) {
        this.logger.error(
          "Error setting read status for friend request:",
          error,
        );
      }
    }

    const saved = await saveFriendOfLiveUsers(this.dataSource.manager, {
      rel: { ...rel, sentNotif: undefined },
      userIds: [requesterId, addresseeId],
      notFound: "No pending request found",
    });

    if (status === FriendStatus.Accepted) {
      this.emitFriendsAccepted(requesterId, addresseeId);
    }

    return saved;
  }

  /**
   * Decoupled from messaging via an event. Messaging listens and auto-accepts
   * a pending direct-message invite between the two so a new friend never shows
   * as a message request.
   */
  private emitFriendsAccepted(requesterId: number, addresseeId: number): void {
    const payload: FriendsAcceptedPayload = {
      userIdA: requesterId,
      userIdB: addresseeId,
    };
    this.eventEmitter.emit(UserEvents.FriendsAccepted, payload);
  }

  /** Cancel a request OR un-friend an accepted friend in either direction. */
  async removeFriend(userId: number, targetUserId: number): Promise<void> {
    const rel = await this.friendRepository.findOne({
      where: friendshipBetween(userId, targetUserId),
      relations: {
        requester: true,
        addressee: true,
        sentNotif: true,
        acceptedNotif: true,
      },
    });
    if (!rel) {
      return;
    }
    if (rel.addressee && rel.sentNotif) {
      await this.inbox.setRead(rel.sentNotif.id, rel.addressee.id);
    }
    if (rel.requester && rel.acceptedNotif) {
      await this.inbox.setRead(rel.acceptedNotif.id, rel.requester.id);
    }

    await softDeleteCascade(this.friendRepository.manager, {
      target: Friend,
      ids: [rel.id],
    });
  }

  async findFriends(userId: number): Promise<User[]> {
    const rels = await this.friendRepository.find({
      where: acceptedFriendshipsOf(userId),
      relations: {
        requester: { contractEvents: true },
        addressee: { contractEvents: true },
      },
    });

    return rels.map((r) => friendOf(r, userId));
  }

  /**
   * Make two users friends without sending any notifications. Used when a user signs up with a referral code.
   */
  async makeFriendsAutomated(
    requesterId: number,
    addresseeId: number,
  ): Promise<void> {
    const requester = await this.userService.findOneOrFail(requesterId);
    const addressee = await this.userService.findOneOrFail(addresseeId);

    const rel = this.friendRepository.create({
      requester,
      addressee,
      status: FriendStatus.Accepted,
    });

    await saveFriendOfLiveUsers(this.dataSource.manager, {
      rel,
      userIds: [requesterId, addresseeId],
      notFound: "Friendship not found",
    });
    this.emitFriendsAccepted(requesterId, addresseeId);
  }

  async findPendingRequests(
    userId: number,
    direction: "sent" | "received",
  ): Promise<User[]> {
    if (direction === "sent") {
      return (
        await this.friendRepository.find({
          where: {
            requester: { id: userId },
            status: FriendStatus.Pending,
          },
          relations: { addressee: true },
        })
      ).map((r) => r.addressee!);
    }
    return (
      await this.friendRepository.find({
        where: {
          addressee: { id: userId },
          status: FriendStatus.Pending,
        },
        relations: { requester: true },
      })
    ).map((r) => r.requester!);
  }

  async getRelationshipStatus(
    userId: number,
    targetUserId: number,
  ): Promise<FriendStatusDtoArgs> {
    const rel = await this.friendRepository.findOne({
      where: friendshipBetween(userId, targetUserId),
      relations: { requester: true, addressee: true },
    });

    const status = rel ? rel.status : FriendStatus.None;
    return {
      status,
      didReceiveRequest:
        status === FriendStatus.Pending && rel?.addressee!.id === userId,
    };
  }

  async findFriendGraphEdges(): Promise<FriendGraphEdge[]> {
    return this.friendRepository
      .createQueryBuilder("friend")
      .select("friend.requesterId", "userAId")
      .addSelect("friend.addresseeId", "userBId")
      .where(acceptedFriendshipSql("friend"))
      .andWhere(sqlUserHasActiveContractAt("friend.requesterId", "NOW()"))
      .andWhere(sqlUserHasActiveContractAt("friend.addresseeId", "NOW()"))
      .getRawMany<FriendGraphEdge>();
  }
}
