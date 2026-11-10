import {
  cohortExpressionSchema,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import {
  CreateDateColumnTz,
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
import { ActionSuiteSplitArm } from "./action-suite-split-arm.entity";
import { ActionSuite } from "./action-suite.entity";

export enum SplitVisibilityMode {
  /** Other members see each arm as an ordinary action. */
  PerArm = "per_arm",
  /** Other members see the split's title and counts summed across its arms. */
  Combined = "combined",
}

/**
 * Routes each member the suite's split reaches to exactly one of its arms:
 * the first whose rule they match, or the last, which has no rule.
 */
@Entity()
@Index("IDX_action_suite_split_suiteId", ["suiteId"])
export class ActionSuiteSplit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  suiteId: number;

  @ManyToOne(() => ActionSuite, { onDelete: "CASCADE" })
  @JoinColumn({ name: "suiteId" })
  suite?: Relation<ActionSuite>;

  /** What other members see in place of the arms in the combined mode. */
  @Column()
  title: string;

  @Column({
    type: "enum",
    enum: SplitVisibilityMode,
    default: SplitVisibilityMode.Combined,
  })
  visibilityMode: SplitVisibilityMode;

  /** Who the split reaches at all; null reaches every admitted member. */
  @Column({ type: "jsonb", nullable: true })
  filterExpression: unknown | null;

  @OneToMany(() => ActionSuiteSplitArm, (arm) => arm.split)
  arms?: Relation<ActionSuiteSplitArm>[];

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}

export interface ParsedSplitArm extends ActionSuiteSplitArm {
  rule: CohortExpression | null;
}

/** A split whose arms are loaded, parsed and in routing order. */
export interface ParsedSplit extends ActionSuiteSplit {
  filterExpression: CohortExpression | null;
  arms: ParsedSplitArm[];
}

export function parseSplit(split: ActionSuiteSplit): ParsedSplit {
  if (!split.arms) {
    throw new Error(`arms of split ${split.id} not loaded`);
  }
  const parse = (value: unknown) =>
    value == null ? null : cohortExpressionSchema.parse(value);
  const arms = split.arms
    .map((arm) => Object.assign(arm, { rule: parse(arm.rule) }))
    .sort((a, b) => a.position - b.position);
  return Object.assign(split, {
    filterExpression: parse(split.filterExpression),
    arms,
  });
}
