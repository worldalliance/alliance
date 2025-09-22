import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { City } from 'src/geo/city.entity';
import { ImagesService } from 'src/images/images.service';
import { MailService } from 'src/mail/mail.service';
import {
  Notification,
  NotificationCategory,
} from 'src/notifs/entities/notification.entity';
import { PaymentUserDataToken } from 'src/payments/entities/payment-token.entity';
import { ILike, Repository } from 'typeorm';
import { Friend, FriendStatus } from './friend.entity';
import { PrefillUser } from './prefill-user.entity';
import {
  FriendStatusDto,
  OnboardingDto,
  ProfileDto,
  UpdateProfileDto,
} from './user.dto';
import { User } from './user.entity';

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
    @InjectRepository(Notification)
    private notifRepository: Repository<Notification>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly jwtService: JwtService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: number, data: UpdateProfileDto): Promise<User> {
    const user = await this.findOneOrFail(id);

    if (data.cityId !== undefined) {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cityId, profilePicture, ...updateData } = data;

    if (profilePicture && profilePicture.length > 100) {
      //TODO: differentiate between file and url
      const key = profilePicture
        ? await this.imagesService.processAndUploadProfileImage(profilePicture)
        : undefined;

      const updateDataWithPfp = {
        ...updateData,
        profilePicture: key,
      };

      Object.assign(user, updateDataWithPfp);
    } else {
      Object.assign(user, updateData);
    }

    return this.userRepository.save(user);
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

  findOne(id: number, relations?: string[]): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['city', ...(relations ?? [])],
    });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: ILike(email) },
      relations: ['sentFriendRequests', 'receivedFriendRequests'],
    });
  }

  async findOneByReferralCode(referralCode: string): Promise<User | null> {
    return this.userRepository.findOneBy({ referralCode });
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
    if (process.env.NODE_ENV === 'test') {
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
    if (body.anonymous !== null) {
      user.anonymous = body.anonymous;
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
        category: NotificationCategory.FriendRequest,
        message: `${requester.name} wants to be friends`,
        webAppLocation: '/profile',
        associatedUser: requester,
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
        category: NotificationCategory.FriendRequestAccepted,
        message: `${rel.addressee.name} accepted your friend request`,
        webAppLocation: `/profile`,
        associatedUser: rel.addressee,
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

  async findFriends(userId: number): Promise<ProfileDto[]> {
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

    return others.map((o) => new ProfileDto(o));
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

    return users.map((u) => new ProfileDto(u));
  }

  async getRelationshipStatus(
    userId: number,
    targetUserId: number,
  ): Promise<FriendStatusDto> {
    const rel =
      (await this.friendRepository.findOne({
        where: { requester: { id: userId }, addressee: { id: targetUserId } },
      })) ||
      (await this.friendRepository.findOne({
        where: { requester: { id: targetUserId }, addressee: { id: userId } },
      }));

    const status = rel ? rel.status : FriendStatus.None;
    return {
      status,
      didReceiveRequest:
        status === FriendStatus.Pending && rel?.addressee.id === userId,
    };
  }

  async findOneOrFail(id: number): Promise<User> {
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

  async getUserLocation(userId: number): Promise<City | undefined> {
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

  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        isNotSignedUpPartialProfile: false,
      },
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

  async signContract(userId: number): Promise<User> {
    const user = await this.findOneOrFail(userId);
    user.contractDateSigned = new Date();
    user.contractDateSuspended = null;
    return this.userRepository.save(user);
  }

  async suspendContract(userId: number): Promise<User> {
    const user = await this.findOneOrFail(userId);
    user.contractDateSuspended = new Date();
    return this.userRepository.save(user);
  }
}
