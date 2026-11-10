import type { ActionDto, SaveSuiteSplitDto } from "@alliance/shared/client";
import type { ParsedSuiteSplit } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import { useId, useState } from "react";
import type { useActionEditorLookups } from "../../pages/action-dashboard/useActionEditorLookups";
import CohortExpressionBuilder from "../CohortExpressionBuilder";
import CohortExpressionText from "../CohortExpressionText";
import SplitArmRow, { builderSources } from "./SplitArmRow";
import {
  emptySplitDraft,
  moveArm,
  newArmDraft,
  saveSplitBody,
  splitDraftOf,
  splitDraftProblems,
  VISIBILITY_MODE_LABELS,
  type ArmDraft,
} from "./splitDraft";

export type SplitLookups = ReturnType<typeof useActionEditorLookups>;

const VISIBILITY_MODES = ["combined", "per_arm"] as const;

export default function SuiteSplitEditor({
  split,
  suiteActions,
  otherSplits,
  lookups,
  saving,
  error,
  onSave,
  onCancel,
}: {
  split: ParsedSuiteSplit | null;
  suiteActions: ActionDto[];
  otherSplits: ParsedSuiteSplit[];
  lookups: SplitLookups;
  saving: boolean;
  error: string | null;
  onSave: (body: SaveSuiteSplitDto) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState(() =>
    split ? splitDraftOf(split) : emptySplitDraft(),
  );
  const [attempted, setAttempted] = useState(false);
  const locked = split?.launched ?? false;
  const problems = splitDraftProblems(draft);

  const takenElsewhere = new Set(
    otherSplits.flatMap((other) => other.arms.map((arm) => arm.actionId)),
  );
  const eligible = suiteActions.filter(
    (action) =>
      !takenElsewhere.has(action.id) &&
      !action.onboarding &&
      !action.publicOnly &&
      !action.isContractSigningAction,
  );
  const optionsFor = (arm: ArmDraft) =>
    eligible.filter(
      (action) =>
        action.id === arm.actionId ||
        !draft.arms.some((other) => other.actionId === action.id),
    );
  const setArms = (arms: ArmDraft[]) => setDraft({ ...draft, arms });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    const body = saveSplitBody(draft);
    if (body) onSave(body);
  };

  return (
    <form
      onSubmit={submit}
      aria-label={split ? `Edit ${split.title}` : "New split"}
      className="flex flex-col gap-5 rounded border border-gray-2 p-4"
    >
      <h3 className="font-semibold">
        {split ? `Edit ${split.title}` : "New split"}
      </h3>
      {locked && (
        <p className="text-sm text-yellow-800">
          This split has launched and members are already routed by it, so its
          arms, their order, their rules and its filter are locked. Its title,
          visibility and which arms are optional can still change.
        </p>
      )}
      {attempted && problems.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-600">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={titleId} className="font-medium">
          Title
        </label>
        <input
          id={titleId}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="rounded border border-gray-2 px-2 py-1.5"
        />
        <span className="text-xs text-zinc-500">
          Other members see this title in feeds and activity when visibility is
          Combined.
        </span>
      </div>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">
          Visibility to other members
        </legend>
        {VISIBILITY_MODES.map((mode) => (
          <label key={mode} className="flex items-start gap-2">
            <input
              type="radio"
              name="visibilityMode"
              value={mode}
              checked={draft.visibilityMode === mode}
              onChange={() => setDraft({ ...draft, visibilityMode: mode })}
              className="mt-0.5 size-4"
            />
            <span>
              {VISIBILITY_MODE_LABELS[mode].label}
              <span className="block text-xs text-zinc-500">
                {VISIBILITY_MODE_LABELS[mode].explanation}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Who the split reaches</legend>
        {locked ? (
          <p>
            {draft.filterExpression ? (
              <CohortExpressionText
                expression={draft.filterExpression}
                tags={lookups.availableTags}
                actions={lookups.allActions}
              />
            ) : (
              "Every member"
            )}
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.filterExpression !== null}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    filterExpression: e.target.checked
                      ? { type: "AllMembers" }
                      : null,
                  })
                }
                className="size-4"
              />
              Only members who match a filter
            </label>
            {draft.filterExpression === null ? (
              <p className="text-zinc-600">
                Every member gets one of the arms.
              </p>
            ) : (
              <CohortExpressionBuilder
                value={draft.filterExpression}
                onChange={(filterExpression) =>
                  setDraft({ ...draft, filterExpression })
                }
                {...builderSources(lookups)}
              />
            )}
          </>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Arms</legend>
        <p className="text-zinc-600">
          Each member the split reaches gets the first arm whose rule they
          match, and none of the others.
        </p>
        <ol className="flex flex-col gap-3">
          {draft.arms.map((arm, index) => (
            <SplitArmRow
              key={arm.key}
              arm={arm}
              position={index}
              armCount={draft.arms.length}
              locked={locked}
              actionOptions={optionsFor(arm)}
              lookups={lookups}
              onChange={(next) =>
                setArms(draft.arms.map((a, i) => (i === index ? next : a)))
              }
              onMove={(to) => setArms(moveArm(draft.arms, { from: index, to }))}
              onRemove={() => setArms(draft.arms.filter((_, i) => i !== index))}
            />
          ))}
        </ol>
        {!locked && (
          <Button
            color={ButtonColor.White}
            size="small"
            className="self-start"
            onClick={() => setArms([...draft.arms, newArmDraft()])}
          >
            Add arm
          </Button>
        )}
      </fieldset>
      <InlineError message={error} />
      <div className="flex justify-end gap-2">
        <Button
          color={ButtonColor.White}
          size="small"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          color={ButtonColor.Black}
          size="small"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save split"}
        </Button>
      </div>
    </form>
  );
}
