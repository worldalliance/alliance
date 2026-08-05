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
import type { Relation } from 'src/utils/Repository';

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

  @ManyToOne(() => Action, (action) => action.updates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actionId' })
  @Type(() => Action)
  @Allow()
  @ApiProperty({ type: () => Action })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

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

  @ManyToOne(() => EditableContent, { cascade: true, nullable: false })
  @JoinColumn({ name: 'contentId' })
  @Type(() => EditableContent)
  @IsOptional()
  @ApiPropertyOptional({ type: () => EditableContent })
  content?: Relation<EditableContent>;

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
  associatedEvent?: Relation<ActionEvent>;

  @RelationId((update: ActionUpdate) => update.associatedEvent)
  @Type(() => Number)
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
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
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  notifs: Relation<Notification>[];

  @ManyToOne(() => Tag, { nullable: true })
  @JoinColumn({ name: 'tagId' })
  @Type(() => Tag)
  @ApiPropertyOptional({ type: () => Tag })
  @IsOptional()
  tag?: Relation<Tag>;
}
