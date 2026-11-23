import type {
  SaveSplitResultDto,
  SplitGroupDraftDto,
  SplitPreviewResultDto,
  SplitProblemDto,
  SplitWarningDto,
  SuiteSplitDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { isEqual } from "es-toolkit";
import React, { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useUnsavedChangesPrompt } from "../../lib/useUnsavedChangesPrompt";
import GroupFields, { SplitProblemList } from "./GroupFields";
import SplitGrid from "./SplitGrid";
import SplitPreview from "./SplitPreview";
import { draftsOf, moved, newGroup, withCell } from "./splitDrafts";

enum Busy {
  Save = "save",
  Preview = "preview",
}

/**
 * A newer `split` replaces the groups only while they have no unsaved edits.
 * Edits are offered the latest only when a save of them would be refused: a
 * newer version, or a cell of an action that left the suite.
 * A save adopts the groups as stored, which the server may have normalised,
 * unless they were edited while it ran. Its warnings show only while the
 * groups are as stored.
 */
const SuiteSplitEditor: React.FC<{
  split: SuiteSplitDto;
  onSave: (body: {
    baseVersionId: number;
    groups: SplitGroupDraftDto[];
  }) => Promise<SaveSplitResultDto>;
  onPreview: (groups: SplitGroupDraftDto[]) => Promise<SplitPreviewResultDto>;
  onLoadLatest: () => void;
}> = ({ split, onSave, onPreview, onLoadLatest }) => {
  const [base, setBase] = useState(split);
  const [groups, setGroups] = useState(() => draftsOf(split));
  const [checked, setChecked] = useState<{
    problems: SplitProblemDto[];
    of: SplitGroupDraftDto[];
  } | null>(null);
  const [saved, setSaved] = useState<{
    warnings: SplitWarningDto[];
    of: SplitGroupDraftDto[];
  } | null>(null);
  const [preview, setPreview] = useState<{
    result: SplitPreviewResultDto;
    of: SplitGroupDraftDto[];
  } | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addGroup = useRef<HTMLButtonElement>(null);
  const dirty = !isEqual(groups, draftsOf(base));
  useUnsavedChangesPrompt({ hasUnsavedChanges: dirty });
  const loadLatest = () => {
    setBase(split);
    setGroups(draftsOf(split));
  };
  if (split !== base && !dirty) loadLatest();

  const update = (index: number, group: SplitGroupDraftDto) =>
    setGroups(groups.map((each, i) => (i === index ? group : each)));

  const guarded = async (params: {
    running: Busy;
    failure: string;
    work: () => Promise<void>;
  }) => {
    if (busy !== null) return;
    setBusy(params.running);
    setError(null);
    try {
      await params.work();
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, params.failure));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    guarded({
      running: Busy.Save,
      failure: "Couldn't save the groups.",
      work: async () => {
        const sent = groups;
        const result = await onSave({ baseVersionId: base.versionId, groups });
        if (result.split === null) {
          setChecked({ problems: result.problems, of: sent });
          return;
        }
        const stored = result.split;
        setChecked(null);
        setSaved({ warnings: result.warnings, of: draftsOf(stored) });
        setBase(stored);
        setGroups((current) =>
          isEqual(current, sent) ? draftsOf(stored) : current,
        );
      },
    });

  const runPreview = () =>
    guarded({
      running: Busy.Preview,
      failure: "Couldn't run the preview.",
      work: async () => {
        const result = await onPreview(groups);
        setPreview({ result, of: groups });
        setChecked({ problems: result.problems, of: groups });
      },
    });

  const problems =
    checked !== null && isEqual(checked.of, groups) ? checked.problems : [];
  const savedNow = saved !== null && isEqual(saved.of, groups);
  const actionIds = new Set(split.actions.map((action) => action.id));
  const savedElsewhere = split.versionId !== base.versionId;
  const actionLeft = groups.some((group) =>
    group.cells.some((cell) => !actionIds.has(cell.actionId)),
  );
  const ofGroup = (groupId: string | null) =>
    problems.filter((problem) => problem.groupId === groupId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Each member lands in the first group whose condition they match, once
        the suite goes live. The grid sets what each group is given.
      </p>
      {split.launchFailure !== null && (
        <div role="alert" className="border border-red-300 rounded p-3 text-sm">
          <p className="font-semibold text-red-800">Launch failed</p>
          <p className="text-red-700">{split.launchFailure}</p>
        </div>
      )}
      {(savedElsewhere || actionLeft) && busy !== Busy.Save && (
        <div
          role="alert"
          className="border border-amber-300 rounded p-3 text-sm"
        >
          <p>
            {savedElsewhere
              ? "These groups were saved elsewhere since you opened them."
              : "An action left this suite since you opened these groups."}{" "}
            Load the latest to keep editing; your unsaved edits will be lost.
          </p>
          <Button
            color={ButtonColor.White}
            onClick={() => {
              loadLatest();
              setError(null);
              onLoadLatest();
            }}
          >
            Load latest
          </Button>
        </div>
      )}
      <SplitProblemList problems={ofGroup(null)} />
      <ol className="space-y-3">
        {groups.map((group, index) => (
          <GroupFields
            key={group.id}
            group={group}
            position={index + 1}
            isLast={index === groups.length - 1}
            canMoveUp={index > 0}
            canMoveDown={index < groups.length - 2}
            problems={ofGroup(group.id)}
            warnings={(savedNow ? saved.warnings : [])
              .filter((warning) => warning.groupId === group.id)
              .map((warning) => warning.message)}
            onChange={(next) => update(index, next)}
            onMove={(by) => setGroups(moved(groups, index, by))}
            onRemove={() => {
              setGroups(groups.filter((_, i) => i !== index));
              addGroup.current?.focus();
            }}
          />
        ))}
      </ol>
      <Button
        ref={addGroup}
        color={ButtonColor.White}
        onClick={() =>
          setGroups([...groups.slice(0, -1), newGroup(), ...groups.slice(-1)])
        }
      >
        Add group
      </Button>
      <SplitGrid
        groups={groups}
        actions={split.actions}
        onChange={(index, actionId, choice) =>
          update(index, withCell(groups[index], actionId, choice))
        }
      />
      <div className="flex gap-3 items-center">
        <Button
          color={ButtonColor.Black}
          aria-disabled={busy !== null}
          className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
          onClick={save}
        >
          {busy === Busy.Save ? "Saving…" : "Save groups"}
        </Button>
        <Button
          color={ButtonColor.White}
          aria-disabled={busy !== null}
          className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
          onClick={runPreview}
        >
          {busy === Busy.Preview ? "Running preview…" : "Run preview"}
        </Button>
        <p role="status" className="text-sm text-zinc-600">
          {dirty ? "Unsaved changes." : savedNow ? "Saved." : ""}
        </p>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview?.result.preview !== undefined && (
        <SplitPreview
          preview={preview.result.preview}
          groups={preview.of}
          outOfDate={!isEqual(preview.of, groups)}
        />
      )}
    </div>
  );
};

export default SuiteSplitEditor;
