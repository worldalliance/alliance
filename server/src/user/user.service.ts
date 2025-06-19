import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserActionRelation } from '../actions/entities/user-action.entity';
import { Friend, FriendStatus } from './friend.entity';
import { OnboardingDto, UpdateProfileDto, UserDto } from './user.dto';
import { City } from 'src/geo/city.entity';
import {
  NotificationType,
  Notification,
} from 'src/notifs/entities/notification.entity';
import { PrefillUser } from './prefill-user.entity';

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
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);

    return this.userRepository.save(user);
  }

  async update(id: number, data: UpdateProfileDto): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findOneOrFail(id);
  }

  async setPassword(id: number, password: string): Promise<User> {
    const user = await this.findOneOrFail(id);
    user.password = password;
    await user.hashPassword();
    return this.userRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['city'],
    });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email: email });
  }

  async getActionRelation(
    id: number,
    actionId: number,
  ): Promise<UserActionRelation> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    const relation: UserActionRelation =
      user?.actionRelations.find((relation) => relation.action.id === actionId)
        ?.status ?? UserActionRelation.none;
    return relation;
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async setAdmin(id: number, admin: boolean): Promise<void> {
    await this.userRepository.update(id, { admin });
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
        category: NotificationType.FriendRequest,
        message: `${requester.name} wants to be friends`,
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
      relations: ['requester', 'addressee'],
    });

    if (!rel) {
      throw new NotFoundException('No pending request found');
    }

    rel.status = status;
    if (status === FriendStatus.Accepted) {
      rel.acceptedAt = new Date();
      rel.acceptedNotif = this.notifRepository.create({
        user: rel.requester,
        category: NotificationType.FriendRequestAccepted,
        message: `${rel.addressee.name} accepted your friend request`,
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

  /** Return accepted friends as `UserDto[]`. */
  async findFriends(userId: number): Promise<UserDto[]> {
    const rels = await this.friendRepository.find({
      where: [
        { requester: { id: userId }, status: FriendStatus.Accepted },
        { addressee: { id: userId }, status: FriendStatus.Accepted },
      ],
      relations: ['requester', 'addressee'],
    });

    const others = rels.map((r) =>
      r.requester.id === userId ? r.addressee : r.requester,
    );

    return others;
  }

  /** Pending sent / received requests as `UserDto[]`. */
  async findPendingRequests(
    userId: number,
    direction: 'sent' | 'received',
  ): Promise<UserDto[]> {
    const rels =
      direction === 'sent'
        ? await this.friendRepository.find({
            where: { requester: { id: userId }, status: FriendStatus.Pending },
            relations: ['addressee'],
          })
        : await this.friendRepository.find({
            where: { addressee: { id: userId }, status: FriendStatus.Pending },
            relations: ['requester'],
          });
    const users =
      direction === 'sent'
        ? rels.map((r) => r.addressee)
        : rels.map((r) => r.requester);

    return users;
  }

  async getRelationshipStatus(
    userId: number,
    targetUserId: number,
  ): Promise<FriendStatus> {
    const rel =
      (await this.friendRepository.findOne({
        where: { requester: { id: userId }, addressee: { id: targetUserId } },
      })) ||
      (await this.friendRepository.findOne({
        where: { requester: { id: targetUserId }, addressee: { id: userId } },
      }));
    return rel ? rel.status : FriendStatus.None;
  }

  private async findOneOrFail(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async countReferred(id: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['referredUsers'],
    });
    return user?.referredUsers.length ?? 0;
  }

  async getUserLocation(userId: number): Promise<City> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['city'],
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return user.city;
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

  async savePushToken(userId: number, token: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const tokens = user.pushTokens || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      await this.userRepository.update(userId, { pushTokens: tokens });
    }
  }

  async removePushToken(userId: number, token: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.pushTokens) return;

    const updatedTokens = user.pushTokens.filter((t) => t !== token);
    await this.userRepository.update(userId, { pushTokens: updatedTokens });
  }
  
}
