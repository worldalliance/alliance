import type { ImagesBlock } from "@alliance/common/forms/display-blocks";
import { useState } from "react";
import { FileInput } from "../../ui/FileInput";
import { CheckboxField, Field } from "../../ui/templates/Form";
import UploadingWithCancel from "../../ui/UploadingWithCancel";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { ImageRows } from "./ImageRows";
import type { BlockWriteLanding, LandingFor } from "./perUserContent";
import type { BaseDisplayBlockProps } from "./types";
import { useImageUploads } from "./useImageUploads";
import type { TargetLabel } from "./useManualTargets";

export function EditableImagesBlock(props: BaseDisplayBlockProps<ImagesBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({
        block: activeBlock,
        onUpdate: handleUpdate,
        activeUserId,
        targetLabel,
        updateFor,
        landingFor,
      }) => (
        <ImagesEditor
          block={activeBlock}
          onUpdate={handleUpdate}
          activeUserId={activeUserId ?? null}
          targetLabel={targetLabel}
          updateFor={updateFor}
          landingFor={landingFor}
        />
      )}
    </DisplayBlockWrapper>
  );
}

const NO_FILES: File[] = [];

function ImagesEditor({
  block,
  onUpdate,
  activeUserId,
  targetLabel,
  updateFor,
  landingFor,
}: {
  block: ImagesBlock;
  onUpdate: (updates: Partial<ImagesBlock>) => void;
  activeUserId: string | null;
  targetLabel: TargetLabel;
  updateFor: (
    userId: string | null,
    update: (current: ImagesBlock) => Partial<ImagesBlock>,
  ) => BlockWriteLanding;
  landingFor: LandingFor;
}) {
  const { isUploading, cancelUpload, uploadFiles, setImages, errorText } =
    useImageUploads({
      onUpdate,
      activeUserId,
      targetLabel,
      updateFor,
      landingFor,
    });
  // Handing the input an empty list again lets the same files be picked twice.
  const [picked, setPicked] = useState<File[]>(NO_FILES);
  const images = block.images;
  const downloadable = block.downloadable ?? false;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Images"
        help="One image shows alone; several become a carousel."
        error={errorText}
      >
        {(control) => (
          <div className="flex items-center gap-3">
            <FileInput
              {...control}
              multiple
              accept="image/*"
              value={picked}
              onChange={(files) => {
                if (files.length === 0) return;
                setPicked(files);
                void uploadFiles(files).finally(() => setPicked(NO_FILES));
              }}
              disabled={isUploading}
            />
            {isUploading && (
              <UploadingWithCancel
                label="Uploading…"
                cancelLabel="Cancel the upload and keep the images already added"
                onCancel={cancelUpload}
                className="shrink-0 text-caption text-fg-muted"
              />
            )}
          </div>
        )}
      </Field>

      <CheckboxField
        label="Show a download button"
        checked={downloadable}
        onChange={(event) =>
          onUpdate({ downloadable: event.target.checked || undefined })
        }
      />

      {images.length > 0 && (
        <ImageRows
          images={images}
          downloadable={downloadable}
          setImages={setImages}
        />
      )}

      {images.length > 0 && <BlockPreview block={block} />}
    </div>
  );
}
