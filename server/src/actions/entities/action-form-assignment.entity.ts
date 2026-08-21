import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsInt, IsOptional } from "class-validator";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { ActionFormVariant } from "./action-form-variant.entity";
import { Action } from "./action.entity";

// Records which form variant a user has been assigned to for an action.
// `variantId = null` means the user is on the action's default form
// (`action.taskFormId`). Sticky: once a row exists, it never changes.
@Entity()
@Unique("UQ_action_form_assignment_actionId_userId", ["actionId", "userId"])
@Index("IDX_action_form_assignment_variantId", ["variantId"])
export class ActionFormAssignment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsInt()
  actionId: number;

  @ManyToOne(() => Action, { onDelete: "CASCADE" })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

  @Column()
  @ApiProperty()
  @IsInt()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Type(() => User)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  variantId: number | null;

  @ManyToOne(() => ActionFormVariant, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "variantId" })
  @Type(() => ActionFormVariant)
  @IsOptional()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  variant: Relation<ActionFormVariant> | null;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  assignedAt: Date;
}
