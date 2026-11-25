import type {
  PartitionPartDraftDto,
  PartitionPreviewResultDto,
  PartitionProblemDto,
  PartitionWarningDto,
  SavePartitionResultDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import { useState } from "react";
import { draftsOf } from "../../../components/suite-partition/partitionDrafts";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useLeaveGuard } from "../../../lib/useLeaveGuard";
import { SAVE_FAILED_FALLBACK, SaveState } from "../../../ui/templates/Form";

enum Busy {
  Save = "save",
  Preview = "preview",
}

/**
 * A newer `partition` replaces the parts only while they have no unsaved edits.
 * Edits are offered the latest only when a save of them would be refused: a
 * newer version, or a cell of a task that left the suite.
 * A save adopts the parts as stored, which the server may have normalised,
 * unless they were edited while it ran. Its warnings, a refusal's problems
 * and a preview hold only for the parts they were given.
 */
export function usePartitionEditor({
  partition,
  onSave,
  onPreview,
}: {
  partition: SuitePartitionDto;
  onSave: (body: {
    baseVersionId: number;
    parts: PartitionPartDraftDto[];
  }) => Promise<SavePartitionResultDto>;
  onPreview: (
    parts: PartitionPartDraftDto[],
  ) => Promise<PartitionPreviewResultDto>;
}) {
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
  // A save and a preview run side by side: a preview reads only the parts it
  // is given.
  const [running, setRunning] = useState<Record<Busy, boolean>>({
    [Busy.Save]: false,
    [Busy.Preview]: false,
  });
  const [failures, setFailures] = useState<Partial<Record<Busy, string>>>({});
  const dirty = !isEqual(parts, draftsOf(base));
  useLeaveGuard(dirty);

  const loadLatest = () => {
    setBase(partition);
    setParts(draftsOf(partition));
    setFailures({});
  };
  if (partition !== base && !dirty) {
    setBase(partition);
    setParts(draftsOf(partition));
  }

  const guarded = async (params: {
    running: Busy;
    fallback: string;
    work: () => Promise<void>;
  }) => {
    const kind = params.running;
    if (running[kind]) return;
    setRunning((current) => ({ ...current, [kind]: true }));
    setFailures((current) => ({ ...current, [kind]: undefined }));
    try {
      await params.work();
    } catch (thrown) {
      setFailures((current) => ({
        ...current,
        [kind]: adminRefusalMessage(thrown, params.fallback),
      }));
    } finally {
      setRunning((current) => ({ ...current, [kind]: false }));
    }
  };

  const save = () =>
    guarded({
      running: Busy.Save,
      fallback: SAVE_FAILED_FALLBACK,
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
      fallback: "Couldn't run the preview.",
      work: async () => {
        const result = await onPreview(parts);
        setPreview({ result, of: parts });
        setChecked({ problems: result.problems, of: parts });
      },
    });

  const problems =
    checked !== null && isEqual(checked.of, parts) ? checked.problems : [];
  const warnings =
    saved !== null && isEqual(saved.of, parts) ? saved.warnings : [];
  const taskIds = new Set(partition.actions.map((action) => action.id));
  const stale = running[Busy.Save]
    ? null
    : partition.versionId !== base.versionId
      ? "This partition was saved elsewhere since you opened it."
      : parts.some((part) =>
            part.cells.some((cell) => !taskIds.has(cell.actionId)),
          )
        ? "A task left this suite since you opened this partition."
        : null;

  const saveState = running[Busy.Save]
    ? SaveState.Saving
    : failures[Busy.Save] !== undefined
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : saved !== null && isEqual(saved.of, parts)
          ? SaveState.Saved
          : SaveState.Clean;

  return {
    parts,
    setParts,
    previewRunning: running[Busy.Preview],
    saveState,
    saveError: failures[Busy.Save] ?? null,
    previewError: failures[Busy.Preview] ?? null,
    problemsOf: (partId: string | null) =>
      problems.filter((problem) => problem.partId === partId),
    warningsOf: (partId: string) =>
      warnings
        .filter((warning) => warning.partId === partId)
        .map((warning) => warning.message),
    preview: preview?.result.preview && {
      result: preview.result.preview,
      parts: preview.of,
      outOfDate: !isEqual(preview.of, parts),
    },
    stale,
    loadLatest,
    discard: () => {
      setParts(draftsOf(base));
      setFailures({});
    },
    save,
    runPreview,
  };
}
