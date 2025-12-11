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
import { Ty } from 'src/tasks/entities/type';
import { Tag } from 'src/user/entities/tag.entity';
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
import { ActionActivity, ActionActivityType } from './action-activity.entity';
import { ActionEvent, ActionStatus } from './action-event.entity';
import { ActionSuite } from './action-suite.entity';
import { ActionUpdate } from './action-update.entity';

export enum ActionTaskType {
  Funding = 'Funding', //giving money to a particular cause
  Activity = 'Activity', // one-time action taking a limited amount of time
  Ongoing = 'Ongoing', // ongoing or recurring behavior change
}

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action' })
  @Allow()
  id: number;

  @Column()
  @ApiProperty({ description: 'Name of the action' })
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty({ description: 'Category of the action' })
  @IsNotEmpty()
  category: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'Image URL for the action' })
  @IsOptional()
  image?: string;

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

  @ManyToMany(() => Tag, (tag) => tag.participatingIn, {
    onDelete: 'CASCADE',
  })
  @ApiProperty({ type: () => Tag, isArray: true })
  @Allow()
  @JoinTable()
  @Type(() => Tag)
  participatingTags: Tag[];

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether to use a manual cohort for the action',
  })
  @IsDefined()
  useManualCohort: boolean;

  @ManyToMany(() => User)
  @JoinTable()
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  manualCohortUsers?: Ty<User>[];

  @Column({ default: false })
  @ApiPropertyOptional({
    description:
      'Whether to show the action to members who are not of participating groups',
    default: false,
  })
  @IsOptional()
  showToNonparticipating?: boolean;

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  usersJoined: number;

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

  @Expose()
  @ApiProperty({ enum: ActionStatus, enumName: 'ActionStatus' })
  get status(): ActionStatus {
    if (!this.events) {
      return ActionStatus.Draft;
    }
    const pastEvents = this.events
      .filter((e) => e.date < new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (pastEvents.length === 0) {
      return ActionStatus.Draft;
    }
    return pastEvents[pastEvents.length - 1].newStatus;
  }

  @Expose()
  @ApiProperty({
    description: 'Number of users who have completed the action',
  })
  get usersCompleted(): number {
    return (
      this.activities?.filter(
        (activity) => activity.type === ActionActivityType.USER_COMPLETED,
      ).length || 0
    );
  }

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
    default: false,
  })
  @Allow()
  archived: boolean;

  @OneToMany(() => ActionUpdate, (update) => update.action)
  @ApiProperty({
    type: () => ActionUpdate,
    isArray: true,
  })
  @Allow()
  @Type(() => ActionUpdate)
  updates: ActionUpdate[];

  @ManyToOne(() => ActionSuite, (suite) => suite.actions, { nullable: true })
  @ApiPropertyOptional({ type: () => ActionSuite })
  @Type(() => ActionSuite)
  @IsOptional()
  suite?: ActionSuite;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Priority of the action' })
  @IsDefined()
  priority: number;

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
}
