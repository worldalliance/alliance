import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { Notification } from 'src/notifs/entities/notification.entity';
import { UnreadContent } from 'src/notifs/entities/unread-content.entity';
import type { Ty } from 'src/tasks/entities/type';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class Push {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Ty<User>;

  @Column()
  @ApiProperty()
  expoPushToken: string;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @Column()
  @ApiProperty()
  body: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  screen?: string;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  receiptId?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  ticketStatus?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  receiptStatus?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  errorCode?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  errorMessage?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  lastCheckedStatusAt?: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  idempotencyKey?: string;

  @ManyToOne(() => Notification, (notification) => notification.pushes, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notificationId' })
  notification?: Ty<Notification>;

  @ManyToOne(() => UnreadContent, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'unreadContentId' })
  unreadContent?: Ty<UnreadContent>;

  @ManyToOne(
    () => ActionEventNotif,
    (actionEventNotif) => actionEventNotif.pushes,
    {
      nullable: true,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'actionEventNotifId' })
  actionEventNotif?: Ty<ActionEventNotif>;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  openedAt?: Date;
}
