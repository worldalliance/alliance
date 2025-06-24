import * as bcrypt from 'bcryptjs';
import { Exclude } from 'class-transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { UserAction } from '../actions/entities/user-action.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Communique } from '../communiques/entities/communique.entity';
import { IsNotEmpty } from 'class-validator';
import { FriendStatus } from './friend.entity';
import { Friend } from './friend.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { City } from 'src/geo/city.entity';

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
  email: string;

  @Column()
  @Exclude()
  @ApiProperty()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty()
  admin: boolean;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  profilePicture: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  profileDescription: string;

  @ManyToMany(() => Communique, (communique) => communique.usersRead)
  communiquesRead: Communique[];

  @OneToMany(() => UserAction, (userAction) => userAction.user)
  actionRelations: UserAction[];

  @OneToMany(() => Friend, (friend) => friend.requester)
  sentFriendRequests: Friend[];

  @OneToMany(() => Friend, (friend) => friend.addressee)
  receivedFriendRequests: Friend[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @ManyToOne(() => User, (user) => user.referredUsers, { nullable: true })
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
  stripeCustomerId: string;

  @Column({ default: false })
  @ApiProperty()
  isNotSignedUpPartialProfile: boolean;

  // -- onboarding info --

  @ManyToOne(() => City)
  city: City;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  over18: boolean;

  @Column({ default: false })
  @ApiProperty()
  onboardingComplete: boolean;
}
