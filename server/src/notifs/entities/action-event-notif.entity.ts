import { ApiProperty } from '@nestjs/swagger';
import { ActionEvent } from 'src/actions/entities/action-event.entity';
import { Mail } from 'src/mail/mail.entity';
import { Mms } from 'src/mms/mms.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationChannel } from '../notif-utils';

export enum ActionEventNotifType {
  Announcement = 'announcement',
  MissedDeadline = 'misseddeadline',
  Reminder = 'reminder',
}

@Entity()
export class ActionEventNotif {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ActionEvent, (actionEvent) => actionEvent.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionEventId' })
  actionEvent: ActionEvent;

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

  @ManyToOne(() => User, (user) => user.actionEventNotifs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the notification has been sent',
  })
  sent: boolean;
}
