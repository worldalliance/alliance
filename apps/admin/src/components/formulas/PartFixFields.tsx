import type {
  FormulaProblemDto,
  PartFixDto,
  PartitionPartRefDto,
} from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import React, { useId } from "react";
import FallbackSelect from "../suite-partition/FallbackSelect";
import { CONDITION_HINT } from "../suite-partition/partitionDrafts";
import FormulaDiagnostics from "./FormulaDiagnostics";

/** A part's condition being fixed in a formula save. */
export type PartFixDraft = {
  /** The id of the problem it fixes, which names the part. */
  problemId: string;
  part: PartitionPartRefDto;
  fix: PartFixDto;
  /** The fix as opened, to tell whether the admin changed it. */
  opened: PartFixDto;
};

export function partFixOf(
  problem: FormulaProblemDto & { partition: PartitionPartRefDto },
): PartFixDraft {
  const fix = {
    suiteId: problem.partition.suiteId,
    baseVersionId: problem.partition.versionId,
    partId: problem.partition.partId,
    text: problem.text ?? missingText(problem.id),
    fallback: problem.partition.fallback,
  };
  return { problemId: problem.id, part: problem.partition, fix, opened: fix };
}

function missingText(problemId: string): never {
  throw new Error(`partition problem ${problemId} has no text`);
}

export const partFixChanged = (draft: PartFixDraft) =>
  !isEqual(draft.fix, draft.opened);

const PartFixFields: React.FC<{
  draft: PartFixDraft;
  problems: FormulaProblemDto[];
  readOnly: boolean;
  onChange: (fix: PartFixDto) => void;
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

export default PartFixFields;
