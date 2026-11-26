import { refusalMessage } from "@alliance/common/errorMessage";
import type { VideoBlock } from "@alliance/common/forms/display-blocks";
// eslint-disable-next-line api-client/named-hooks-only -- file upload; its result is used once, not cached
import { videosUploadVideoAdmin } from "@alliance/shared/client";
import { useState } from "react";
import { Link, href } from "react-router";
import { uploadSessionExpiredMessage } from "../../../../lib/sessionExpired";
import { FileInput } from "../../../../ui/FileInput";
import { linkClass } from "../../../../ui/styles";
import { Field } from "../../../../ui/templates/Form";
import { BlockPreview } from "./BlockPreview";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

const NO_FILES: File[] = [];

export function EditableVideoBlock({
  block,
  onUpdate,
  updateCurrent,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
  laterFields,
}: BaseDisplayBlockProps<VideoBlock>) {
  // Handing the input an empty list again lets the same files be picked twice.
  const [picked, setPicked] = useState<File[]>(NO_FILES);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (
    files: File[],
    update: (updates: Partial<VideoBlock>) => void,
  ) => {
    if (files.length === 0) return;
    setPicked(files);

    if (!files.some((file) => file.name.endsWith(".m3u8"))) {
      setUploadError("At least one .m3u8 playlist file is required");
      setPicked(NO_FILES);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { data, error, response } = await videosUploadVideoAdmin({
        body: { files },
      });

      if (data === undefined) {
        setUploadError(
          refusalMessage({
            status: response.status,
            error,
            fallback: `Upload failed with status ${response.status}`,
            sessionExpired: uploadSessionExpiredMessage,
          }),
        );
      } else {
        update({ src: data.key, videoId: data.id });
      }
    } catch {
      setUploadError("Upload failed");
    }
    setIsUploading(false);
    setPicked(NO_FILES);
  };

  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      updateCurrent={updateCurrent}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="flex flex-col gap-4">
          <Field
            label="Video files"
            help="Choose the .m3u8 playlist with its .ts segments and any .vtt files."
            error={uploadError}
          >
            {(control) => (
              <FileInput
                {...control}
                multiple
                accept=".m3u8,.ts,.vtt"
                value={picked}
                onChange={(files) => void upload(files, handleUpdate)}
                disabled={isUploading}
              />
            )}
          </Field>
          {isUploading && (
            <p role="status" className="text-caption text-fg-muted">
              Uploading…
            </p>
          )}
          {activeBlock.videoId && (
            <Link
              to={href(`/content/media/videos/:videoId`, {
                videoId: activeBlock.videoId.toString(),
              })}
              className={`${linkClass} self-start`}
            >
              Manage video file
            </Link>
          )}
          <BlockTextField
            label="Caption"
            mark="optional"
            value={activeBlock.caption ?? ""}
            onChange={(caption) => handleUpdate({ caption })}
            placeholder="Add an optional caption"
          />
          {activeBlock.src && <BlockPreview block={activeBlock} />}
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
