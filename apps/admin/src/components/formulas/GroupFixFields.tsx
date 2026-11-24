import type {
  FormulaProblemDto,
  GroupFixDto,
  SplitGroupRefDto,
} from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import React, { useId } from "react";
import FallbackSelect from "../suite-split/FallbackSelect";
import { CONDITION_HINT } from "../suite-split/splitDrafts";
import FormulaDiagnostics from "./FormulaDiagnostics";

/** A split group's condition being fixed in a formula save. */
export type GroupFixDraft = {
  /** The id of the problem it fixes, which names the group. */
  problemId: string;
  group: SplitGroupRefDto;
  fix: GroupFixDto;
  /** The fix as opened, to tell whether the admin changed it. */
  opened: GroupFixDto;
};

export function groupFixOf(
  problem: FormulaProblemDto & { split: SplitGroupRefDto },
): GroupFixDraft {
  const fix = {
    suiteId: problem.split.suiteId,
    baseVersionId: problem.split.versionId,
    groupId: problem.split.groupId,
    text: problem.text ?? missingText(problem.id),
    fallback: problem.split.fallback,
  };
  return { problemId: problem.id, group: problem.split, fix, opened: fix };
}

function missingText(problemId: string): never {
  throw new Error(`split problem ${problemId} has no text`);
}

export const groupFixChanged = (draft: GroupFixDraft) =>
  !isEqual(draft.fix, draft.opened);

const GroupFixFields: React.FC<{
  draft: GroupFixDraft;
  problems: FormulaProblemDto[];
  readOnly: boolean;
  onChange: (fix: GroupFixDto) => void;
}> = ({ draft, problems, readOnly, onChange }) => {
  const id = useId();
  const invalid = problems.length > 0;
  return (
    <div className="space-y-2 max-w-3xl">
      <label htmlFor={id} className="block text-sm font-medium">
        Condition
      </label>
      <p id={`${id}-hint`} className="text-sm text-zinc-600">
        {CONDITION_HINT}
      </p>
      <textarea
        id={id}
        className="block w-full border border-zinc-300 rounded px-2 py-1 font-mono text-sm aria-invalid:border-red-600"
        rows={2}
        spellCheck={false}
        readOnly={readOnly}
        maxLength={20000}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-hint ${id}-errors` : `${id}-hint`}
        value={draft.fix.text}
        onChange={(event) =>
          onChange({ ...draft.fix, text: event.target.value })
        }
      />
      <FallbackSelect
        value={draft.fix.fallback}
        disabled={readOnly}
        onChange={(fallback) => onChange({ ...draft.fix, fallback })}
      />
      {invalid && (
        <div id={`${id}-errors`}>
          {problems.map((problem, index) => (
            <FormulaDiagnostics key={index} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupFixFields;
