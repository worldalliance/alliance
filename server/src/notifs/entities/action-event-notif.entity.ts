import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Mail } from 'src/mail/mail.entity';
import { Mms } from 'src/mms/mms.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationChannel } from '../notif-utils';
import { ReminderGroup } from 'src/actions/entities/reminder-group.entity';
import { Type } from 'class-transformer';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { Ty } from 'src/tasks/entities/type';
import { Push } from 'src/push/push.entity';

export enum ActionEventNotifType {
  Announcement = 'announcement',
  MissedDeadline = 'misseddeadline',
  Reminder = 'reminder',
  PersonalReminder = 'personalreminder',
}

@Entity()
@Index(['idempotency_key'], {
  unique: true,
  where: 'idempotency_key IS NOT NULL',
})
export class ActionEventNotif {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({
    type: 'enum',
    enum: ActionEventNotifType,
    enumName: 'ActionEventNotifType',
    default: ActionEventNotifType.Announcement,
  })
  @ApiProperty({ enum: ActionEventNotifType, enumName: 'ActionEventNotifType' })
  type: ActionEventNotifType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'NotificationChannel',
  })
  @ApiProperty({ enum: NotificationChannel, enumName: 'NotificationChannel' })
  channel: NotificationChannel;

  @ApiProperty({ type: Mail, nullable: true })
  @OneToOne(() => Mail, { nullable: true })
  @JoinColumn({ name: 'mailId' })
  mail: Mail | null;

  @ApiProperty({ type: Mms, nullable: true })
  @OneToOne(() => Mms, { nullable: true })
  @JoinColumn({ name: 'mmsId' })
  mms: Mms | null;

  @ApiPropertyOptional({ type: () => Push, isArray: true })
  @OneToMany(() => Push, (push) => push.actionEventNotif)
  pushes?: Ty<Push>[];

  @ManyToOne(
    () => ReminderGroup,
    (reminderGroup) => reminderGroup.notifications,
    {
      onDelete: 'SET NULL',
      nullable: true,
    },
  )
  @JoinColumn({ name: 'reminderGroupId' })
  @ApiPropertyOptional({ type: () => ReminderGroup })
  @Type(() => ReminderGroup)
  reminderGroup?: Ty<ReminderGroup>;

  @ManyToOne(() => User, (user) => user.actionEventNotifs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Ty<User>;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the notification has been sent',
  })
  sent: boolean;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ type: String })
  idempotency_key?: string;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  createdAt: Date;
}
