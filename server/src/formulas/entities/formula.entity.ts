import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import { Column, Entity, Index, OneToMany, PrimaryColumn } from "typeorm";
import { FormulaVersion } from "./formula-version.entity";

/**
 * A formula: a named expression other expressions read by id. Its saves are
 * immutable `FormulaVersion`s; the latest is current.
 */
@Entity()
export class Formula {
  /** Chosen by the client, so one save can create formulas that read each other. */
  @PrimaryColumn("uuid")
  id: string;

  @Index({ unique: true, where: '"deletedAt" IS NULL' })
  @Column()
  name: string;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  /** Versions outlive it, since a live partition or fill session may pin one. */
  @DeleteDateColumnTz()
  deletedAt: Date | null;

  @OneToMany(() => FormulaVersion, (version) => version.formula)
  versions?: Relation<FormulaVersion>[];
}
