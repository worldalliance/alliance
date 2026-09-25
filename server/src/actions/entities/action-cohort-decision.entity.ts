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
  Unique,
} from "typeorm";
import { Action } from "./action.entity";

export enum CohortDecisionReason {
  Launch = "launch",
  Signing = "signing",
  /**
   * Processing first reached the member after the member-action deadline, so
   * the decision is an exclusion rather than a fresh missed obligation.
   */
  ResolvedAfterDeadline = "resolved_after_deadline",
  Backfill = "backfill",
}

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

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column()
  included: boolean;

  @Column({ type: "enum", enum: CohortDecisionReason })
  reason: CohortDecisionReason;

  @Column({ type: "timestamptz" })
  resolvedAt: Date;
}
