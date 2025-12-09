import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Action } from './action.entity';
import { Type } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional } from 'class-validator';
import { ActionEvent } from './action-event.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from 'src/notifs/entities/notification.entity';
import { Tag } from 'src/user/entities/tag.entity';
import { Ty } from 'src/tasks/entities/type';

export enum ActionUpdateNotifyType {
  None = 'none',
  ActionCohort = 'action_cohort',
  AllMembers = 'all_members',
  Tag = 'tag',
}

@Entity()
export class ActionUpdate {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @ManyToOne(() => Action, (action) => action.updates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionId' })
  @Type(() => Action)
  @Allow()
  @ApiProperty({ type: () => Action })
  action: Ty<Action>;

  @RelationId((update: ActionUpdate) => update.action)
  @Type(() => Number)
  @ApiProperty()
  @IsNotEmpty()
  actionId: number;

  @Column({ type: 'text' })
  @IsNotEmpty()
  @Allow()
  @ApiProperty()
  title: string;

  @ManyToOne(() => EditableContent, { eager: true })
  @JoinColumn({ name: 'contentId' })
  @Type(() => EditableContent)
  @Allow()
  @ApiProperty()
  content: EditableContent;

  @Column({ type: 'timestamptz' })
  @IsNotEmpty()
  @Type(() => Date)
  @ApiProperty()
  date: Date;

  @Column({ type: 'timestamptz' })
  @IsNotEmpty()
  @Type(() => Date)
  @ApiProperty()
  visibleAt: Date;

  @Column({ type: 'text' })
  @IsNotEmpty()
  @ApiProperty()
  shortNotifString: string;

  @ManyToOne(() => ActionEvent, (event) => event.updates, { nullable: true })
  @JoinColumn({ name: 'associatedEventId' })
  @Type(() => ActionEvent)
  @ApiPropertyOptional({ type: () => ActionEvent })
  @IsOptional()
  associatedEvent?: Ty<ActionEvent>;

  @RelationId((update: ActionUpdate) => update.associatedEvent)
  @Type(() => Number)
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  associatedEventId?: number | null;

  @Column({
    type: 'enum',
    enum: ActionUpdateNotifyType,
    default: ActionUpdateNotifyType.None,
  })
  @IsNotEmpty()
  @Allow()
  @ApiProperty({
    enum: ActionUpdateNotifyType,
    enumName: 'ActionUpdateNotifyType',
  })
  notifyType: ActionUpdateNotifyType;

  @OneToMany(() => Notification, (notif) => notif.actionUpdate)
  @Type(() => Notification)
  @ApiProperty({ type: () => Notification, isArray: true })
  @Allow()
  notifs: Ty<Notification>[];

  @ManyToOne(() => Tag, { nullable: true })
  @JoinColumn({ name: 'tagId' })
  @Type(() => Tag)
  @ApiPropertyOptional({ type: () => Tag })
  @IsOptional()
  tag?: Ty<Tag>;
}
