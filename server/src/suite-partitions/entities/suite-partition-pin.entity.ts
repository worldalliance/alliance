import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SuitePartitionVersion } from "./suite-partition-version.entity";
import { SuitePartition } from "./suite-partition.entity";

/**
 * The exact versions a partition's members are placed against: the partition version
 * and every formula and member list version it reads, as they stood at
 * `pinnedAt`.
 */
@Entity()
export class SuitePartitionPin {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  suiteId: number;

  @ManyToOne(() => SuitePartition)
  @JoinColumn({ name: "suiteId" })
  partition?: Relation<SuitePartition>;

  @Column()
  partitionVersionId: number;

  @ManyToOne(() => SuitePartitionVersion)
  @JoinColumn({ name: "partitionVersionId" })
  partitionVersion?: Relation<SuitePartitionVersion>;

  @Column({ type: "integer", array: true })
  formulaVersionIds: number[];

  @Column({ type: "integer", array: true })
  listVersionIds: number[];

  /** Go-live: the `member_action` event's time, not when the pass ran. */
  @Column({ type: "timestamptz" })
  pinnedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
