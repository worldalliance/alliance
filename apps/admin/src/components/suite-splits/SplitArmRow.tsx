import type { CohortExpression } from "@alliance/common/cohort-expression";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useId } from "react";
import CohortExpressionBuilder from "../CohortExpressionBuilder";
import CohortExpressionText from "../CohortExpressionText";
import type { SplitLookups } from "./SuiteSplitEditor";
import type { ArmDraft } from "./splitDraft";

export default function SplitArmRow({
  arm,
  position,
  armCount,
  locked,
  actionOptions,
  lookups,
  onChange,
  onMove,
  onRemove,
}: {
  arm: ArmDraft;
  position: number;
  armCount: number;
  locked: boolean;
  actionOptions: { id: number; name: string }[];
  lookups: SplitLookups;
  onChange: (arm: ArmDraft) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const selectId = useId();
  const isLast = position === armCount - 1;
  const label = `Arm ${position + 1}`;
  const actionName = lookups.allActions.find(
    (action) => action.id === arm.actionId,
  )?.name;
  return (
    <li className="flex flex-col gap-3 rounded border border-gray-2 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1 text-sm">
          {locked ? (
            <>
              <span className="font-medium">{label}</span>
              <span>{actionName ?? `Action #${arm.actionId}`}</span>
            </>
          ) : (
            <>
              <label htmlFor={selectId} className="font-medium">
                {label}
              </label>
              <select
                id={selectId}
                value={arm.actionId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...arm,
                    actionId: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="rounded border border-gray-2 px-2 py-1.5"
              >
                <option value="">Pick an action…</option>
                {actionOptions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={arm.optional}
            onChange={(e) => onChange({ ...arm, optional: e.target.checked })}
            className="size-4"
          />
          Optional
        </label>
        {!locked && (
          <div className="flex gap-2">
            <Button
              color={ButtonColor.White}
              size="small"
              aria-label={`Move ${label} up`}
              disabled={position === 0}
              onClick={() => onMove(position - 1)}
            >
              Move up
            </Button>
            <Button
              color={ButtonColor.White}
              size="small"
              aria-label={`Move ${label} down`}
              disabled={isLast}
              onClick={() => onMove(position + 1)}
            >
              Move down
            </Button>
            <Button
              color={ButtonColor.White}
              size="small"
              aria-label={`Remove ${label}`}
              onClick={onRemove}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      {isLast ? (
        <p className="text-sm text-zinc-600">
          Catches everyone else the split reaches, so it takes no rule.
        </p>
      ) : locked ? (
        <p className="text-sm">
          Rule:{" "}
          <CohortExpressionText
            expression={arm.rule}
            tags={lookups.availableTags}
            actions={lookups.allActions}
          />
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Rule for {label}</p>
          <CohortExpressionBuilder
            value={arm.rule}
            onChange={(rule: CohortExpression | null) =>
              onChange({ ...arm, rule })
            }
            {...builderSources(lookups)}
          />
        </div>
      )}
    </li>
  );
}

export const builderSources = (lookups: SplitLookups) => ({
  availableTags: lookups.availableTags,
  tagsLoading: lookups.tagsLoading,
  tagsError: lookups.tagsError,
  availableActions: lookups.allActions,
  actionsLoading: lookups.allActionsLoading,
  actionsError: lookups.allActionsLoadFailed,
  availableUsers: lookups.availableUsers,
  usersLoading: lookups.usersLoading,
  usersError: lookups.usersError,
  activeContractUserIds: lookups.activeContractUserIds,
});
