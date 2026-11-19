import type { NamedExpression } from "@alliance/common/expression/catalog";
import type { EntityManager } from "typeorm";
import {
  FormulaVersion,
  parseFormulaVersion,
  type ParsedFormulaVersion,
} from "./entities/formula-version.entity";
import { Formula } from "./entities/formula.entity";

export const FORMULAS_LOCK = "formulas";

export type CurrentFormula = {
  formula: Formula;
  version: ParsedFormulaVersion;
};

/** Every formula that isn't deleted, with its latest version, by name. */
export async function currentFormulas(
  manager: EntityManager,
): Promise<CurrentFormula[]> {
  const versions = await manager
    .createQueryBuilder(FormulaVersion, "version")
    .innerJoinAndSelect("version.formula", "formula")
    .distinctOn(["version.formulaId"])
    .orderBy("version.formulaId")
    .addOrderBy("version.id", "DESC")
    .getMany();
  return versions
    .flatMap(({ formula, ...version }) =>
      formula === undefined
        ? []
        : [{ formula, version: parseFormulaVersion({ ...version }) }],
    )
    .sort((a, b) => a.formula.name.localeCompare(b.formula.name));
}

export const asNamed = ({
  formula,
  version,
}: CurrentFormula): NamedExpression => ({
  id: formula.id,
  name: formula.name,
  tree: version.tree,
});
