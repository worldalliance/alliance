import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { UpdateDateColumnTz } from 'src/datasources/basecolumns';
import type { Ty } from 'src/tasks/entities/type';
import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionActivity } from './action-activity.entity';
import { ActionEvent, ActionStatus } from './action-event.entity';
import { ActionSuite } from './action-suite.entity';
import { ActionUpdate } from './action-update.entity';
import { FollowUpForm } from './follow-up-form.entity';
import { findLeast } from 'src/utils/filter';
import type { CohortExpression } from '../cohort-expression.types';

export enum CustomActionStat {
  NONE = 'none',
  USERS_INVITED = 'users_invited',
}

export enum ActionTaskType {
  Funding = 'Funding', //giving money to a particular cause
  Activity = 'Activity', // one-time action taking a limited amount of time
  Ongoing = 'Ongoing', // ongoing or recurring behavior change
}

export enum VisibilityMode {
  Public = 'public',
  AllMembers = 'all_members',
  ParticipatingGroups = 'participating_groups',
}

const MS_IN_WEEK = 7 * 24 * 60 * 60 * 1000;

@Entity()
export class Action {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action' })
  @Allow()
  id: number;

  @Column()
  @ApiProperty({ description: 'Name of the action' })
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty({ description: 'Category of the action', default: '' })
  @Allow()
  category: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'Image URL for the action' })
  @IsOptional()
  image?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: 'Square thumbnail image URL for the action',
  })
  @IsOptional()
  squareThumbnailImage?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: 'Square thumbnail image alt for the action',
  })
  @IsOptional()
  squareThumbnailImageAlt?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: 'Number of commitments needed to start the action',
  })
  @IsOptional()
  commitmentThreshold?: number;

  @Column({ default: 500, nullable: true })
  @ApiPropertyOptional({
    description: 'Suggested donation amount (cents)',
  })
  @IsOptional()
  donationAmount?: number;

  @Column({ default: false })
  @ApiProperty({
    description: 'e.g. onboarding',
  })
  @IsNotEmpty()
  commitmentless: boolean;

  @Column()
  @ApiProperty({ description: 'markdown page body' })
  @Allow()
  body: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: 'markdown contents for activity task card (instructions)',
  })
  @IsOptional()
  taskContents?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Short description shown in cards' })
  @Allow()
  shortDescription: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'Time estimate in minutes' })
  @IsOptional()
  timeEstimate?: number;

  @Column({
    type: 'enum',
    enum: ActionTaskType,
    default: ActionTaskType.Activity,
  })
  @ApiProperty({
    description: 'Type of the action',
    enum: ActionTaskType,
    enumName: 'ActionTaskType',
  })
  @IsNotEmpty()
  type: ActionTaskType;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'Form associated with the action' })
  @IsOptional()
  taskFormId?: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Timestamp when the action was created' })
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ description: 'Timestamp when the action was last updated' })
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  @ApiPropertyOptional({
    description: 'Cohort expression tree defining who participates',
  })
  @IsOptional()
  @Type(() => Object)
  cohortExpression?: CohortExpression | null;

  @Column({ default: false })
  @ApiProperty({
    description:
      'special case for contract signing (prevent doing other onboarding actions)',
  })
  @IsDefined()
  isContractSigningAction: boolean;

  @Column({
    type: 'enum',
    enum: VisibilityMode,
    default: VisibilityMode.Public,
  })
  @ApiProperty({ enum: VisibilityMode, enumName: 'VisibilityMode' })
  @IsDefined()
  visibilityMode: VisibilityMode;

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  usersJoined: number;

  @Column({ default: 0 })
  @ApiProperty({
    description: 'Number of users who have completed the action',
  })
  @Allow()
  usersCompleted: number;

  @Column({ default: false })
  @ApiProperty({
    description:
      'Override default contract signing requirements for showing in tasks (e.g. for onboarding actions)',
    default: false,
  })
  @Allow()
  everyoneShouldComplete: boolean;

  @Column({ default: false })
  @ApiProperty({
    description:
      'Whether the action is an onboarding action (hide for existing members)',
    default: false,
  })
  @Allow()
  onboarding: boolean;

  @Column({ default: false })
  @ApiProperty({
    default: false,
  })
  @Allow()
  archived: boolean;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Priority of the action' })
  @IsDefined()
  priority: number;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  optional: boolean;

  @Column({ default: false })
  @ApiProperty({
    description: 'Prevent completion of the action (for old actions)',
  })
  @Allow()
  preventCompletion: boolean;

  @Column({ default: false })
  @ApiProperty({
    description:
      'Whether the action is visible to and supposed to only be completed by non-members',
  })
  @Allow()
  publicOnly: boolean;

  @Column({ default: false })
  @ApiProperty({
    description:
      'Whether the action shows up in the tasks page after the deadline',
  })
  @Allow()
  shouldCompleteAfterDeadline: boolean;

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether to autocomplete action based on forum participation',
  })
  @Allow()
  isForumParticipationAction: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({
    description: 'Date and time when the action was computed for autocomplete',
  })
  @IsOptional()
  @Type(() => Date)
  computedAutocompleteAt?: Date;

  @Column({ type: 'enum', enum: CustomActionStat, nullable: true })
  @Type(() => String)
  @ApiPropertyOptional({ enum: CustomActionStat, enumName: 'CustomActionStat' })
  @IsOptional()
  customStatType?: CustomActionStat;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  customStatLabel?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  customStatValue?: number;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  customStatGoal?: number;

  // Relations

  @OneToMany(() => ActionEvent, (event) => event.action)
  @ApiProperty({
    description: 'Events associated with the action',
    type: () => ActionEvent,
    isArray: true,
  })
  @Allow()
  @IsArray()
  @Type(() => ActionEvent)
  events: Ty<ActionEvent>[];

  @OneToMany(() => ActionActivity, (activity) => activity.action)
  @ApiProperty({
    description: 'Activities associated with the action',
    type: () => [ActionActivity],
    isArray: true,
  })
  @Allow()
  @IsArray()
  @Type(() => ActionActivity)
  activities: ActionActivity[];

  @OneToMany(() => ActionUpdate, (update) => update.action)
  @ApiProperty({
    type: () => ActionUpdate,
    isArray: true,
  })
  @Allow()
  @Type(() => ActionUpdate)
  updates: ActionUpdate[];

  @OneToMany(() => FollowUpForm, (followUpForm) => followUpForm.action)
  @ApiProperty({
    type: () => FollowUpForm,
    isArray: true,
  })
  @Allow()
  @Type(() => FollowUpForm)
  followUpForms: FollowUpForm[];

  @ManyToOne(() => ActionSuite, (suite) => suite.actions, { nullable: true })
  @ApiPropertyOptional({ type: () => ActionSuite })
  @Type(() => ActionSuite)
  @IsOptional()
  suite?: Ty<ActionSuite> | null;

  @ManyToMany(() => User, (user) => user.authoredActions, { cascade: true })
  @JoinTable()
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  authors?: Ty<User>[];

  // Methods

  @IsOptional()
  private _status: ActionStatus | null = null;
  @Expose()
  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  get status(): ActionStatus {
    if (!this.events) {
      throw new Error('`events` relation is not loaded');
    }
    if (this._status === null) {
      const latestPastEvent = findLeast(
        this.events,
        (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
        (event) => event.date < new Date(),
      );
      this._status = latestPastEvent
        ? latestPastEvent.newStatus
        : ActionStatus.Draft;
    }
    return this._status;
  }

  @IsOptional()
  private _latestMemberActionEvent:
    | {
        event: ActionEvent;
        deadline: Date | null;
      }
    | {
        event: null;
        deadline: null;
      }
    | null = null;
  get latestMemberActionEvent(): NonNullable<
    typeof this._latestMemberActionEvent
  > {
    populateCache: if (!this._latestMemberActionEvent) {
      if (!this.events) {
        this._latestMemberActionEvent = {
          event: null,
          deadline: null,
        };
        break populateCache;
      }

      const latestMemberActionEvent = findLeast(
        this.events,
        (a, b) => b.date.getTime() - a.date.getTime(), // reverse order
        (event) => event.newStatus === ActionStatus.MemberAction,
      );

      if (!latestMemberActionEvent) {
        this._latestMemberActionEvent = {
          event: null,
          deadline: null,
        };
        break populateCache;
      }

      const deadlineEvent = findLeast(
        this.events,
        (a, b) => a.date.getTime() - b.date.getTime(),
        (event) =>
          event.date > latestMemberActionEvent.date &&
          event.newStatus !== ActionStatus.MemberAction,
      );
      this._latestMemberActionEvent = {
        event: latestMemberActionEvent,
        deadline: deadlineEvent?.date ?? null,
      };
    }
    return this._latestMemberActionEvent;
  }

  @IsOptional()
  get deadlineWeekNumber(): number | null {
    if (!this.latestMemberActionEvent?.deadline) {
      return null;
    } else {
      return Math.floor(
        this.latestMemberActionEvent.deadline.getTime() / MS_IN_WEEK,
      );
    }
  }
}
