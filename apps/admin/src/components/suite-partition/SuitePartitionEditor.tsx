import type {
  PartitionPartDraftDto,
  PartitionPreviewResultDto,
  PartitionProblemDto,
  PartitionWarningDto,
  SavePartitionResultDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import React, { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import Button, { ButtonColor } from "../../ui/Button";
import PartFields, { PartitionProblemList } from "./PartFields";
import PartitionGrid from "./PartitionGrid";
import PartitionPreview from "./PartitionPreview";
import { draftsOf, moved, newPart, withCell } from "./partitionDrafts";

enum Busy {
  Save = "save",
  Preview = "preview",
}

/**
 * A newer `partition` replaces the parts only while they have no unsaved edits.
 * Edits are offered the latest only when a save of them would be refused: a
 * newer version, or a cell of an action that left the suite.
 * A save adopts the parts as stored, which the server may have normalised,
 * unless they were edited while it ran. Its warnings show only while the
 * parts are as stored.
 */
const SuitePartitionEditor: React.FC<{
  partition: SuitePartitionDto;
  onSave: (body: {
    baseVersionId: number;
    parts: PartitionPartDraftDto[];
  }) => Promise<SavePartitionResultDto>;
  onPreview: (
    parts: PartitionPartDraftDto[],
  ) => Promise<PartitionPreviewResultDto>;
  onLoadLatest: () => void;
}> = ({ partition, onSave, onPreview, onLoadLatest }) => {
  const [base, setBase] = useState(partition);
  const [parts, setParts] = useState(() => draftsOf(partition));
  const [checked, setChecked] = useState<{
    problems: PartitionProblemDto[];
    of: PartitionPartDraftDto[];
  } | null>(null);
  const [saved, setSaved] = useState<{
    warnings: PartitionWarningDto[];
    of: PartitionPartDraftDto[];
  } | null>(null);
  const [preview, setPreview] = useState<{
    result: PartitionPreviewResultDto;
    of: PartitionPartDraftDto[];
  } | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addPart = useRef<HTMLButtonElement>(null);
  const dirty = !isEqual(parts, draftsOf(base));
  useLeaveGuard(dirty);
  const loadLatest = () => {
    setBase(partition);
    setParts(draftsOf(partition));
  };
  if (partition !== base && !dirty) loadLatest();

  const update = (index: number, part: PartitionPartDraftDto) =>
    setParts(parts.map((each, i) => (i === index ? part : each)));

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
      failure: "Couldn't save the partition.",
      work: async () => {
        const sent = parts;
        const result = await onSave({ baseVersionId: base.versionId, parts });
        if (result.partition === null) {
          setChecked({ problems: result.problems, of: sent });
          return;
        }
        const stored = result.partition;
        setChecked(null);
        setSaved({ warnings: result.warnings, of: draftsOf(stored) });
        setBase(stored);
        setParts((current) =>
          isEqual(current, sent) ? draftsOf(stored) : current,
        );
      },
    });

  const runPreview = () =>
    guarded({
      running: Busy.Preview,
      failure: "Couldn't run the preview.",
      work: async () => {
        const result = await onPreview(parts);
        setPreview({ result, of: parts });
        setChecked({ problems: result.problems, of: parts });
      },
    });

  const problems =
    checked !== null && isEqual(checked.of, parts) ? checked.problems : [];
  const savedNow = saved !== null && isEqual(saved.of, parts);
  const actionIds = new Set(partition.actions.map((action) => action.id));
  const savedElsewhere = partition.versionId !== base.versionId;
  const actionLeft = parts.some((part) =>
    part.cells.some((cell) => !actionIds.has(cell.actionId)),
  );
  const ofPart = (partId: string | null) =>
    problems.filter((problem) => problem.partId === partId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Each member lands in the first part whose condition they match, once the
        suite goes live. The grid sets which actions each part gets, and whether
        each is required or optional.
      </p>
      {partition.launchFailure !== null && (
        <div role="alert" className="border border-red-300 rounded p-3 text-sm">
          <p className="font-semibold text-red-800">Launch failed</p>
          <p className="text-red-700">{partition.launchFailure}</p>
        </div>
      )}
      {(savedElsewhere || actionLeft) && busy !== Busy.Save && (
        <div
          role="alert"
          className="border border-amber-300 rounded p-3 text-sm"
        >
          <p>
            {savedElsewhere
              ? "This partition was saved elsewhere since you opened it."
              : "An action left this suite since you opened this partition."}{" "}
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
      <PartitionProblemList problems={ofPart(null)} />
      <ol className="space-y-3">
        {parts.map((part, index) => (
          <PartFields
            key={part.id}
            part={part}
            position={index + 1}
            isLast={index === parts.length - 1}
            canMoveUp={index > 0}
            canMoveDown={index < parts.length - 2}
            problems={ofPart(part.id)}
            warnings={(savedNow ? saved.warnings : [])
              .filter((warning) => warning.partId === part.id)
              .map((warning) => warning.message)}
            onChange={(next) => update(index, next)}
            onMove={(by) => setParts(moved(parts, index, by))}
            onRemove={() => {
              setParts(parts.filter((_, i) => i !== index));
              addPart.current?.focus();
            }}
          />
        ))}
      </ol>
      <Button
        ref={addPart}
        color={ButtonColor.White}
        onClick={() =>
          setParts([...parts.slice(0, -1), newPart(), ...parts.slice(-1)])
        }
      >
        Add part
      </Button>
      <PartitionGrid
        parts={parts}
        actions={partition.actions}
        onChange={(index, actionId, choice) =>
          update(index, withCell(parts[index], actionId, choice))
        }
      />
      <div className="flex gap-3 items-center">
        <Button
          color={ButtonColor.Black}
          aria-disabled={busy !== null}
          className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
          onClick={save}
        >
          {busy === Busy.Save ? "Saving…" : "Save partition"}
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
        <PartitionPreview
          preview={preview.result.preview}
          parts={preview.of}
          outOfDate={!isEqual(preview.of, parts)}
        />
      )}
    </div>
  );
};

export default SuitePartitionEditor;
