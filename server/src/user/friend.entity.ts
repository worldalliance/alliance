import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';
import { Notification } from '../notifs/entities/notification.entity';
export enum FriendStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Declined = 'declined',
  None = 'none',
}

@Entity()
@Unique(['requester', 'addressee']) // a user can only request once per counterpart
export class Friend {
  @PrimaryGeneratedColumn()
  id: number;

  /** User who initiated the request */
  @ManyToOne(() => User, (user) => user.sentFriendRequests, {
    onDelete: 'CASCADE',
  })
  requester: User;

  /** User who received the request */
  @ManyToOne(() => User, (user) => user.receivedFriendRequests, {
    onDelete: 'CASCADE',
  })
  addressee: User;

  //   @Column({ type: 'enum', enum: FriendStatus, default: FriendStatus.Pending })
  @Column()
  @ApiProperty({ enum: FriendStatus })
  status: FriendStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  acceptedAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Notification, {
    cascade: true,
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  sentNotif: Notification | null;

  @OneToOne(() => Notification, {
    cascade: true,
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  acceptedNotif: Notification | null;
}
