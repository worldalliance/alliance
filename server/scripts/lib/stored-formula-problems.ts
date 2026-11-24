import {
  SaveProblemKind,
  checkStored,
  type SaveProblem,
} from "@alliance/common/expression/named";
import { R, type Result } from "@alliance/common/result";
import type { EntityManager } from "typeorm";
import { z } from "zod";
import { readFormulaVersion } from "../../src/formulas/entities/formula-version.entity";
import { formulaCatalog } from "../../src/formulas/formula-catalog";
import {
  asNamed,
  currentVersions,
  type CurrentFormula,
} from "../../src/formulas/formula-store";
import {
  draftPartitions,
  labelOf,
  partitionDependents,
  type DraftPartition,
} from "../../src/suite-partitions/partition-dependents";

/**
 * Re-runs the save check over every stored formula, and the condition of
 * each part in a partition whose suite hasn't gone live, against this release's
 * catalog and check. Resolves to how many of each passed, or to a report
 * naming each formula or part this release breaks or can't read.
 */
export async function checkStoredFormulas(
  manager: EntityManager,
): Promise<Result<{ formulas: number; parts: number }, string>> {
  const stored = (await currentVersions(manager)).map(
    ({ formula, version }) => ({
      formula,
      version: readFormulaVersion(version),
    }),
  );
  const unreadable = stored.flatMap(({ formula, version }) =>
    version.ok ? [] : [`${label(formula)}:`, z.prettifyError(version.error)],
  );
  if (unreadable.length > 0) {
    return R.failure(
      [
        "This release can't read these stored formulas. Change the release so it reads them:",
        ...unreadable,
      ].join("\n"),
    );
  }
  const current = stored.flatMap(({ formula, version }) =>
    version.ok ? [{ formula, version: version.value }] : [],
  );
  const partitions = await draftPartitions(manager);
  const dependents = partitionDependents(partitions, []).flatMap((each) =>
    "stored" in each ? [each] : [],
  );
  const checked = checkStored({
    catalog: await formulaCatalog(manager),
    named: current.map(asNamed),
    dependents,
  });
  return checked.ok
    ? R.success({ formulas: current.length, parts: dependents.length })
    : R.failure(
        describeStoredProblems({
          problems: checked.error,
          current,
          partitions,
        }),
      );
}

function dependentLabel(
  partitions: readonly DraftPartition[],
  id: string,
): string {
  const partition = labelOf(partitions, id);
  return partition === undefined
    ? `Dependent ${id}`
    : `Part "${partition.partName}" of suite "${partition.suiteName}" (${partition.suiteId})`;
}

const label = ({ id, name }: { id: string; name: string }) =>
  `Formula \`${name}\` (${id})`;

function describeStoredProblems({
  problems,
  current,
  partitions,
}: {
  problems: readonly SaveProblem[];
  current: readonly CurrentFormula[];
  partitions: readonly DraftPartition[];
}): string {
  const names = new Map(
    current.map(({ formula }) => [formula.id, formula.name]),
  );
  const formula = (id: string) => label({ id, name: names.get(id) ?? id });
  const lines = problems.flatMap((problem): string[] => {
    switch (problem.kind) {
      case SaveProblemKind.Name:
        return [`${formula(problem.id)}: ${problem.message}`];
      case SaveProblemKind.Named:
      case SaveProblemKind.Dependent: {
        const owner =
          problem.kind === SaveProblemKind.Named
            ? formula(problem.id)
            : dependentLabel(partitions, problem.id);
        return [
          `${owner}: ${problem.text}`,
          ...problem.diagnostics.map(
            ({ message, start, end }) =>
              `  at ${start}–${end} \`${problem.text.slice(start, end)}\`: ${message}`,
          ),
        ];
      }
      default:
        throw new Error(`unknown problem kind: ${problem satisfies never}`);
    }
  });
  return [
    "This release breaks stored formulas. Change the release, or fix the formulas in admin first:",
    ...lines,
  ].join("\n");
}
