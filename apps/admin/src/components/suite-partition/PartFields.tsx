import type {
  PartitionPartDraftDto,
  PartitionProblemDto,
} from "@alliance/shared/client";
import React, { useId } from "react";
import Button, { ButtonColor } from "../../ui/Button";
import MarkedDiagnostics from "../MarkedDiagnostics";
import FallbackSelect from "./FallbackSelect";
import { CONDITION_HINT, hasRequiredWork } from "./partitionDrafts";

export const PartitionProblemList: React.FC<{
  problems: PartitionProblemDto[];
}> = ({ problems }) =>
  problems.map((problem, index) => {
    if (problem.message !== undefined)
      return (
        <p key={index} className="text-sm text-red-700">
          {problem.message}
        </p>
      );
    if (problem.text === undefined || problem.diagnostics === undefined)
      throw new Error(
        `partition problem with neither a message nor diagnostics: ${JSON.stringify(problem)}`,
      );
    return (
      <MarkedDiagnostics
        key={index}
        text={problem.text}
        diagnostics={problem.diagnostics}
      />
    );
  });

/** One part's name, condition, fallback and tick; "Everyone else" has only the tick. */
const PartFields: React.FC<{
  part: PartitionPartDraftDto;
  position: number;
  isLast: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  problems: PartitionProblemDto[];
  warnings: string[];
  onChange: (part: PartitionPartDraftDto) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}> = ({
  part,
  position,
  isLast,
  canMoveUp,
  canMoveDown,
  problems,
  warnings,
  onChange,
  onMove,
  onRemove,
}) => {
  const id = useId();
  const label = part.name || "unnamed part";
  return (
    <li>
      <div
        role="group"
        aria-labelledby={`${id}-heading`}
        className="border border-zinc-200 rounded p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-heading`} className="font-semibold text-sm">
            {position}. {part.name || "Unnamed part"}
          </h3>
          {!isLast && (
            <div className="flex gap-2">
              <Button
                size="small"
                color={ButtonColor.White}
                aria-disabled={!canMoveUp}
                className="aria-disabled:opacity-50"
                onClick={() => canMoveUp && onMove(-1)}
              >
                Move up
              </Button>
              <Button
                size="small"
                color={ButtonColor.White}
                aria-disabled={!canMoveDown}
                className="aria-disabled:opacity-50"
                onClick={() => canMoveDown && onMove(1)}
              >
                Move down
              </Button>
              <Button size="small" color={ButtonColor.White} onClick={onRemove}>
                Remove {label}
              </Button>
            </div>
          )}
        </div>
        {isLast ? (
          <p className="text-sm text-zinc-600">
            Members who match no part above land here.
          </p>
        ) : (
          <>
            <label className="block text-sm space-y-1">
              <span className="font-medium">Name</span>
              <input
                className="block w-full border border-zinc-300 rounded px-2 py-1"
                value={part.name}
                onChange={(event) =>
                  onChange({ ...part, name: event.target.value })
                }
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="font-medium">Condition</span>
              <span id={`${id}-hint`} className="block text-zinc-600">
                {CONDITION_HINT}
              </span>
              <textarea
                aria-describedby={`${id}-hint`}
                className="block w-full border border-zinc-300 rounded px-2 py-1 font-mono"
                rows={2}
                spellCheck={false}
                value={part.text ?? ""}
                onChange={(event) =>
                  onChange({ ...part, text: event.target.value })
                }
              />
            </label>
            <FallbackSelect
              value={part.fallback}
              onChange={(fallback) => onChange({ ...part, fallback })}
            />
          </>
        )}
        {!hasRequiredWork(part) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={part.noRequiredWorkTick}
              onChange={(event) =>
                onChange({ ...part, noRequiredWorkTick: event.target.checked })
              }
            />
            This part intentionally has no required work
          </label>
        )}
        <PartitionProblemList problems={problems} />
        {warnings.map((warning) => (
          <p key={warning} className="text-sm text-amber-800">
            Warning: {warning}
          </p>
        ))}
      </div>
    </li>
  );
};

export default PartFields;
