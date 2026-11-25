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
import { SuitePartitionPin } from "./suite-partition-pin.entity";
import { SuitePartition } from "./suite-partition.entity";

/**
 * The part a member's partition placed them in, fixed once per suite, and the
 * trace of how. Their decision rows for the suite's actions follow from it.
 */
@Entity()
@Unique("UQ_suite_partition_placement_suiteId_userId", ["suiteId", "userId"])
@Index("IDX_suite_partition_placement_userId", ["userId"])
export class SuitePartitionPlacement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  suiteId: number;

  @ManyToOne(() => SuitePartition)
  @JoinColumn({ name: "suiteId" })
  partition?: Relation<SuitePartition>;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column({ type: "uuid" })
  partId: string;

  @Column()
  pinId: number;

  @ManyToOne(() => SuitePartitionPin)
  @JoinColumn({ name: "pinId" })
  pin?: Relation<SuitePartitionPin>;

  /** A `Trace`; read it through `traceSchema`. */
  @Column({ type: "jsonb" })
  trace: unknown;

  @CreateDateColumnTz()
  placedAt: Date;
}
