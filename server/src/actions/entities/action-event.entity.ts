import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsDefined,
  IsEmpty,
  IsNotEmpty,
  IsOptional,
} from "class-validator";
import {
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ActionUpdate } from "./action-update.entity";
import { Action } from "./action.entity";

export enum NotificationType {
  All = "all",
  Joined = "joined",
  None = "none",
}

export enum ActionStatus {
  Draft = "draft",
  Planned = "planned",
  OfficeAction = "office_action",
  MemberAction = "member_action", // members start doing the action
  Resolution = "resolution", // member action done, office working on resolution
  Completed = "completed", // resolution done
  Failed = "failed", // resolution failed
  Abandoned = "abandoned", // process aborted
}

export const readableActionStatus: Record<ActionStatus, string> = {
  [ActionStatus.Draft]: "Draft",
  [ActionStatus.Planned]: "Planned",
  [ActionStatus.OfficeAction]: "Office action",
  [ActionStatus.MemberAction]: "Members taking action",
  [ActionStatus.Resolution]: "Resolution ongoing",
  [ActionStatus.Completed]: "Completed",
  [ActionStatus.Failed]: "Failed",
  [ActionStatus.Abandoned]: "Abandoned",
};

@Entity()
@Index(["action", "date"])
@Index(["action", "newStatus", "date"])
@Index("UQ_action_event_one_member_action", ["action"], {
  unique: true,
  where: `"newStatus" = 'member_action' AND "deletedAt" IS NULL`,
})
export class ActionEvent {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: "Unique identifier for the action event" })
  @Allow()
  id: number;

  @IsNotEmpty()
  @Column()
  @ApiProperty({ description: "Title of the event" })
  title: string;

  @Column()
  @ApiProperty({ description: "secondary text" })
  @Allow()
  description: string;

  @Column({ type: "enum", enum: ActionStatus, default: ActionStatus.Draft })
  @IsNotEmpty()
  @ApiProperty({
    description: "New status of the action after the event",
    enum: ActionStatus,
    enumName: "ActionStatus",
  })
  newStatus: ActionStatus;

  @Column({ type: "timestamptz" })
  @ApiProperty({ description: "time of the event (for display)" })
  @IsNotEmpty()
  @Type(() => Date)
  date: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ description: "Timestamp when the event was last updated" })
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  @ManyToOne(() => Action, (action) => action.events, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  @ApiProperty({
    description: "The action associated with this event",
    type: () => Action,
    nullable: false,
  })
  @IsDefined()
  @Allow()
  @Type(() => Action)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

  @OneToMany(() => ActionUpdate, (update) => update.associatedEvent)
  @ApiPropertyOptional({ type: () => ActionUpdate, isArray: true })
  @Type(() => ActionUpdate)
  @IsOptional()
  updates?: Relation<ActionUpdate>[];

  @ApiProperty()
  @Column({ default: false })
  @Allow()
  suiteManaged: boolean;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}
