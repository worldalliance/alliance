import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  ActionEvent = 'action_event',
  ForumReply = 'forum_reply',
  ActionInvite = 'action_invite',
  FriendRequest = 'friend_request',
  FriendRequestAccepted = 'friend_request_accepted',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  @ApiProperty()
  category: NotificationType;

  @Column()
  @ApiProperty()
  message: string;

  @Column({ nullable: true })
  @ApiProperty()
  webAppLocation: string;

  @Column({ nullable: true })
  @ApiProperty()
  mobileAppLocation: string;

  @Column({ default: false })
  @ApiProperty()
  read: boolean;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  updatedAt: Date;
}
