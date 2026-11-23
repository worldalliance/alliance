import type {
  FormulaEditDto,
  FormulaProblemDto,
  SaveProblemKind,
} from "@alliance/shared/client";
import React, { useId } from "react";
import { Link } from "react-router";
import FormulaDiagnostics from "./FormulaDiagnostics";

const AT_NAME: Record<SaveProblemKind, boolean> = {
  name: true,
  named: false,
  dependent: false,
};

const FIELD_CLASS =
  "w-full border border-zinc-300 rounded px-2 py-1 mt-1 text-sm aria-invalid:border-red-600";

const FormulaFields: React.FC<{
  draft: FormulaEditDto;
  problems: FormulaProblemDto[];
  onChange: (draft: FormulaEditDto) => void;
  readOnly: boolean;
}> = ({ draft, problems, onChange, readOnly }) => {
  const id = useId();
  const nameProblem = problems.find((problem) => AT_NAME[problem.kind]);
  const textProblems = problems.filter((problem) => !AT_NAME[problem.kind]);
  return (
    <div className="space-y-3 max-w-3xl">
      <label className="block text-sm text-zinc-700">
        Name
        <input
          className={`${FIELD_CLASS} font-mono`}
          value={draft.name}
          maxLength={100}
          spellCheck={false}
          autoComplete="off"
          readOnly={readOnly}
          aria-invalid={nameProblem !== undefined}
          aria-describedby={nameProblem ? `${id}-name-error` : undefined}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      {nameProblem !== undefined && (
        <div id={`${id}-name-error`}>
          <FormulaDiagnostics problem={nameProblem} />
        </div>
      )}
      <label className="block text-sm text-zinc-700">
        Formula
        <span className="block text-xs text-zinc-500">
          A TypeScript expression. Use <code>isMissing(x)</code> to test whether
          a value is missing, and <code>isOnList(&quot;List name&quot;)</code>{" "}
          to check whether the member is on a{" "}
          <Link to="/member-lists" className="underline">
            member list
          </Link>
          .
        </span>
        <textarea
          className={`${FIELD_CLASS} font-mono min-h-32`}
          value={draft.text}
          maxLength={20000}
          spellCheck={false}
          readOnly={readOnly}
          aria-invalid={textProblems.length > 0}
          aria-describedby={
            textProblems.length > 0 ? `${id}-text-errors` : undefined
          }
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      </label>
      {textProblems.length > 0 && (
        <div id={`${id}-text-errors`}>
          {textProblems.map((problem) => (
            <FormulaDiagnostics
              key={`${problem.kind}:${problem.id}`}
              problem={problem}
            />
          ))}
        </div>
      )}
      <label className="block text-sm text-zinc-700">
        Notes
        <span className="block text-xs text-zinc-500">
          Optional. Why this formula exists, for whoever edits it next.
        </span>
        <textarea
          className={`${FIELD_CLASS} min-h-16`}
          value={draft.notes ?? ""}
          maxLength={5000}
          readOnly={readOnly}
          onChange={(e) =>
            onChange({ ...draft, notes: e.target.value || null })
          }
        />
      </label>
    </div>
  );
};

export default FormulaFields;
