import type {
  FormulaDto,
  FormulaProblemDto,
  PartitionPartRefDto,
  SaveProblemKind,
} from "@alliance/shared/client";
import React, { useId, type ReactNode } from "react";
import { href, Link } from "react-router";
import { suiteHref } from "../../lib/hrefs";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import NewTabMark from "../../ui/NewTabMark";
import { linkClass } from "../../ui/styles";
import FormulaDiagnostics from "./FormulaDiagnostics";

/** A dependent isn't a formula, so it has no formula page or fields. */
const IN_A_FORMULA: Record<SaveProblemKind, boolean> = {
  name: true,
  named: true,
  dependent: false,
};

type PartProblem = FormulaProblemDto & { partition: PartitionPartRefDto };

/** One problem: what it is in, opening in a new tab, how to fix it, and where. */
function ProblemItem({
  label,
  fix,
  problem,
}: {
  label: (id: string) => ReactNode;
  fix: (describedBy: string) => ReactNode;
  problem: FormulaProblemDto;
}) {
  const id = useId();
  return (
    <li className="flex flex-col gap-2">
      <div className="flex min-h-control flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {label(id)}
        {fix(id)}
      </div>
      <FormulaDiagnostics problem={problem} />
    </li>
  );
}

const FIX_LABEL = "Fix it in this save";

/**
 * Problems refusing a save in formulas the page isn't editing or in partition
 * parts, each with a way to fix it in the same save. A formula the save reads
 * can be listed without the save having broken it.
 */
const OtherFormulaProblems: React.FC<{
  problems: FormulaProblemDto[];
  formulas: FormulaDto[];
  onFix: (formula: FormulaDto, problem: FormulaProblemDto) => void;
  onFixPart: (problem: PartProblem) => void;
  heading: string;
}> = ({ problems, formulas, onFix, onFixPart, heading }) => {
  if (problems.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">{heading}</h3>
      <ul className="flex flex-col gap-4">
        {problems.map((problem) => {
          const key = `${problem.kind}:${problem.id}`;
          if (!IN_A_FORMULA[problem.kind]) {
            const { partition } = problem;
            return partition === undefined ? (
              <ProblemItem
                key={key}
                problem={problem}
                label={(id) => (
                  <p id={id} className="font-mono text-xs">
                    {problem.id}
                  </p>
                )}
                fix={() => null}
              />
            ) : (
              <ProblemItem
                key={key}
                problem={problem}
                label={(id) => (
                  <Link
                    id={id}
                    to={suiteHref(partition.suiteId)}
                    target="_blank"
                    className={linkClass}
                  >
                    Part &quot;{partition.partName}&quot; of{" "}
                    {partition.suiteName}
                    <NewTabMark />
                  </Link>
                )}
                fix={(describedBy) => (
                  <Button
                    size="small"
                    variant={ButtonVariant.Default}
                    aria-describedby={describedBy}
                    onClick={() => onFixPart({ ...problem, partition })}
                  >
                    {FIX_LABEL}
                  </Button>
                )}
              />
            );
          }
          const formula = formulas.find((each) => each.id === problem.id);
          return (
            <ProblemItem
              key={key}
              problem={problem}
              label={(id) => (
                <Link
                  id={id}
                  to={href("/tasks/formulas/:formulaId", {
                    formulaId: problem.id,
                  })}
                  target="_blank"
                  className={cn(linkClass, "font-mono text-xs")}
                >
                  {formula?.name ?? problem.id}
                  <NewTabMark />
                </Link>
              )}
              fix={(describedBy) =>
                formula === undefined ? (
                  <span className="text-caption text-fg-muted">
                    Added since this page opened, so fix it on its own page.
                  </span>
                ) : (
                  <Button
                    size="small"
                    variant={ButtonVariant.Default}
                    aria-describedby={describedBy}
                    onClick={() => onFix(formula, problem)}
                  >
                    {FIX_LABEL}
                  </Button>
                )
              }
            />
          );
        })}
      </ul>
    </section>
  );
};

export default OtherFormulaProblems;
