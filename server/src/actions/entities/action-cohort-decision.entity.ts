import { ApiProperty } from "@nestjs/swagger";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { ActionCohortDecisionCorrection } from "./action-cohort-decision-correction.entity";
import { Action } from "./action.entity";
import { CohortDecisionReason } from "./cohort-decision-reason";

/**
 * The final answer to "is this member in this action's cohort?". A missing row
 * means not yet decided, never excluded. Contract, away, and dismissal stay
 * derived at read time.
 */
@Entity()
@Check(
  "CHK_action_cohort_decision_after_deadline_excluded",
  `"reason" <> 'resolved_after_deadline' OR NOT "included"`,
)
@Unique("UQ_action_cohort_decision_actionId_userId", ["actionId", "userId"])
@Index("IDX_action_cohort_decision_userId", ["userId"])
export class ActionCohortDecision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actionId: number;

  @ManyToOne(() => Action, { onDelete: "CASCADE" })
  @JoinColumn({ name: "actionId" })
  action?: Relation<Action>;

  @ApiProperty()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @ApiProperty()
  @Column()
  included: boolean;

  @ApiProperty({ enum: CohortDecisionReason, enumName: "CohortDecisionReason" })
  @Column({ type: "enum", enum: CohortDecisionReason })
  reason: CohortDecisionReason;

  @ApiProperty({ type: Date })
  @Column({ type: "timestamptz" })
  resolvedAt: Date;

  @OneToMany(
    () => ActionCohortDecisionCorrection,
    (correction) => correction.decision,
  )
  corrections?: Relation<ActionCohortDecisionCorrection[]>;
}
