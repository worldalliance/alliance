/* eslint-disable @darraghor/nestjs-typed/all-properties-have-explicit-defined */
/* eslint-disable @darraghor/nestjs-typed/all-properties-are-whitelisted */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { Type } from 'class-transformer';
import {
  Allow,
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
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Notification } from '../notifs/entities/notification.entity';
import { Friend, FriendStatus } from './friend.entity';

export enum NotificationPreference {
  All = 'all',
  Digest = 'digest',
  None = 'none',
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
  @ApiProperty()
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

  @Column({ default: false })
  @ApiProperty()
  emailVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  contractDateSigned: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  contractDateSuspended: Date | null;

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

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
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

  @OneToOne(() => Mail, { nullable: true })
  @JoinColumn({ name: 'welcomeMailId' })
  welcomeMail: Mail | null;
}
