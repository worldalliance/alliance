import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from "typeorm";

/**
 * Marks a suite as partitioned: its parts and grid assign its actions, in place of
 * each action's own cohort rule. A suite never stops being partitioned.
 */
@Entity()
export class SuitePartition {
  @PrimaryColumn()
  suiteId: number;

  @OneToOne(() => ActionSuite, (suite) => suite.partition)
  @JoinColumn({ name: "suiteId" })
  suite?: Relation<ActionSuite>;

  @Column({ type: "int", nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;

  /** Set when go-live validation refused the partition; nothing went live. */
  @Column({ type: "timestamptz", nullable: true })
  launchFailedAt: Date | null;

  @Column({ type: "text", nullable: true })
  launchFailure: string | null;
}
