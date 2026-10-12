import { ActionActivityType } from "@alliance/common/actionActivity";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsEnum, IsOptional } from "class-validator";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Action } from "./action.entity";

export const ALLOW_DUPLICATE = {
  [ActionActivityType.USER_COMPLETED]: false,
  [ActionActivityType.USER_WONT_COMPLETE]: false,
  [ActionActivityType.USER_DISMISSED]: false,
  [ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM]: true,
} as const satisfies Record<ActionActivityType, boolean>;

export enum ActivitySource {
  USER = "user",
  ADMIN_OVERRIDE = "admin_override",
}

@Entity()
@Index("IDX_action_activity_type_createdAt", ["type", "createdAt"])
@Index("IDX_action_activity_user_type", ["userId", "type"])
export class ActionActivity {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @Column({ type: "enum", enum: ActionActivityType })
  @ApiProperty({
    description: "Type of action activity",
    enum: ActionActivityType,
    enumName: "ActionActivityType",
  })
  @Allow()
  @IsEnum(ActionActivityType)
  type: ActionActivityType;

  @ManyToOne(() => Action, { onDelete: "CASCADE" })
  @JoinColumn({ name: "actionId" })
  @IsOptional()
  @Type(() => Action)
  action?: Relation<Action>;

  @Column()
  @ApiProperty()
  @Allow()
  actionId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @IsOptional()
  @Type(() => User)
  user?: Relation<User>;

  @Column()
  @Allow()
  @ApiProperty()
  userId: number;

  @CreateDateColumnTz()
  @Allow()
  @Type(() => Date)
  @ApiProperty()
  createdAt: Date;

  @OneToOne(() => EditableContent, {
    cascade: true,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  @Allow()
  @IsOptional()
  @Type(() => EditableContent)
  @ApiPropertyOptional({ type: () => EditableContent })
  editableContent?: Relation<EditableContent>;

  @ManyToMany(() => User, { onDelete: "CASCADE" })
  @JoinTable()
  @IsOptional()
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  likes?: Relation<User>[];

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  likesCount: number;

  @ApiPropertyOptional({ type: () => FormResponse })
  @Type(() => FormResponse)
  @IsOptional()
  @OneToOne(() => FormResponse, {
    cascade: true,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  taskFormResponse?: Relation<FormResponse>;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  declineReason: string | null;

  @Column({ type: "boolean", nullable: true })
  @ApiProperty({ type: Boolean, nullable: true })
  @IsOptional()
  isMoral: boolean | null; // for moral declines

  @Column({ type: "boolean", nullable: true })
  @ApiProperty({ type: Boolean, nullable: true })
  @IsOptional()
  outOfTime: boolean | null; // for opting out due to running out of time

  @Column({ type: "enum", enum: ActivitySource, default: ActivitySource.USER })
  @ApiProperty({
    description: "Source of the activity",
    enum: ActivitySource,
    enumName: "ActivitySource",
  })
  @Allow()
  source: ActivitySource;
}

export function loadedActionActivityAction(
  activity: Pick<ActionActivity, "id" | "action">,
): Relation<Action> {
  if (!activity.action) {
    throw new Error(`action of action activity ${activity.id} not loaded`);
  }
  return activity.action;
}

export function loadedActionActivityUser(
  activity: Pick<ActionActivity, "id" | "user">,
): Relation<User> {
  if (!activity.user) {
    throw new Error(`user of action activity ${activity.id} not loaded`);
  }
  return activity.user;
}

export function loadedActionActivityLikes(
  activity: ActionActivity,
): Relation<User>[] {
  if (!activity.likes) {
    throw new Error(`likes of action activity ${activity.id} not loaded`);
  }
  return activity.likes;
}
