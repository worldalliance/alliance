import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsEmpty, IsInt, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ActionBranch } from "./action-branch.entity";
import { ActionFormVariant } from "./action-form-variant.entity";
import { Action } from "./action.entity";

// Records which form variant or branch a user has been assigned to for an
// action. With neither set, the user is on the action's default form
// (`action.taskFormId`). Sticky: once a row exists, only staff change it (a
// move or a re-route), though deleting its variant or branch before launch
// deletes the row.
@Entity()
@Check(
  "CHK_action_form_assignment_variant_or_branch",
  `"variantId" IS NULL OR "branchId" IS NULL`,
)
@Index("UQ_action_form_assignment_actionId_userId", ["actionId", "userId"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index("IDX_action_form_assignment_variantId", ["variantId"])
@Index("IDX_action_form_assignment_branchId", ["branchId"])
@Index("IDX_action_form_assignment_actionId", ["actionId"])
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
  @IsOptional()
  action?: Relation<Action>;

  @Column()
  @ApiProperty()
  @IsInt()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Type(() => User)
  @IsOptional()
  user?: Relation<User>;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  variantId: number | null;

  @ManyToOne(() => ActionFormVariant, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "variantId" })
  @Type(() => ActionFormVariant)
  @IsOptional()
  variant?: Relation<ActionFormVariant> | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ nullable: true, type: Number })
  @IsOptional()
  branchId: number | null;

  @ManyToOne(() => ActionBranch, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "branchId" })
  @Type(() => ActionBranch)
  @IsOptional()
  branch?: Relation<ActionBranch> | null;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  assignedAt: Date;

  /** Set when staff moved the member by hand; a re-route skips them. */
  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @IsOptional()
  overriddenAt: Date | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  overriddenById: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "overriddenById" })
  @Type(() => User)
  @IsOptional()
  overriddenBy?: Relation<User> | null;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}
