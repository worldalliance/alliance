import type {
  FormulaDto,
  FormulaProblemDto,
  SaveProblemKind,
  SplitGroupRefDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import NewTabMark from "@alliance/sharedweb/ui/NewTabMark";
import React from "react";
import { Link } from "react-router";
import FormulaDiagnostics from "./FormulaDiagnostics";

/** A dependent isn't a formula, so it has no formula page or fields. */
const IN_A_FORMULA: Record<SaveProblemKind, boolean> = {
  name: true,
  named: true,
  dependent: false,
};

const SplitGroupProblem: React.FC<{
  problem: FormulaProblemDto & { split: SplitGroupRefDto };
  onFix: (problem: FormulaProblemDto & { split: SplitGroupRefDto }) => void;
}> = ({ problem, onFix }) => (
  <div className="flex items-center gap-3">
    <Link
      to={`/suites/${problem.split.suiteId}`}
      target="_blank"
      className="text-sm underline"
    >
      Group &quot;{problem.split.groupName}&quot; of {problem.split.suiteName}
      <NewTabMark />
    </Link>
    <Button
      size="small"
      color={ButtonColor.White}
      onClick={() => onFix(problem)}
    >
      Fix it in this save
    </Button>
  </div>
);

/**
 * Problems refusing a save in formulas the page isn't editing or in split
 * groups, each with a way to fix it in the same save. A formula the save reads
 * can be listed without the save having broken it.
 */
const OtherFormulaProblems: React.FC<{
  problems: FormulaProblemDto[];
  formulas: FormulaDto[];
  onFix: (formula: FormulaDto, problem: FormulaProblemDto) => void;
  onFixGroup: (
    problem: FormulaProblemDto & { split: SplitGroupRefDto },
  ) => void;
  heading: string;
}> = ({ problems, formulas, onFix, onFixGroup, heading }) => {
  if (problems.length === 0) return null;
  return (
    <section className="border border-red-300 rounded p-4 space-y-4 max-w-3xl">
      <h2 className="font-semibold text-red-800">{heading}</h2>
      <ul className="space-y-4">
        {problems.map((problem) => {
          const formula = formulas.find((each) => each.id === problem.id);
          return (
            <li key={`${problem.kind}:${problem.id}`} className="space-y-2">
              {!IN_A_FORMULA[problem.kind] ? (
                problem.split === undefined ? (
                  <p className="font-mono text-sm">{problem.id}</p>
                ) : (
                  <SplitGroupProblem
                    problem={{ ...problem, split: problem.split }}
                    onFix={onFixGroup}
                  />
                )
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to={`/formulas/${problem.id}`}
                    target="_blank"
                    className="font-mono text-sm underline"
                  >
                    {formula?.name ?? problem.id}
                    <NewTabMark />
                  </Link>
                  {formula === undefined ? (
                    <span className="text-sm text-zinc-600">
                      Added since this page opened, so fix it on its own page.
                    </span>
                  ) : (
                    <Button
                      size="small"
                      color={ButtonColor.White}
                      onClick={() => onFix(formula, problem)}
                    >
                      Fix it in this save
                    </Button>
                  )}
                </div>
              )}
              <FormulaDiagnostics problem={problem} />
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default OtherFormulaProblems;
