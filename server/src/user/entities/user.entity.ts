/* eslint-disable @darraghor/nestjs-typed/all-properties-have-explicit-defined */
/* eslint-disable @darraghor/nestjs-typed/all-properties-are-whitelisted */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { Exclude, Expose, Type } from 'class-transformer';
import {
  Allow,
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { City } from 'src/geo/city.entity';
import { Mail } from 'src/mail/mail.entity';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Notification } from '../../notifs/entities/notification.entity';
import { Friend, FriendStatus } from './friend.entity';
import { Tag } from './tag.entity';
import { UserAwayRange } from './user-away-range.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { Temporal } from '@js-temporal/polyfill';
import { NotificationChannel } from 'src/notifs/notif-utils';
import { Community } from './community.entity';
import { CommunityInvite } from './community-invite.entity';
import { Participant } from 'src/messaging/entities/participant.entity';
import { Ty } from 'src/tasks/entities/type';
import { ContractEvent, ContractEventType } from './contract-event.entity';
import { Action } from 'src/actions/entities/action.entity';
import { UserDevice } from './user-device.entity';
import { Mms } from 'src/mms/mms.entity';
import { findLeast } from 'src/utils/filter';

export enum NotificationPreference {
  All = 'all',
  Digest = 'digest',
  None = 'none',
}

export enum ForumDigestPreference {
  Off = 'off',
  Daily = 'daily',
  Weekly = 'weekly',
}

export enum PublicFormResponseDefault {
  Public = 'public',
  Private = 'private',
}

@Entity()
export class User {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @Column({ unique: true })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  phoneNumber?: string;

  @Column({ default: false })
  @ApiProperty()
  phoneNumberValidated: boolean;

  @OneToOne(() => Mms, { nullable: true })
  @JoinColumn({ name: 'optInMmsId' })
  optInMms?: Mms;

  @Column({ default: false })
  @ApiProperty()
  emailVerified: boolean;

  @Column({ type: 'time', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  preferredReminderTime?: Temporal.PlainTime;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  timeZone?: Temporal.TimeZoneLike;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.Text,
  })
  @ApiProperty({
    enum: NotificationChannel,
    enumName: 'NotificationChannel',
  })
  preferredActionReminderChannel: NotificationChannel;

  // @Column({
  //   type: 'enum',
  //   enum: NotificationChannel,
  //   default: NotificationChannel.Email,
  // })
  // @ApiProperty({
  //   enum: NotificationChannel,
  //   enumName: 'NotificationChannel',
  // })
  // @IsOptional()
  // @IsEnum(NotificationChannel)
  // primaryNotificationChannel: NotificationChannel;

  @Column({
    default: true,
  })
  @ApiProperty()
  emailNotifsEnabled: boolean;

  @Column({
    default: true,
  })
  @ApiProperty()
  textNotifsEnabled: boolean;

  @Column({
    default: true,
  })
  @ApiProperty()
  pushNotifsEnabled: boolean;

  @Column({
    default: true,
  })
  @ApiProperty()
  shareEmailWithCommunityLead: boolean;

  @Column({
    default: true,
  })
  @ApiProperty()
  sharePhoneNumberWithCommunityLead: boolean;

  @Column({
    type: 'enum',
    enum: NotificationPreference,
    default: NotificationPreference.All,
  })
  @ApiProperty({
    enum: NotificationPreference,
    enumName: 'NotificationPreference',
  })
  @IsOptional()
  @IsEnum(NotificationPreference)
  socialNotifsPreference: NotificationPreference;

  @Column({ default: false })
  @ApiProperty()
  turnedOffAllNotifs: boolean;

  @Column({
    type: 'enum',
    enum: ForumDigestPreference,
    default: ForumDigestPreference.Off,
  })
  @ApiProperty({
    enum: ForumDigestPreference,
    enumName: 'ForumDigestPreference',
  })
  forumDigestPreference: ForumDigestPreference;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty()
  admin: boolean;

  @Column({ default: false })
  @ApiProperty()
  staff: boolean;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  profilePicture: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  profileDescription: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  referralCode: string;

  @Column({ nullable: true, unique: true })
  @ApiProperty({ nullable: true })
  @Allow()
  stripeCustomerId: string;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  isNotSignedUpPartialProfile: boolean;

  @Column({ nullable: true })
  @ApiPropertyOptional({ nullable: true })
  @Allow()
  customCityString?: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  @Allow()
  over18: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  onboardingComplete: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  anonymous: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  shareInfoPublicly: boolean;

  @Column({
    type: 'enum',
    enum: PublicFormResponseDefault,
    default: PublicFormResponseDefault.Public,
  })
  @ApiProperty({
    enum: PublicFormResponseDefault,
    enumName: 'PublicFormResponseDefault',
  })
  formDataPreference: PublicFormResponseDefault;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  pushesForLikes: boolean;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  pushesForComments: boolean;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  pushesForFriendRequests: boolean;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  isIntroductoryGroupMember: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  undergoingGroupAssignment: boolean;

  // Relations

  @OneToMany(() => ContractEvent, (event) => event.user, { cascade: true })
  @Type(() => ContractEvent)
  @ApiProperty({ type: () => ContractEvent, isArray: true })
  contractEvents: Ty<ContractEvent>[];

  @OneToMany(() => ActionActivity, (activity) => activity.user)
  activities: ActionActivity[];

  @OneToMany(() => Friend, (friend) => friend.requester)
  sentFriendRequests: Friend[];

  @OneToMany(() => Friend, (friend) => friend.addressee)
  receivedFriendRequests: Friend[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @ManyToOne(() => User, (user) => user.referredUsers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  referredBy: User | null;

  @OneToMany(() => User, (user) => user.referredBy)
  referredUsers: User[];

  @ManyToOne(() => City, { nullable: true, onDelete: 'SET NULL' })
  @IsOptional()
  @Type(() => City)
  city?: City | null;

  @OneToMany(() => ActionEventNotif, (notif) => notif.user)
  actionEventNotifs: ActionEventNotif[];

  @OneToMany(() => UserAwayRange, (awayRange) => awayRange.user)
  awayRanges: UserAwayRange[];

  @OneToOne(() => Mail, { nullable: true })
  @JoinColumn({ name: 'welcomeMailId' })
  welcomeMail: Mail | null;

  @ManyToMany(() => Tag, (tag) => tag.users, { onDelete: 'CASCADE' })
  @Type(() => Tag)
  tags: Ty<Tag>[];

  @ManyToMany(() => Community, (community) => community.users, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => Community, isArray: true })
  @Type(() => Community)
  communities: Community[];

  @ManyToMany(() => Community, (community) => community.leaders, {
    onDelete: 'CASCADE',
  })
  @Type(() => Community)
  leaderOf: Community[];

  @RelationId((user: User) => user.leaderOf)
  leaderOfIds: number[];

  @OneToMany(() => CommunityInvite, (invite) => invite.invitedUser)
  @ApiProperty({ type: () => CommunityInvite, isArray: true })
  @Type(() => CommunityInvite)
  @IsDefined()
  invitedCommunities: CommunityInvite[];

  @OneToMany(() => Participant, (participant) => participant.user)
  @ApiProperty({ type: () => Participant, isArray: true })
  @Type(() => Participant)
  participants: Ty<Participant>[];

  @ManyToMany(() => Action, (action) => action.authors)
  @ApiPropertyOptional({ type: () => Action, isArray: true })
  @Type(() => Action)
  authoredActions?: Ty<Action>[];

  @OneToMany(() => UserDevice, (device) => device.user)
  devices: Ty<UserDevice>[];

  // Methods

  @Expose()
  get hasActiveContract(): boolean {
    return this.hasActiveContractAt(new Date());
  }

  get friends(): User[] {
    const sentAccepted =
      this.sentFriendRequests
        ?.filter((f) => f.status === FriendStatus.Accepted)
        .map((f) => f.addressee) || [];
    const receivedAccepted =
      this.receivedFriendRequests
        ?.filter((f) => f.status === FriendStatus.Accepted)
        .map((f) => f.requester) || [];
    return [...sentAccepted, ...receivedAccepted];
  }

  constructor(data: Partial<User> = {}) {
    Object.assign(this, data);
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    const salt = await bcrypt.genSalt();
    if (!/^\$2[abxy]?\$\d+\$/.test(this.password)) {
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  @BeforeInsert()
  async generateReferralCode(): Promise<void> {
    this.referralCode = Math.random().toString(36).substring(2, 15);
  }

  async checkPassword(plainPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, this.password);
  }

  @Expose()
  @ApiProperty()
  get isCommunityLeader(): boolean {
    if (Array.isArray(this.leaderOfIds)) {
      return this.leaderOfIds.length > 0;
    }
    if (Array.isArray(this.leaderOf)) {
      return this.leaderOf.length > 0;
    }
    return false;
  }

  @Exclude()
  private _hasActiveContractAt = new Map<number, boolean>();
  hasActiveContractAt(date: Date): boolean {
    const key = date.getTime();
    let hasActiveContract = this._hasActiveContractAt.get(key);

    if (hasActiveContract === undefined) {
      const latestContractEvent = this.contractEvents
        ? findLeast(
            this.contractEvents,
            (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
            (event) => event.date <= date,
          )
        : null;
      hasActiveContract =
        latestContractEvent?.type === ContractEventType.SIGNED;

      this._hasActiveContractAt.set(key, hasActiveContract);
    }
    return hasActiveContract;
  }

  @Exclude()
  private _hasActiveContractInFullRange = new Map<string, boolean>();
  hasActiveContractInFullRange(range: {
    startDate?: Date | null;
    endDate?: Date | null;
  }): boolean {
    const { startDate, endDate } = range;
    const startTime = startDate?.getTime() ?? -Infinity;
    const endTime = endDate?.getTime() ?? Infinity;
    const key = `${startTime}_${endTime}`;
    let hasActiveContract = this._hasActiveContractInFullRange.get(key);

    populateCache: if (hasActiveContract === undefined) {
      const latestContractEventBeforeStart = this.contractEvents
        ? findLeast(
            this.contractEvents,
            (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
            (event) => event.date.getTime() <= startTime,
          )
        : null;
      if (latestContractEventBeforeStart?.type !== ContractEventType.SIGNED) {
        hasActiveContract = false;
        break populateCache;
      }

      hasActiveContract = !this.contractEvents?.some(
        (event) =>
          event.date.getTime() >= startTime &&
          event.date.getTime() < endTime &&
          event.type !== ContractEventType.SIGNED,
      );

      this._hasActiveContractInFullRange.set(key, hasActiveContract);
    }
    return hasActiveContract;
  }

  @Exclude()
  private _isAwayAt = new Map<number, boolean>();
  isAwayAt(date: Date): boolean {
    const key = date.getTime();
    let isAway = this._isAwayAt.get(key);

    if (isAway === undefined) {
      isAway = !!this.awayRanges?.some(
        (awayRange) => awayRange.startDate <= date && date <= awayRange.endDate,
      );

      this._isAwayAt.set(key, isAway);
    }
    return isAway;
  }

  @Exclude()
  private _isAwayAtAnyPointInRange = new Map<string, boolean>();
  isAwayAtAnyPointInRange(range: {
    startDate?: Date | null;
    endDate?: Date | null;
  }): boolean {
    const { startDate, endDate } = range;
    const startTime = startDate?.getTime() ?? -Infinity;
    const endTime = endDate?.getTime() ?? Infinity;
    const key = `${startTime}_${endTime}`;

    let isAway = this._isAwayAtAnyPointInRange.get(key);
    if (isAway === undefined) {
      isAway = !!this.awayRanges?.some(
        (awayRange) =>
          awayRange.startDate.getTime() < endTime &&
          awayRange.endDate.getTime() > startTime,
      );

      this._isAwayAtAnyPointInRange.set(key, isAway);
    }
    return isAway;
  }

  @Exclude()
  private _leaderOfIdSet: Set<number> | null = null;
  get leaderOfIdSet(): Set<number> {
    if (this._leaderOfIdSet === null) {
      this._leaderOfIdSet = new Set(this.leaderOfIds);
    }
    return this._leaderOfIdSet;
  }
}
