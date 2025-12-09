/* eslint-disable @darraghor/nestjs-typed/all-properties-have-explicit-defined */
/* eslint-disable @darraghor/nestjs-typed/all-properties-are-whitelisted */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { Expose, Type } from 'class-transformer';
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

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional()
  sentTextOptInMessageAt?: Date;

  @Column({ default: false })
  @ApiProperty()
  emailVerified: boolean;

  @Column({ type: 'time', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  preferredReminderTime?: Temporal.PlainTime;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ type: 'string' })
  timeZone?: Temporal.TimeZoneLike;

  @OneToMany(() => ContractEvent, (event) => event.user, { cascade: true })
  @Type(() => ContractEvent)
  @ApiProperty({ type: () => [ContractEvent] })
  contractEvents: Ty<ContractEvent>[] | null;

  @Expose()
  get hasActiveContract(): boolean {
    if (!this.contractEvents || this.contractEvents.length === 0) {
      return false;
    }
    return (
      this.contractEvents.sort((a, b) => b.date.getTime() - a.date.getTime())[0]
        .type === ContractEventType.SIGNED
    );
  }

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

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  referralCode: string;

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

  @Column({ nullable: true, unique: true })
  @ApiProperty({ nullable: true })
  @Allow()
  stripeCustomerId: string;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  isNotSignedUpPartialProfile: boolean;

  // -- onboarding info --

  @ManyToOne(() => City, { nullable: true })
  @IsOptional()
  @Type(() => City)
  city?: City;

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

  @OneToMany(() => CommunityInvite, (invite) => invite.invitedUser)
  @ApiProperty({ type: () => CommunityInvite, isArray: true })
  @Type(() => CommunityInvite)
  @IsDefined()
  invitedCommunities: CommunityInvite[];

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

  @OneToMany(() => Participant, (participant) => participant.user)
  @ApiProperty({ type: () => Participant, isArray: true })
  @Type(() => Participant)
  participants: Ty<Participant>[];
}
