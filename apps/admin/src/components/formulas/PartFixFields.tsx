import type {
  FormulaProblemDto,
  PartFixDto,
  PartitionPartRefDto,
} from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import React, { useId } from "react";
import { Textarea } from "../../ui/Textarea";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-medium">
          Condition
        </label>
        <Textarea
          id={id}
          className="min-h-16 font-mono text-xs read-only:bg-surface-2 read-only:text-fg-muted"
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
        <p id={`${id}-hint`} className="text-caption text-fg-muted">
          {CONDITION_HINT}
        </p>
        {invalid && (
          <div id={`${id}-errors`} className="flex flex-col gap-2">
            {problems.map((problem, index) => (
              <FormulaDiagnostics key={index} problem={problem} />
            ))}
          </div>
        )}
      </div>
      <FallbackSelect
        value={draft.fix.fallback}
        disabled={readOnly}
        onChange={(fallback) => onChange({ ...draft.fix, fallback })}
      />
    </div>
  );
};

export default PartFixFields;
