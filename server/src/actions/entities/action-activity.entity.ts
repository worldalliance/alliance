import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Action } from './action.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import type { Ty } from 'src/tasks/entities/type';

export enum ActionActivityType {
  USER_JOINED = 'user_joined',
  USER_COMPLETED = 'user_completed',
  USER_DECLINED = 'user_declined', // declining to commit
  USER_WONT_COMPLETE = 'user_wont_complete', //declining after commitment
  USER_DISMISSED = 'user_dismissed',

  USER_SUBMITTED_FOLLOW_UP_FORM = 'user_submitted_follow_up_form',
}

export const ALLOW_DUPLICATE = {
  [ActionActivityType.USER_JOINED]: false,
  [ActionActivityType.USER_COMPLETED]: false,
  [ActionActivityType.USER_DECLINED]: false,
  [ActionActivityType.USER_WONT_COMPLETE]: false,
  [ActionActivityType.USER_DISMISSED]: false,
  [ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM]: true,
} as const satisfies Record<ActionActivityType, boolean>;

export enum ActivitySource {
  USER = 'user',
  ADMIN_OVERRIDE = 'admin_override',
}

@Entity()
@Index('IDX_action_activity_type_createdAt', ['type', 'createdAt'])
export class ActionActivity {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @Column({ type: 'enum', enum: ActionActivityType })
  @ApiProperty({
    description: 'Type of action activity',
    enum: ActionActivityType,
    enumName: 'ActionActivityType',
  })
  @Allow()
  type: ActionActivityType;

  @ManyToOne(() => Action, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionId' })
  @Allow()
  @Type(() => Action)
  action: Ty<Action>;

  @Column()
  @ApiProperty()
  @Allow()
  actionId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  @Allow()
  @Type(() => User)
  user: Ty<User>;

  @Column()
  @Allow()
  @ApiProperty()
  userId: number;

  @CreateDateColumn()
  @Allow()
  @Type(() => Date)
  @ApiProperty()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  metadata?: string;

  // just for donation-based actions
  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  dollar_amount?: number;

  @OneToOne(() => EditableContent, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @Allow()
  @IsOptional()
  @Type(() => EditableContent)
  @ApiPropertyOptional({ type: () => EditableContent })
  editableContent?: EditableContent;

  @ManyToMany(() => User, { onDelete: 'CASCADE' })
  @JoinTable()
  @Allow()
  @ApiProperty({ type: () => User, isArray: true })
  @Type(() => User)
  likes: Ty<User>[];

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  likesCount: number;

  @ApiPropertyOptional({ type: () => FormResponse })
  @Type(() => FormResponse)
  @IsOptional()
  @OneToOne(() => FormResponse, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  taskFormResponse?: Ty<FormResponse>;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  declineReason?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  isMoral?: boolean; // for moral declines

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  outOfTime?: boolean; // for opting out due to running out of time

  @Column({ type: 'enum', enum: ActivitySource, default: ActivitySource.USER })
  @ApiProperty({
    description: 'Source of the activity',
    enum: ActivitySource,
    enumName: 'ActivitySource',
  })
  @Allow()
  source: ActivitySource;
}
