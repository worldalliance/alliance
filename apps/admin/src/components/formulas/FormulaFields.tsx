import type {
  FormulaEditDto,
  FormulaProblemDto,
  SaveProblemKind,
} from "@alliance/shared/client";
import React, { useId, type ReactNode } from "react";
import { Link } from "react-router";
import { placeById, PlaceId } from "../../places";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import { linkClass } from "../../ui/styles";
import { Textarea } from "../../ui/Textarea";
import FormulaDiagnostics from "./FormulaDiagnostics";

const AT_NAME: Record<SaveProblemKind, boolean> = {
  name: true,
  named: false,
  dependent: false,
};

/** Read-only while a save settles, which the field shows by its sunken well. */
const READ_ONLY = "read-only:bg-surface-2 read-only:text-fg-muted";

/** A label, its control, help under it, and the problems that refused the save. */
function FormulaField({
  label,
  mark,
  help,
  problems,
  children,
}: {
  label: string;
  mark?: "optional" | "required";
  help?: ReactNode;
  problems: FormulaProblemDto[];
  children: (control: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const invalid = problems.length > 0;
  const describedBy =
    [help ? `${id}-help` : null, invalid ? `${id}-errors` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
        {mark && <span className="font-normal text-fg-muted"> ({mark})</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": invalid || undefined,
      })}
      {help && (
        <p id={`${id}-help`} className="text-caption text-fg-muted">
          {help}
        </p>
      )}
      {invalid && (
        <div id={`${id}-errors`} className="flex flex-col gap-2">
          {problems.map((problem) => (
            <FormulaDiagnostics
              key={`${problem.kind}:${problem.id}`}
              problem={problem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const FormulaFields: React.FC<{
  draft: FormulaEditDto;
  problems: FormulaProblemDto[];
  onChange: (draft: FormulaEditDto) => void;
  readOnly: boolean;
}> = ({ draft, problems, onChange, readOnly }) => (
  <div className="flex flex-col gap-4">
    <FormulaField
      label="Name"
      help="How other formulas and conditions refer to it."
      problems={problems.filter((problem) => AT_NAME[problem.kind])}
    >
      {(control) => (
        <Input
          {...control}
          className={cn("font-mono", READ_ONLY)}
          value={draft.name}
          maxLength={100}
          spellCheck={false}
          autoComplete="off"
          readOnly={readOnly}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      )}
    </FormulaField>
    <FormulaField
      label="Formula"
      help={
        <>
          A TypeScript expression. Use <code>isMissing(x)</code> to test whether
          a value is missing, and <code>isOnList(&quot;List name&quot;)</code>{" "}
          to check whether the member is on a{" "}
          <Link to={placeById(PlaceId.MemberLists).path} className={linkClass}>
            member list
          </Link>
          .
        </>
      }
      problems={problems.filter((problem) => !AT_NAME[problem.kind])}
    >
      {(control) => (
        <Textarea
          {...control}
          className={cn("min-h-32 font-mono text-xs", READ_ONLY)}
          value={draft.text}
          maxLength={20000}
          spellCheck={false}
          readOnly={readOnly}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      )}
    </FormulaField>
    <FormulaField
      label="Notes"
      mark="optional"
      help="Why this formula exists, for whoever edits it next."
      problems={[]}
    >
      {(control) => (
        <Textarea
          {...control}
          className={READ_ONLY}
          value={draft.notes ?? ""}
          maxLength={5000}
          readOnly={readOnly}
          onChange={(e) =>
            onChange({ ...draft, notes: e.target.value || null })
          }
        />
      )}
    </FormulaField>
  </div>
);

export default FormulaFields;
