import { DeleteDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ActionSuiteSplit } from "./action-suite-split.entity";
import { Action } from "./action.entity";

@Entity()
@Index("IDX_action_suite_split_arm_actionId_live", ["actionId"], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index("IDX_action_suite_split_arm_splitId", ["splitId"])
export class ActionSuiteSplitArm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  splitId: number;

  /** Eager so an action's eager `splitArms` carry their split's display. */
  @ManyToOne(() => ActionSuiteSplit, (split) => split.arms, {
    onDelete: "CASCADE",
    eager: true,
  })
  @JoinColumn({ name: "splitId" })
  split?: Relation<ActionSuiteSplit>;

  @Column()
  actionId: number;

  @ManyToOne(() => Action, (action) => action.splitArms, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  action?: Relation<Action>;

  @Column()
  position: number;

  /** Null on the last arm, which catches everyone the earlier arms don't. */
  @Column({ type: "jsonb", nullable: true })
  rule: unknown | null;

  /** Stands in for the arm action's own `optional`, which stays false. */
  @Column({ default: false })
  optional: boolean;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
