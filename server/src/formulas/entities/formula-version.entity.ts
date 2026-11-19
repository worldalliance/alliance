import type { Expr } from "@alliance/common/expression/tree";
import { exprSchema } from "@alliance/common/expression/tree-schema";
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
import { Formula } from "./formula.entity";

/** One save of a formula. Never updated, so a pinned version stays as saved. */
@Entity()
export class FormulaVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: "uuid" })
  formulaId: string;

  @ManyToOne(() => Formula, (formula) => formula.versions)
  @JoinColumn({ name: "formulaId" })
  formula?: Relation<Formula>;

  /** The name it was saved under; other expressions print its current one. */
  @Column()
  name: string;

  /** An `Expr`; read it through `readFormulaVersion`. */
  @Column({ type: "jsonb" })
  tree: unknown;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "int", nullable: true })
  savedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "savedById" })
  savedBy?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}

export type ParsedFormulaVersion = Omit<FormulaVersion, "tree"> & {
  tree: Expr;
};

export function readFormulaVersion(
  version: FormulaVersion,
): Result<ParsedFormulaVersion, z.ZodError> {
  const tree = exprSchema.safeParse(version.tree);
  return tree.success
    ? R.success({ ...version, tree: tree.data })
    : R.failure(tree.error);
}

export function parseFormulaVersion(
  version: FormulaVersion,
): ParsedFormulaVersion {
  return R.unwrap(readFormulaVersion(version));
}
