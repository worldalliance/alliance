import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionEvent } from './action-event.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined, IsOptional } from 'class-validator';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';

export enum ReminderCohortType {
  AllUncompleted = 'all_uncompleted',
  Custom = 'custom',
}

export enum ReminderTimingMode {
  Absolute = 'absolute',
  FromDeadline = 'from_deadline',
}

@Entity()
export class ActionReminder {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @ApiProperty({ type: () => ActionEvent })
  @ManyToOne(() => ActionEvent, (actionEvent) => actionEvent.reminders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'memberActionEventId' })
  @Type(() => ActionEvent)
  @Allow()
  @IsDefined()
  memberActionEvent: ActionEvent;

  @ApiProperty({
    enum: ReminderCohortType,
    enumName: 'ReminderCohortType',
  })
  @Column({ type: 'enum', enum: ReminderCohortType, nullable: true })
  @Allow()
  cohortType: ReminderCohortType;

  @ApiProperty({
    enum: ReminderTimingMode,
    enumName: 'ReminderTimingMode',
  })
  @Column({ type: 'enum', enum: ReminderTimingMode })
  @Allow()
  timingMode: ReminderTimingMode;

  @ApiProperty({ type: User, isArray: true })
  @Type(() => User)
  @Allow()
  @ManyToMany(() => User)
  @JoinTable()
  users: User[];

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  emailMessage: string;

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  emailSubject: string;

  @ApiProperty({ type: String })
  @Column({ type: 'text' })
  @IsDefined()
  textMessage: string;

  @ApiPropertyOptional({ type: Date })
  @Column({ type: 'timestamptz', nullable: true })
  @Type(() => Date)
  @IsOptional()
  sendAtAbsolute?: Date;

  @ApiPropertyOptional({ type: Number })
  @Column({ type: 'integer', nullable: true })
  @IsOptional()
  @Type(() => Number)
  sendAtSecondsFromDeadline?: number;

  @ApiPropertyOptional({ type: Date, default: null })
  @Column({ type: 'timestamptz', nullable: true })
  @IsOptional()
  @Type(() => Date)
  sentAt?: Date;

  @OneToMany(() => ActionEventNotif, (notification) => notification.actionEvent)
  @ApiProperty({ type: ActionEventNotif, isArray: true })
  @IsDefined()
  @Type(() => ActionEventNotif)
  notifications: ActionEventNotif[];

  @CreateDateColumn({ type: 'timestamptz' })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;
}
