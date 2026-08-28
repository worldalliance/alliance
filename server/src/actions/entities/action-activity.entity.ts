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
  @Allow()
  @Type(() => Action)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

  @Column()
  @ApiProperty()
  @Allow()
  actionId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Allow()
  @Type(() => User)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

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
  @Allow()
  @ApiProperty({ type: () => User, isArray: true })
  @Type(() => User)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  likes: Relation<User>[];

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

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  declineReason?: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  isMoral?: boolean; // for moral declines

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  outOfTime?: boolean; // for opting out due to running out of time

  @Column({ type: "enum", enum: ActivitySource, default: ActivitySource.USER })
  @ApiProperty({
    description: "Source of the activity",
    enum: ActivitySource,
    enumName: "ActivitySource",
  })
  @Allow()
  source: ActivitySource;
}
