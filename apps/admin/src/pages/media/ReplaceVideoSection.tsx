import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { useState } from "react";
import { countOf } from "../../lib/formatNumber";
import { uploadSessionExpiredMessage } from "../../lib/sessionExpired";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useReplaceVideoAdmin } from "../../lib/useVideosAdmin";
import { CodeBlock } from "../../ui/CodeBlock";
import { FileInput } from "../../ui/FileInput";
import {
  Field,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { replacementFilesError } from "./mediaRules";

const FFMPEG_COMMAND =
  "ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 28 -maxrate 2M -bufsize 4M -vf scale=-2:720 -c:a aac -b:a 128k -hls_time 6 -hls_list_size 0 -hls_segment_filename segment_%03d.ts output.m3u8";

const STATE_TEXT = {
  [SaveState.Saving]: "Replacing…",
  [SaveState.Saved]: "Replaced",
  [SaveState.Failed]: "Couldn't replace",
};

export function ReplaceVideoSection({
  videoId,
  filename,
}: {
  videoId: number;
  filename: string;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ files?: string }>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const replacement = useReplaceVideoAdmin({
    videoId,
    onSuccess: () => {
      success("Video content replaced", filename);
      setFiles([]);
    },
    onError: (error) => console.error("Failed to replace video", error),
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = replacementFilesError(files);
    if (problem) {
      setErrors({ files: problem });
      focusFirstInvalid();
      return;
    }
    const confirmed = await confirm({
      title: `Replace the content of “${filename}”?`,
      message: `Everyone who plays video ${videoId} gets the ${countOf(files.length, "file")} you chose. Its current files are deleted and can't be restored.`,
      confirmLabel: "Replace content",
      destructive: true,
    });
    if (!confirmed) return;
    replacement.mutate(files);
  };

  const state = replacement.isPending
    ? SaveState.Saving
    : replacement.isError
      ? SaveState.Failed
      : replacement.isSuccess
        ? SaveState.Saved
        : SaveState.Clean;

  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
      <FormSection
        title="Replace video content"
        description="Swap this video's playlist and segments for files you processed yourself."
        footer={
          <SaveBar
            state={state}
            saveLabel="Replace video content"
            stateText={STATE_TEXT}
            error={
              replacement.isError
                ? thrownRefusalMessage({
                    error: replacement.error,
                    fallback: SAVE_FAILED_FALLBACK,
                    sessionExpired: uploadSessionExpiredMessage,
                  })
                : null
            }
          />
        }
      >
        <div className="flex flex-col gap-1.5">
          <p>Process the video with a command like:</p>
          <CodeBlock>{FFMPEG_COMMAND}</CodeBlock>
        </div>
        <Field
          label="Replacement files"
          help={
            files.length > 0
              ? `${countOf(files.length, "file")} selected`
              : "The .m3u8 playlist and its .ts segments."
          }
          error={errors.files}
        >
          {(control) => (
            <FileInput
              {...control}
              multiple
              accept=".m3u8,.ts"
              value={files}
              onChange={(chosen) => {
                setFiles(chosen);
                setErrors({});
                replacement.reset();
              }}
            />
          )}
        </Field>
      </FormSection>
    </form>
  );
}
