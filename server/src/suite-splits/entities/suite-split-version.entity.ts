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
import { splitGroupsSchema, type SplitGroup } from "../split-groups";
import { SuiteSplit } from "./suite-split.entity";

/** One save of a split's groups and grid. Never updated; the latest is current. */
@Entity()
export class SuiteSplitVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  suiteId: number;

  @ManyToOne(() => SuiteSplit)
  @JoinColumn({ name: "suiteId" })
  split?: Relation<SuiteSplit>;

  /** `SplitGroup[]`; read it through `readSplitVersion`. */
  @Column({ type: "jsonb" })
  groups: unknown;

  @Column({ type: "int", nullable: true })
  savedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "savedById" })
  savedBy?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}

export type ParsedSplitVersion = Omit<SuiteSplitVersion, "groups"> & {
  groups: SplitGroup[];
};

export function readSplitVersion(
  version: SuiteSplitVersion,
): Result<ParsedSplitVersion, z.ZodError> {
  const groups = splitGroupsSchema.safeParse(version.groups);
  return groups.success
    ? R.success({ ...version, groups: groups.data })
    : R.failure(groups.error);
}
