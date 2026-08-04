import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ActionEvent } from 'src/actions/entities/action-event.entity';
import { ReminderGroup } from 'src/actions/entities/reminder-group.entity';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { Mail } from 'src/mail/mail.entity';
import { Mms } from 'src/mms/mms.entity';
import { Push } from 'src/push/push.entity';
import { User } from 'src/user/entities/user.entity';
import type { Relation } from 'src/utils/Repository';
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

  @ApiProperty({ type: Mail, nullable: true })
  @OneToOne(() => Mail, { nullable: true })
  @JoinColumn({ name: 'mailId' })
  mail: Relation<Mail> | null;

  @ApiProperty({ type: Mms, nullable: true })
  @OneToOne(() => Mms, { nullable: true })
  @JoinColumn({ name: 'mmsId' })
  mms: Relation<Mms> | null;

  @ApiPropertyOptional({ type: () => Push, isArray: true })
  @OneToMany(() => Push, (push) => push.actionEventNotif)
  pushes?: Relation<Push>[];

  @Index()
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
  reminderGroup?: Relation<ReminderGroup>;

  /**
   * The member-action event this notif *personally* notified the user about,
   * denormalized from the reminder group at send time so "was this user
   * already notified about this event" (`excludePreviouslyNotified`) survives
   * the group being deleted. Deliberately null on group-leads nudges (which
   * are about other users' tasks, see `cohortNotifiesRecipientPersonally`)
   * and on rows whose group was deleted before this column existed.
   */
  @ManyToOne(() => ActionEvent, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'memberActionEventId' })
  @Index()
  @ApiPropertyOptional({ type: () => ActionEvent })
  @Type(() => ActionEvent)
  memberActionEvent?: Relation<ActionEvent>;

  /**
   * Ids of the actions whose tasks this notif's message enumerated, recorded
   * at send time so `excludePreviouslyNotified` groups can notify about tasks
   * the user hasn't heard about yet (and only those). Null on group-leads
   * nudges and on rows predating this column — a null with a
   * `memberActionEvent` stamp is treated as having covered every task, the
   * pre-column behavior.
   */
  @Column('integer', { array: true, nullable: true })
  @ApiProperty({ type: [Number], nullable: true })
  notifiedActionIds: number[] | null;

  @ManyToOne(() => User, (user) => user.actionEventNotifs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates whether the notification has been sent',
  })
  sent: boolean;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ type: String, nullable: true })
  idempotency_key: string | null;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  createdAt: Date;
}
