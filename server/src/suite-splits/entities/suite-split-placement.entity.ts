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
import { SuiteSplitPin } from "./suite-split-pin.entity";
import { SuiteSplit } from "./suite-split.entity";

/**
 * The group a member's split placed them in, fixed once per suite, and the
 * trace of how. Their decision rows for the suite's actions follow from it.
 */
@Entity()
@Unique("UQ_suite_split_placement_suiteId_userId", ["suiteId", "userId"])
@Index("IDX_suite_split_placement_userId", ["userId"])
export class SuiteSplitPlacement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  suiteId: number;

  @ManyToOne(() => SuiteSplit)
  @JoinColumn({ name: "suiteId" })
  split?: Relation<SuiteSplit>;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column({ type: "uuid" })
  groupId: string;

  @Column()
  pinId: number;

  @ManyToOne(() => SuiteSplitPin)
  @JoinColumn({ name: "pinId" })
  pin?: Relation<SuiteSplitPin>;

  /** A `Trace`; read it through `traceSchema`. */
  @Column({ type: "jsonb" })
  trace: unknown;

  @CreateDateColumnTz()
  placedAt: Date;
}
