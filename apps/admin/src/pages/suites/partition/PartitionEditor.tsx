import type {
  PartitionPartDraftDto,
  PartitionPreviewResultDto,
  SavePartitionResultDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  moved,
  newPart,
  withCell,
} from "../../../components/suite-partition/partitionDrafts";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { FormSection, SaveBar } from "../../../ui/templates/Form";
import { PartFields } from "./PartFields";
import { PartitionGrid } from "./PartitionGrid";
import { PartitionPreviewPanel } from "./PartitionPreviewPanel";
import { PartitionProblems } from "./PartitionProblems";
import { usePartitionEditor } from "./usePartitionEditor";

export function PartitionEditor({
  partition,
  scheduled,
  focusOnMount,
  onSave,
  onPreview,
}: {
  partition: SuitePartitionDto;
  /** The suite has a members taking action event, so the server refuses saves. */
  scheduled: boolean;
  /** Lands focus on the first part, for an editor that replaced the control holding it. */
  focusOnMount: boolean;
  onSave: (body: {
    baseVersionId: number;
    parts: PartitionPartDraftDto[];
  }) => Promise<SavePartitionResultDto>;
  onPreview: (
    parts: PartitionPartDraftDto[],
  ) => Promise<PartitionPreviewResultDto>;
}) {
  const editor = usePartitionEditor({ partition, onSave, onPreview });
  const { parts, setParts } = editor;
  const firstPart = useRef<HTMLHeadingElement>(null);
  const addPart = useRef<HTMLButtonElement>(null);
  const [focusFirst, setFocusFirst] = useState(focusOnMount);
  useEffect(() => {
    if (!focusFirst) return;
    firstPart.current?.focus();
    setFocusFirst(false);
  }, [focusFirst]);

  const update = (index: number, part: PartitionPartDraftDto) =>
    setParts(parts.map((each, i) => (i === index ? part : each)));

  return (
    <>
      {partition.launchFailure !== null && (
        <Banner tone={BannerTone.Danger} inline>
          <p className="font-medium">Launch failed</p>
          <p>{partition.launchFailure}</p>
        </Banner>
      )}
      {scheduled && (
        <Banner tone={BannerTone.Warning} inline>
          This suite is scheduled to launch, so its partition can&apos;t change
          here.
        </Banner>
      )}
      {editor.stale !== null && (
        <Banner
          tone={BannerTone.Warning}
          inline
          action={
            <Button
              size="small"
              variant={ButtonVariant.Default}
              onClick={() => {
                editor.loadLatest();
                setFocusFirst(true);
              }}
            >
              Load latest
            </Button>
          }
        >
          {editor.stale} Load the latest to keep editing; your unsaved edits
          will be lost.
        </Banner>
      )}
      <FormSection
        title="Partition"
        description="Each member lands in the first part whose condition they match, in this order."
        footer={
          <SaveBar
            state={editor.saveState}
            error={editor.saveError}
            saveLabel="Save partition"
            onSave={() => void editor.save()}
            onDiscard={editor.discard}
          />
        }
      >
        <PartitionProblems problems={editor.problemsOf(null)} />
        <ol className="flex flex-col divide-y divide-line">
          {parts.map((part, index) => (
            <PartFields
              key={part.id}
              part={part}
              position={index + 1}
              isLast={index === parts.length - 1}
              canMoveUp={index > 0}
              canMoveDown={index < parts.length - 2}
              problems={editor.problemsOf(part.id)}
              warnings={editor.warningsOf(part.id)}
              headingRef={index === 0 ? firstPart : undefined}
              onChange={(next) => update(index, next)}
              onMove={(by) => setParts(moved(parts, index, by))}
              onRemove={() => {
                setParts(parts.filter((_, i) => i !== index));
                addPart.current?.focus();
              }}
            />
          ))}
        </ol>
        <div>
          <Button
            ref={addPart}
            size="small"
            variant={ButtonVariant.Default}
            onClick={() =>
              setParts([...parts.slice(0, -1), newPart(), ...parts.slice(-1)])
            }
          >
            <Plus aria-hidden="true" className="size-4" />
            Add part
          </Button>
        </div>
        <div className="border-t border-line pt-5">
          <PartitionGrid
            parts={parts}
            tasks={partition.actions}
            onChange={({ partIndex, actionId, choice }) =>
              update(partIndex, withCell(parts[partIndex], actionId, choice))
            }
          />
        </div>
      </FormSection>
      <PartitionPreviewPanel
        preview={editor.preview}
        running={editor.previewRunning}
        error={editor.previewError}
        onRun={() => void editor.runPreview()}
      />
    </>
  );
}
