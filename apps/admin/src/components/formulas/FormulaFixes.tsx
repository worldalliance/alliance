import type {
  FormulaDto,
  FormulaEditDto,
  FormulaProblemDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useRef } from "react";
import { asDraft } from "../../lib/formulaDraft";
import FormulaFields from "./FormulaFields";
import OtherFormulaProblems from "./OtherFormulaProblems";
import PartFixFields, { partFixOf, type PartFixDraft } from "./PartFixFields";

/** A fix being made in this save, whose heading takes focus once its fix opens. */
const FixSection: React.FC<{
  id: string;
  /** The fix "Fix it in this save" opened, whose heading takes focus from that unmounted button. */
  focusFix: React.RefObject<string | null>;
  heading: React.ReactNode;
  onStop: () => void;
  children: React.ReactNode;
}> = ({ id, focusFix, heading, onStop, children }) => (
  <section className="border-t border-zinc-200 pt-4 space-y-2">
    <div className="flex items-center gap-3">
      <h2
        ref={(element) => {
          if (element === null || focusFix.current !== id) return;
          focusFix.current = null;
          element.focus();
        }}
        tabIndex={-1}
        className="font-semibold text-zinc-900"
      >
        {heading}
      </h2>
      <Button size="small" color={ButtonColor.White} onClick={onStop}>
        Stop fixing it
      </Button>
    </div>
    {children}
  </section>
);

/**
 * Formulas and parts whose problems refused a save, each with "Fix it
 * in this save", and the fields of those being fixed, which the next save
 * sends along.
 */
const FormulaFixes: React.FC<{
  fixes: FormulaEditDto[];
  onFixesChange: (fixes: FormulaEditDto[]) => void;
  /** Part conditions being fixed in the same save. */
  partFixes: PartFixDraft[];
  onPartFixesChange: (fixes: PartFixDraft[]) => void;
  /** The problems not shown elsewhere on the page. */
  problems: FormulaProblemDto[];
  /** The formulas as the page opened them. */
  formulas: FormulaDto[];
  readOnly: boolean;
  /** Heads the problems in formulas not being fixed yet. */
  heading: string;
  /**
   * "Stop fixing it" dropped the fix of `id` and unmounted the button that had
   * focus. The caller drops `id`'s problems, or they reappear with "Fix it in
   * this save", and moves focus.
   */
  onStopped: (id: string) => void;
}> = ({
  fixes,
  onFixesChange,
  partFixes,
  onPartFixesChange,
  problems,
  formulas,
  readOnly,
  heading,
  onStopped,
}) => {
  const focusFix = useRef<string | null>(null);
  const fixing = new Set([
    ...fixes.map((fix) => fix.id),
    ...partFixes.map((fix) => fix.problemId),
  ]);
  return (
    <>
      {fixes.map((fix) => (
        <FixSection
          key={fix.id}
          id={fix.id}
          focusFix={focusFix}
          onStop={() => {
            onFixesChange(fixes.filter((other) => other.id !== fix.id));
            onStopped(fix.id);
          }}
          heading={
            <>
              Fixing{" "}
              <span className="font-mono">
                {formulas.find((formula) => formula.id === fix.id)?.name ??
                  fix.name}
              </span>{" "}
              in this save
            </>
          }
        >
          <FormulaFields
            draft={fix}
            problems={problems.filter((problem) => problem.id === fix.id)}
            onChange={(next) =>
              onFixesChange(
                fixes.map((other) => (other.id === fix.id ? next : other)),
              )
            }
            readOnly={readOnly}
          />
        </FixSection>
      ))}
      {partFixes.map((draft) => (
        <FixSection
          key={draft.problemId}
          id={draft.problemId}
          focusFix={focusFix}
          onStop={() => {
            onPartFixesChange(
              partFixes.filter((other) => other.problemId !== draft.problemId),
            );
            onStopped(draft.problemId);
          }}
          heading={
            <>
              Fixing part &quot;{draft.part.partName}&quot; of{" "}
              {draft.part.suiteName} in this save
            </>
          }
        >
          <PartFixFields
            draft={draft}
            problems={problems.filter(
              (problem) => problem.id === draft.problemId,
            )}
            readOnly={readOnly}
            onChange={(fix) =>
              onPartFixesChange(
                partFixes.map((other) =>
                  other.problemId === draft.problemId
                    ? { ...other, fix }
                    : other,
                ),
              )
            }
          />
        </FixSection>
      ))}
      <OtherFormulaProblems
        problems={problems.filter((problem) => !fixing.has(problem.id))}
        formulas={formulas}
        heading={heading}
        onFixPart={(problem) => {
          focusFix.current = problem.id;
          onPartFixesChange([...partFixes, partFixOf(problem)]);
        }}
        onFix={(formula, problem) => {
          focusFix.current = formula.id;
          onFixesChange([
            ...fixes,
            // Printed with the names this save gives, which the formula's
            // stored text may not have.
            { ...asDraft(formula), text: problem.text ?? formula.text },
          ]);
        }}
      />
    </>
  );
};

export default FormulaFixes;
