import {
  cohortExpressionSchema,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { HTTP_URL_VALIDATOR_OPTIONS } from "@alliance/common/url";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import { findLeast } from "src/utils/filter";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import {
  memberActionPhase,
  type MemberActionPhase,
} from "../utils/action-event";
import { ActionActivity } from "./action-activity.entity";
import { ActionEvent, ActionStatus } from "./action-event.entity";
import { ActionFormVariant } from "./action-form-variant.entity";
import { ActionSuite } from "./action-suite.entity";
import { ActionUpdate } from "./action-update.entity";
import {
  FollowUpForm,
  parseFollowUpForm,
  type ParsedFollowUpForm,
} from "./follow-up-form.entity";

export enum CustomActionStat {
  NONE = "none",
  USERS_INVITED = "users_invited",
}

export enum ActionTaskType {
  Funding = "Funding", //giving money to a particular cause
  Activity = "Activity", // one-time action taking a limited amount of time
  Ongoing = "Ongoing", // ongoing or recurring behavior change
}

export enum VisibilityMode {
  Public = "public",
  AllMembers = "all_members",
  ParticipatingGroups = "participating_groups",
}

export enum ActionReviewerIcon {
  LinkedIn = "linkedin",
}

const REVIEWER_NAME_MAX_LENGTH = 200;
// Longer URLs exist in the wild, but browsers and CDNs commonly cap around
// here, and the value is stored in an unbounded jsonb column.
const REVIEWER_URL_MAX_LENGTH = 2048;
export const ACTION_REVIEWERS_MAX = 50;

/** A non-user credited with reviewing an action (name + optional link). */
export class ActionReviewer {
  @ApiProperty({
    description: "Display name of the reviewer",
    maxLength: REVIEWER_NAME_MAX_LENGTH,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(REVIEWER_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({
    description: "Link to the reviewer's website, LinkedIn, etc.",
    maxLength: REVIEWER_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_VALIDATOR_OPTIONS)
  @MaxLength(REVIEWER_URL_MAX_LENGTH)
  url?: string;

  @ApiPropertyOptional({
    enum: ActionReviewerIcon,
    enumName: "ActionReviewerIcon",
    description: "Icon shown next to the reviewer name",
  })
  @IsOptional()
  @IsEnum(ActionReviewerIcon)
  icon?: ActionReviewerIcon;
}

const MS_IN_WEEK = 7 * 24 * 60 * 60 * 1000;

@Entity()
@Unique(["taskFormId"])
export class Action {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty({ description: "Unique identifier for the action" })
  @Allow()
  id: number;

  @Column()
  @ApiProperty({ description: "Name of the action" })
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty({ description: "Category of the action", default: "" })
  @Allow()
  category: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: "Image URL for the action" })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  image?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: "Square thumbnail image URL for the action",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  squareThumbnailImage?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: "Square thumbnail image alt for the action",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  squareThumbnailImageAlt?: string;

  @Column({ default: 500, nullable: true })
  @ApiPropertyOptional({
    description: "Suggested donation amount (cents)",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  donationAmount?: number;

  @Column()
  @ApiProperty({ description: "markdown page body" })
  @Allow()
  body: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({
    description: "markdown contents for activity task card (instructions)",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  taskContents?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: "Short description shown in cards" })
  @Allow()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  shortDescription: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: "Time estimate in minutes" })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  timeEstimate?: number;

  @Column({
    type: "enum",
    enum: ActionTaskType,
    default: ActionTaskType.Activity,
  })
  @ApiProperty({
    description: "Type of the action",
    enum: ActionTaskType,
    enumName: "ActionTaskType",
  })
  @IsNotEmpty()
  type: ActionTaskType;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: "Form associated with the action" })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  taskFormId?: number;

  @CreateDateColumnTz()
  @ApiProperty({ description: "Timestamp when the action was created" })
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ description: "Timestamp when the action was last updated" })
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ type: "jsonb", nullable: true })
  @ApiPropertyOptional({
    description: "Cohort expression tree defining who participates",
    nullable: true,
  })
  @IsOptional()
  @Type(() => Object)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  cohortExpression?: unknown;

  @Column({ default: false })
  @ApiProperty({
    description:
      "special case for contract signing (prevent doing other onboarding actions)",
  })
  @IsDefined()
  isContractSigningAction: boolean;

  @Column({
    type: "enum",
    enum: VisibilityMode,
    default: VisibilityMode.Public,
  })
  @ApiProperty({ enum: VisibilityMode, enumName: "VisibilityMode" })
  @IsDefined()
  visibilityMode: VisibilityMode;

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  usersJoined: number;

  @Column({ default: 0 })
  @ApiProperty({
    description: "Number of users who have completed the action",
  })
  @Allow()
  usersCompleted: number;

  @Column({ default: false })
  @ApiProperty({
    description:
      "Whether the action is an onboarding action (hide for existing members)",
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
  @ApiProperty({ description: "Priority of the action" })
  @IsDefined()
  priority: number;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  optional: boolean;

  @Column({ default: false })
  @ApiProperty({
    description: "Prevent completion of the action (for old actions)",
  })
  @Allow()
  preventCompletion: boolean;

  @Column({ default: false })
  @ApiProperty({
    description:
      "Whether the action is visible to and supposed to only be completed by non-members",
  })
  @Allow()
  publicOnly: boolean;

  @Column({ default: false })
  @ApiProperty({
    description:
      "Whether the action shows up in the tasks page after the deadline",
  })
  @Allow()
  shouldCompleteAfterDeadline: boolean;

  @Column({ default: false })
  @ApiProperty({
    description: "Whether to autocomplete action based on forum participation",
  })
  @Allow()
  isForumParticipationAction: boolean;

  @Column({ type: "int", nullable: true })
  @ApiPropertyOptional({
    description:
      "Manual override: forum post id whose repliers should be autocompleted. " +
      "When set, takes precedence over any forum validator on the task form.",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  forumParticipationPostId?: number;

  @Column({ default: false })
  @ApiPropertyOptional({
    description:
      "When using forumParticipationPostId, also count replies to nested child posts",
  })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  forumParticipationIncludeChildren?: boolean;

  @Column({ type: "timestamptz", nullable: true })
  @ApiPropertyOptional({
    description: "Date and time when the action was computed for autocomplete",
  })
  @IsOptional()
  @Type(() => Date)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  computedAutocompleteAt?: Date;

  @Column({ type: "enum", enum: CustomActionStat, nullable: true })
  @Type(() => String)
  @ApiPropertyOptional({ enum: CustomActionStat, enumName: "CustomActionStat" })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  customStatType?: CustomActionStat;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  customStatLabel?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  customStatValue?: number;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  customStatGoal?: number;

  // Relations

  @OneToMany(() => ActionEvent, (event) => event.action)
  @ApiProperty({
    description: "Events associated with the action",
    type: () => ActionEvent,
    isArray: true,
  })
  @Allow()
  @IsArray()
  @Type(() => ActionEvent)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  events: Relation<ActionEvent>[];

  @OneToMany(() => ActionActivity, (activity) => activity.action)
  @ApiProperty({
    description: "Activities associated with the action",
    type: () => [ActionActivity],
    isArray: true,
  })
  @Allow()
  @IsArray()
  @Type(() => ActionActivity)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  activities: Relation<ActionActivity>[];

  @OneToMany(() => ActionUpdate, (update) => update.action)
  @ApiProperty({
    type: () => ActionUpdate,
    isArray: true,
  })
  @Allow()
  @Type(() => ActionUpdate)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  updates: Relation<ActionUpdate>[];

  @OneToMany(() => FollowUpForm, (followUpForm) => followUpForm.action)
  @ApiProperty({
    type: () => FollowUpForm,
    isArray: true,
  })
  @Allow()
  @Type(() => FollowUpForm)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  followUpForms: Relation<FollowUpForm>[];

  @OneToMany(() => ActionFormVariant, (variant) => variant.action)
  @ApiProperty({
    type: () => ActionFormVariant,
    isArray: true,
  })
  @Allow()
  @Type(() => ActionFormVariant)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  formVariants: Relation<ActionFormVariant>[];

  @ManyToOne(() => ActionSuite, (suite) => suite.actions, { nullable: true })
  @ApiPropertyOptional({ type: () => ActionSuite })
  @Type(() => ActionSuite)
  @IsOptional()
  suite?: Relation<ActionSuite> | null;

  @ManyToMany(() => User, (user) => user.authoredActions, { cascade: true })
  @JoinTable()
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  authors?: Relation<User>[];

  @Column({ type: "jsonb", default: [] })
  @ApiProperty({
    type: () => ActionReviewer,
    isArray: true,
    description: "Non-user reviewers credited on the action",
    maxItems: ACTION_REVIEWERS_MAX,
  })
  @Type(() => ActionReviewer)
  @IsArray()
  @ArrayMaxSize(ACTION_REVIEWERS_MAX)
  @ValidateNested({ each: true })
  reviewers: ActionReviewer[];

  // Methods

  @IsOptional()
  private _status: ActionStatus | null = null;
  @Expose()
  @ApiProperty({ enum: ActionStatus, enumName: "ActionStatus" })
  get status(): ActionStatus {
    if (!this.events) {
      throw new Error("`events` relation is not loaded");
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
  private _memberActionPhase: MemberActionPhase | null = null;
  get memberActionPhase(): MemberActionPhase {
    if (!this._memberActionPhase) {
      this._memberActionPhase = this.events
        ? memberActionPhase(this.events)
        : { event: null, deadlineEvent: null };
    }
    return this._memberActionPhase;
  }

  @IsOptional()
  get deadlineWeekNumber(): number | null {
    const deadline = this.memberActionPhase.deadlineEvent?.date;
    if (!deadline) {
      return null;
    } else {
      return Math.floor(deadline.getTime() / MS_IN_WEEK);
    }
  }
}

/**
 * An Action whose jsonb columns have been parsed, including those of any
 * loaded follow-up form. Produce with {@link parseAction} immediately after
 * pulling an Action from the db (or any other untyped source), so the parse
 * happens exactly once and everything downstream works with a typed
 * expression.
 */
export interface ParsedAction extends Action {
  cohortExpression: CohortExpression | null;
  followUpForms: ParsedFollowUpForm[];
}

export function parseAction(action: Action): ParsedAction {
  action.cohortExpression =
    action.cohortExpression == null
      ? null
      : cohortExpressionSchema.parse(action.cohortExpression);
  action.followUpForms = action.followUpForms?.map(parseFollowUpForm);
  // Mutate-and-cast (rather than spread) to keep the entity's getters; the
  // assignments above just validated the only fields the cast narrows.
  return action as ParsedAction;
}
