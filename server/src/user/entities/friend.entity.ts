import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Notification } from '../../notifs/entities/notification.entity';
import { User } from './user.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
export enum FriendStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  None = 'none',
}

@Entity()
@Unique(['requester', 'addressee']) // a user can only request once per counterpart
export class Friend {
  // Fields

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: FriendStatus, default: FriendStatus.None })
  @ApiProperty({ enum: FriendStatus, enumName: 'FriendStatus' })
  status: FriendStatus;

  @CreateDateColumnTz()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @UpdateDateColumnTz()
  updatedAt: Date;

  // Relations

  @ManyToOne(() => User, (user) => user.sentFriendRequests, {
    onDelete: 'CASCADE',
  })
  requester?: Relation<User>;

  @ManyToOne(() => User, (user) => user.receivedFriendRequests, {
    onDelete: 'CASCADE',
  })
  addressee?: Relation<User>;

  @OneToOne(() => Notification, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  sentNotif: Relation<Notification> | null;

  @OneToOne(() => Notification, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  acceptedNotif: Relation<Notification> | null;
}
