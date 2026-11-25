import { R, type Result } from "@alliance/common/result";
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
} from "typeorm";
import type { z } from "zod";
import { partitionPartsSchema, type PartitionPart } from "../partition-parts";
import { SuitePartition } from "./suite-partition.entity";

/** One save of a partition's parts and grid. Never updated; the latest is current. */
@Entity()
export class SuitePartitionVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  suiteId: number;

  @ManyToOne(() => SuitePartition)
  @JoinColumn({ name: "suiteId" })
  partition?: Relation<SuitePartition>;

  /** `PartitionPart[]`; read it through `readPartitionVersion`. */
  @Column({ type: "jsonb" })
  parts: unknown;

  @Column({ type: "int", nullable: true })
  savedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "savedById" })
  savedBy?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}

export type ParsedPartitionVersion = Omit<SuitePartitionVersion, "parts"> & {
  parts: PartitionPart[];
};

export function readPartitionVersion(
  version: SuitePartitionVersion,
): Result<ParsedPartitionVersion, z.ZodError> {
  const parts = partitionPartsSchema.safeParse(version.parts);
  return parts.success
    ? R.success({ ...version, parts: parts.data })
    : R.failure(parts.error);
}
